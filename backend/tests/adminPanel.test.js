import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { signSessionToken } from '../src/middleware/auth.js';
import User from '../src/models/User.js';
import Campaign from '../src/models/Campaign.js';
import AdminPanelUser from '../src/models/AdminPanelUser.js';
import {
  bootstrapAdminPanelUser,
  DEFAULT_BOOTSTRAP_USERNAME,
  DEFAULT_BOOTSTRAP_PASSWORD
} from '../src/services/adminPanelService.js';

let memoryServer;
let app;

function telegramAuthHeader(telegramId) {
  const token = signSessionToken({ telegramId: String(telegramId) });
  return { Authorization: `Bearer ${token}` };
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-admin-panel';
  process.env.ALLOW_DEV_AUTH = 'true';
  process.env.ADMIN_TELEGRAM_IDS = '999';
  process.env.RATE_LIMIT_MAX_REQUESTS = '100000';
  delete process.env.ADMIN_PANEL_BOOTSTRAP_USERNAME;
  delete process.env.ADMIN_PANEL_BOOTSTRAP_PASSWORD;

  memoryServer = await MongoMemoryServer.create();
  await mongoose.connect(memoryServer.getUri('tapearn-admin-panel-test'));
  app = createApp();
});

after(async () => {
  await mongoose.disconnect();
  if (memoryServer) await memoryServer.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    Campaign.deleteMany({}),
    AdminPanelUser.deleteMany({})
  ]);
  await bootstrapAdminPanelUser();
});

describe('Admin panel auth', () => {
  it('logs in with bootstrap credentials', async () => {
    const res = await request(app)
      .post('/api/admin-panel/login')
      .send({
        username: DEFAULT_BOOTSTRAP_USERNAME,
        password: DEFAULT_BOOTSTRAP_PASSWORD
      });

    assert.equal(res.status, 200);
    assert.ok(res.body.token);
    assert.equal(res.body.user.username, DEFAULT_BOOTSTRAP_USERNAME);
  });

  it('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/admin-panel/login')
      .send({
        username: DEFAULT_BOOTSTRAP_USERNAME,
        password: 'wrong-password'
      });

    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('does not re-seed when a panel user already exists', async () => {
    const first = await AdminPanelUser.countDocuments();
    assert.equal(first, 1);

    const again = await bootstrapAdminPanelUser();
    assert.equal(again.seeded, false);
    assert.equal(await AdminPanelUser.countDocuments(), 1);
  });

  it('changes username and password when current password is correct', async () => {
    const login = await request(app)
      .post('/api/admin-panel/login')
      .send({
        username: DEFAULT_BOOTSTRAP_USERNAME,
        password: DEFAULT_BOOTSTRAP_PASSWORD
      });

    const change = await request(app)
      .post('/api/admin-panel/credentials')
      .set({ Authorization: `Bearer ${login.body.token}` })
      .send({
        currentPassword: DEFAULT_BOOTSTRAP_PASSWORD,
        newUsername: 'yorzaadmin',
        newPassword: 'NewPass789'
      });

    assert.equal(change.status, 200);
    assert.equal(change.body.user.username, 'yorzaadmin');
    assert.ok(change.body.token);

    const oldLogin = await request(app)
      .post('/api/admin-panel/login')
      .send({
        username: DEFAULT_BOOTSTRAP_USERNAME,
        password: DEFAULT_BOOTSTRAP_PASSWORD
      });
    assert.equal(oldLogin.status, 401);

    const newLogin = await request(app)
      .post('/api/admin-panel/login')
      .send({
        username: 'yorzaadmin',
        password: 'NewPass789'
      });
    assert.equal(newLogin.status, 200);
    assert.ok(newLogin.body.token);
  });

  it('rejects credential change with wrong current password', async () => {
    const login = await request(app)
      .post('/api/admin-panel/login')
      .send({
        username: DEFAULT_BOOTSTRAP_USERNAME,
        password: DEFAULT_BOOTSTRAP_PASSWORD
      });

    const change = await request(app)
      .post('/api/admin-panel/credentials')
      .set({ Authorization: `Bearer ${login.body.token}` })
      .send({
        currentPassword: 'not-the-password',
        newPassword: 'whatever123'
      });

    assert.equal(change.status, 401);
  });
});

describe('Admin panel JWT + Telegram admin coexistence', () => {
  it('allows panel JWT to create a title+url campaign that appears on GET /api/campaigns', async () => {
    const login = await request(app)
      .post('/api/admin-panel/login')
      .send({
        username: DEFAULT_BOOTSTRAP_USERNAME,
        password: DEFAULT_BOOTSTRAP_PASSWORD
      });

    const create = await request(app)
      .post('/api/admin/campaigns')
      .set({ Authorization: `Bearer ${login.body.token}` })
      .send({
        title: 'Monetized Ad',
        url: 'https://example.com/offer'
      });

    assert.equal(create.status, 201);
    assert.equal(create.body.data.type, 'SPONSORED_POST');
    assert.equal(create.body.data.title, 'Monetized Ad');
    assert.equal(create.body.data.url, 'https://example.com/offer');
    assert.ok(create.body.data.rewardPoints > 0);

    const user = new User({
      telegramId: '5001',
      username: 'player',
      firstName: 'Player'
    });
    await user.save();

    const feed = await request(app)
      .get('/api/campaigns')
      .set(telegramAuthHeader('5001'));

    assert.equal(feed.status, 200);
    assert.equal(feed.body.data.length, 1);
    assert.equal(feed.body.data[0].title, 'Monetized Ad');
    assert.equal(feed.body.data[0].url, 'https://example.com/offer');
  });

  it('still allows Telegram ADMIN_TELEGRAM_IDS JWT to CRUD campaigns', async () => {
    await User.create({
      telegramId: '999',
      username: 'tgadmin',
      firstName: 'Admin'
    });

    const create = await request(app)
      .post('/api/admin/campaigns')
      .set(telegramAuthHeader('999'))
      .send({
        type: 'SPONSORED_POST',
        title: 'TG Admin Ad',
        url: 'https://example.com/tg',
        rewardPoints: 250
      });

    assert.equal(create.status, 201);

    const list = await request(app)
      .get('/api/admin/campaigns')
      .set(telegramAuthHeader('999'));

    assert.equal(list.status, 200);
    assert.equal(list.body.data.length, 1);

    const id = create.body.data._id;
    const patch = await request(app)
      .patch(`/api/admin/campaigns/${id}`)
      .set(telegramAuthHeader('999'))
      .send({ title: 'TG Admin Ad Updated' });

    assert.equal(patch.status, 200);
    assert.equal(patch.body.data.title, 'TG Admin Ad Updated');
  });

  it('rejects non-admin Telegram JWT on admin campaigns', async () => {
    await User.create({
      telegramId: '111',
      username: 'normie',
      firstName: 'Norm'
    });

    const res = await request(app)
      .get('/api/admin/campaigns')
      .set(telegramAuthHeader('111'));

    assert.equal(res.status, 403);
  });
});
