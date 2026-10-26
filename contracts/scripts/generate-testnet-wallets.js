#!/usr/bin/env node
/**
 * Generate disposable TON TESTNET wallets for subscription E2E.
 * Writes secrets outside git (.secrets/). Never prints mnemonics.
 */
import { mnemonicNew, mnemonicToPrivateKey, keyPairFromSeed } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';
import crypto from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const secretsDir = path.join(root, '.secrets');
mkdirSync(secretsDir, { recursive: true });

async function makeWallet(label) {
  const mnemonic = await mnemonicNew(24);
  const key = await mnemonicToPrivateKey(mnemonic);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: key.publicKey });
  return {
    label,
    mnemonic: mnemonic.join(' '),
    address: wallet.address.toString({ bounceable: false, testOnly: true }),
    publicKeyHex: key.publicKey.toString('hex'),
  };
}

const signerSeed = crypto.randomBytes(32);
const signerKp = keyPairFromSeed(signerSeed);
const wallets = {
  network: 'testnet',
  createdAt: new Date().toISOString(),
  signer: {
    privateKeyHex: signerSeed.toString('hex'),
    publicKeyHex: signerKp.publicKey.toString('hex'),
  },
  wallets: {},
};

for (const label of [
  'deployer',
  'treasury',
  'referrerA',
  'subscriberB',
  'subscriberNoRef',
  'subscriberRenewal',
]) {
  wallets.wallets[label] = await makeWallet(label);
}

writeFileSync(path.join(secretsDir, 'ton-testnet-wallets.json'), JSON.stringify(wallets, null, 2), {
  mode: 0o600,
});
const pub = {
  network: 'testnet',
  signerPublicKeyHex: wallets.signer.publicKeyHex,
  addresses: Object.fromEntries(
    Object.entries(wallets.wallets).map(([k, v]) => [k, v.address])
  ),
};
writeFileSync(path.join(secretsDir, 'ton-testnet-public.json'), JSON.stringify(pub, null, 2));
console.log(JSON.stringify(pub, null, 2));
console.log('Secrets written to .secrets/ton-testnet-wallets.json (gitignored). Fund via @testgiver_ton_bot.');
