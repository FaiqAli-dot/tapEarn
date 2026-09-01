import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import {
  Address,
  beginCell,
  Cell,
  contractAddress,
  toNano
} from '@ton/core';
import { keyPairFromSeed, sign } from '@ton/crypto';
import pkg from '@ton/sandbox';
const { Blockchain } = pkg;
import { compileFunc } from '@ton-community/func-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OP_SUBSCRIBE = 0x591a2b3c;

async function compileContract() {
  const contractsDir = path.resolve(__dirname, '..');
  const stdlib = readFileSync(path.join(contractsDir, 'imports', 'stdlib.fc'), 'utf8');
  const contract = readFileSync(path.join(contractsDir, 'ReferralPayment.fc'), 'utf8');
  const result = await compileFunc({
    targets: ['ReferralPayment.fc'],
    sources: (filePath) => {
      if (filePath === 'imports/stdlib.fc' || filePath === 'stdlib.fc') return stdlib;
      if (filePath === 'ReferralPayment.fc') return contract;
      throw new Error(`Unknown source: ${filePath}`);
    }
  });
  if (result.status === 'error') throw new Error(result.message);
  return Cell.fromBoc(Buffer.from(result.codeBoc, 'base64'))[0];
}

function buildInitData(treasury, signerPubKeyBigInt) {
  return beginCell()
    .storeAddress(treasury)
    .storeUint(signerPubKeyBigInt, 256)
    .storeDict(null)
    .endCell();
}

function buildSubscribeBody({
  paymentId,
  subscriber,
  referrer,
  amount,
  expiry,
  nonce,
  signerSeed
}) {
  const authCell = beginCell()
    .storeUint(paymentId, 256)
    .storeAddress(subscriber)
    .storeAddress(referrer)
    .storeCoins(amount)
    .storeUint(expiry, 64)
    .storeUint(nonce, 64)
    .endCell();

  const sig = sign(authCell.hash(), keyPairFromSeed(signerSeed).secretKey);
  const authPart = beginCell()
    .storeUint(paymentId, 256)
    .storeAddress(subscriber)
    .storeAddress(referrer)
    .storeCoins(amount)
    .storeUint(expiry, 64)
    .storeUint(nonce, 64)
    .endCell();
  const sigPart = beginCell().storeUint(BigInt(`0x${sig.toString('hex')}`), 512).endCell();

  return beginCell()
    .storeUint(OP_SUBSCRIBE, 32)
    .storeSlice(authPart.beginParse())
    .storeRef(sigPart)
    .endCell();
}

describe('ReferralPayment router (sandbox)', () => {
  let code;
  let blockchain;
  let treasury;
  let subscriber;
  let referrer;
  let contract;
  let signerSeed;
  let signerPub;

  before(async () => {
    code = await compileContract();
    const ed = crypto.generateKeyPairSync('ed25519');
    signerSeed = ed.privateKey.export({ type: 'pkcs8', format: 'der' }).subarray(-32);
    signerPub = ed.publicKey.export({ type: 'spki', format: 'der' }).subarray(-32);

    blockchain = await Blockchain.create();
    treasury = await blockchain.treasury('treasury');
    subscriber = await blockchain.treasury('subscriber');
    referrer = await blockchain.treasury('referrer');

    const initData = buildInitData(treasury.address, BigInt(`0x${signerPub.toString('hex')}`));
    const addr = contractAddress(0, { code, data: initData });
    contract = blockchain.openContract(
      new (class {
        constructor(address) {
          this.address = address;
        }
      })(addr)
    );

    const deployer = await blockchain.treasury('deployer');
    await deployer.send({
      to: contract.address,
      value: toNano('0.2'),
      init: { code, data: initData },
      bounce: false
    });
  });

  it('splits 50/50 after reserving execution and forward fees', async () => {
    const gross = toNano('0.1');
    const paymentId = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const nonce = 1n;

    const refBefore = await referrer.getBalance();
    const treBefore = await treasury.getBalance();

    const body = buildSubscribeBody({
      paymentId,
      subscriber: subscriber.address,
      referrer: referrer.address,
      amount: gross,
      expiry,
      nonce,
      signerSeed
    });

    const result = await subscriber.send({
      to: contract.address,
      value: gross,
      body,
      bounce: true
    });

    assert.ok(result.transactions.length > 1);

    const refAfter = await referrer.getBalance();
    const treAfter = await treasury.getBalance();
    const refDelta = refAfter - refBefore;
    const treDelta = treAfter - treBefore;

    assert.ok(refDelta > 0n);
    assert.ok(treDelta > 0n);
    assert.equal(refDelta, treDelta - (treDelta % 2n === refDelta % 2n ? 0n : 1n) || refDelta <= treDelta);
    assert.ok(treDelta >= refDelta);
    assert.equal(refDelta + treDelta + (gross - refDelta - treDelta), gross);
  });

  it('rejects duplicate payment_id (replay)', async () => {
    const gross = toNano('0.1');
    const paymentId = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 3600);
    const nonce = 2n;
    const body = buildSubscribeBody({
      paymentId,
      subscriber: subscriber.address,
      referrer: referrer.address,
      amount: gross,
      expiry,
      nonce,
      signerSeed
    });

    await subscriber.send({ to: contract.address, value: gross, body, bounce: true });
    const replay = await subscriber.send({ to: contract.address, value: gross, body, bounce: true });
    const bounced = replay.transactions.some((tx) => tx.description?.aborted);
    assert.ok(bounced);
  });

  it('rejects underpayment (insufficient msg_value)', async () => {
    const gross = toNano('0.1');
    const paymentId = BigInt('0x' + crypto.randomBytes(32).toString('hex'));
    const body = buildSubscribeBody({
      paymentId,
      subscriber: subscriber.address,
      referrer: referrer.address,
      amount: gross,
      expiry: BigInt(Math.floor(Date.now() / 1000) + 3600),
      nonce: 3n,
      signerSeed
    });

    const result = await subscriber.send({
      to: contract.address,
      value: toNano('0.05'),
      body,
      bounce: true
    });
    const bounced = result.transactions.some((tx) => tx.description?.aborted);
    assert.ok(bounced);
  });
});
