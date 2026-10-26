import bcrypt from 'bcryptjs';
import AdminPanelUser from '../models/AdminPanelUser.js';
import { signSessionToken } from '../middleware/auth.js';
import { ADMIN_PANEL_TOKEN_TYPE } from '../constants/adminPanel.js';

const BCRYPT_ROUNDS = 12;
export { ADMIN_PANEL_TOKEN_TYPE };
export const DEFAULT_BOOTSTRAP_USERNAME = 'faiq';
export const DEFAULT_BOOTSTRAP_PASSWORD = 'Devil345';
export const DEFAULT_SPONSORED_AD_REWARD = 100;

/**
 * Seed the first admin-panel user when none exist.
 * Does not re-seed if a panel user already exists.
 */
export async function bootstrapAdminPanelUser() {
  const existing = await AdminPanelUser.countDocuments();
  if (existing > 0) {
    return { seeded: false, reason: 'already_exists' };
  }

  const username = (
    process.env.ADMIN_PANEL_BOOTSTRAP_USERNAME ||
    DEFAULT_BOOTSTRAP_USERNAME
  )
    .trim()
    .toLowerCase();
  const password =
    process.env.ADMIN_PANEL_BOOTSTRAP_PASSWORD || DEFAULT_BOOTSTRAP_PASSWORD;

  if (!username || !password) {
    throw new Error('Admin panel bootstrap username/password cannot be empty');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await AdminPanelUser.create({ username, passwordHash });

  return { seeded: true, username: user.username, id: String(user._id) };
}

export async function loginAdminPanel(username, password) {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized || !password) {
    const err = new Error('Username and password are required');
    err.status = 400;
    throw err;
  }

  const user = await AdminPanelUser.findOne({ username: normalized });
  if (!user) {
    const err = new Error('Invalid username or password');
    err.status = 401;
    throw err;
  }

  const ok = await bcrypt.compare(String(password), user.passwordHash);
  if (!ok) {
    const err = new Error('Invalid username or password');
    err.status = 401;
    throw err;
  }

  const token = signSessionToken({
    type: ADMIN_PANEL_TOKEN_TYPE,
    panelUserId: String(user._id),
    username: user.username
  });

  return {
    token,
    user: {
      id: String(user._id),
      username: user.username
    }
  };
}

export async function changeAdminPanelCredentials(panelUserId, {
  currentPassword,
  newUsername,
  newPassword
}) {
  if (!currentPassword) {
    const err = new Error('Current password is required');
    err.status = 400;
    throw err;
  }

  const user = await AdminPanelUser.findById(panelUserId);
  if (!user) {
    const err = new Error('Admin panel user not found');
    err.status = 404;
    throw err;
  }

  const ok = await bcrypt.compare(String(currentPassword), user.passwordHash);
  if (!ok) {
    const err = new Error('Current password is incorrect');
    err.status = 401;
    throw err;
  }

  const updates = {};

  if (newUsername !== undefined && newUsername !== null) {
    const normalized = String(newUsername).trim().toLowerCase();
    if (!normalized) {
      const err = new Error('New username cannot be empty');
      err.status = 400;
      throw err;
    }
    if (normalized !== user.username) {
      const clash = await AdminPanelUser.findOne({ username: normalized });
      if (clash) {
        const err = new Error('Username already taken');
        err.status = 409;
        throw err;
      }
      updates.username = normalized;
    }
  }

  if (newPassword !== undefined && newPassword !== null) {
    if (String(newPassword).length < 6) {
      const err = new Error('New password must be at least 6 characters');
      err.status = 400;
      throw err;
    }
    updates.passwordHash = await bcrypt.hash(String(newPassword), BCRYPT_ROUNDS);
  }

  if (Object.keys(updates).length === 0) {
    const err = new Error('Provide a new username and/or new password');
    err.status = 400;
    throw err;
  }

  Object.assign(user, updates);
  await user.save();

  const token = signSessionToken({
    type: ADMIN_PANEL_TOKEN_TYPE,
    panelUserId: String(user._id),
    username: user.username
  });

  return {
    token,
    user: {
      id: String(user._id),
      username: user.username
    }
  };
}

export { isAdminPanelToken } from '../constants/adminPanel.js';
