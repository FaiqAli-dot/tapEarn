#!/usr/bin/env node
/**
 * Load disposable testnet secrets from ../../.secrets/ton-testnet-wallets.json
 * and run deploy-testnet.js. Never prints private keys.
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const secretsPath = path.join(root, '.secrets', 'ton-testnet-wallets.json');

if (!existsSync(secretsPath)) {
  console.error('Missing .secrets/ton-testnet-wallets.json — run generate-testnet-wallets.js first');
  process.exit(1);
}

const secrets = JSON.parse(readFileSync(secretsPath, 'utf8'));
const env = {
  ...process.env,
  TON_NETWORK: 'testnet',
  TON_DEPLOYER_MNEMONIC: secrets.wallets.deployer.mnemonic,
  TON_TESTNET_TREASURY_ADDRESS: secrets.wallets.treasury.address,
  TON_PAYMENT_SIGNER_PRIVATE_KEY: secrets.signer.privateKeyHex,
  TON_PAYMENT_SIGNER_PUBLIC_KEY: secrets.signer.publicKeyHex,
};

console.log(
  JSON.stringify(
    {
      network: 'testnet',
      deployer: secrets.wallets.deployer.address,
      treasury: secrets.wallets.treasury.address,
      signerPublicKeyHex: secrets.signer.publicKeyHex,
    },
    null,
    2
  )
);

const child = spawn(process.execPath, [path.join(root, 'contracts/scripts/deploy-testnet.js')], {
  cwd: path.join(root, 'contracts'),
  env,
  stdio: 'inherit',
});
child.on('exit', (code) => process.exit(code ?? 1));
