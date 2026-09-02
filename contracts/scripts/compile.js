#!/usr/bin/env node
import { compileFunc } from '@ton-community/func-js';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const contractsDir = path.resolve(__dirname, '..');
const buildDir = path.join(contractsDir, 'build');

const stdlib = readFileSync(path.join(contractsDir, 'imports', 'stdlib.fc'), 'utf8');
const contract = readFileSync(path.join(contractsDir, 'ReferralPayment.fc'), 'utf8');

const result = await compileFunc({
  targets: ['ReferralPayment.fc'],
  sources: (filePath) => {
    if (filePath === 'imports/stdlib.fc' || filePath === 'stdlib.fc') return stdlib;
    if (filePath === 'ReferralPayment.fc') return contract;
    throw new Error(`Unknown source: ${filePath}`);
  },
});

if (result.status === 'error') {
  console.error('Compilation failed:', result.message);
  process.exit(1);
}

mkdirSync(buildDir, { recursive: true });
const codeBoc = Buffer.from(result.codeBoc, 'base64');
writeFileSync(
  path.join(buildDir, 'ReferralPayment.compiled.json'),
  JSON.stringify({ hex: codeBoc.toString('hex'), base64: result.codeBoc }, null, 2)
);
console.log('ReferralPayment compiled to build/ReferralPayment.compiled.json');
