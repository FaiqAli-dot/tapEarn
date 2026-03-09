#!/usr/bin/env node
import { networkInterfaces } from 'os';
import { writeFileSync, existsSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Get local IP address
function getLocalIP() {
  const nets = networkInterfaces();
  const results = [];

  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
      if (net.family === 'IPv4' && !net.internal) {
        results.push(net.address);
      }
    }
  }
  
  return results[0] || 'localhost';
}

const localIP = getLocalIP();
const frontendPort = 3000;
const backendPort = 3001;

console.log('\n🎉 Mobile Testing Setup\n');
console.log(`📱 Your Local IP: ${localIP}`);
console.log(`🖥️  Frontend URL: http://${localIP}:${frontendPort}`);
console.log(`🔧 Backend URL: http://${localIP}:${backendPort}`);

// Create or update .env file
const envPath = join(__dirname, '.env');
const envContent = `VITE_API_BASE_URL=http://${localIP}:${backendPort}/api\n`;

let existingEnv = '';
if (existsSync(envPath)) {
  existingEnv = readFileSync(envPath, 'utf-8');
  // Remove old VITE_API_BASE_URL if it exists
  existingEnv = existingEnv
    .split('\n')
    .filter(line => !line.startsWith('VITE_API_BASE_URL'))
    .join('\n');
}

const finalEnv = existingEnv ? existingEnv + '\n' + envContent : envContent;
writeFileSync(envPath, finalEnv);

console.log('\n✅ Created/Updated .env file with:\n');
console.log(`   VITE_API_BASE_URL=http://${localIP}:${backendPort}/api`);

console.log('\n📋 Next Steps:\n');
console.log('1. Make sure MongoDB is running');
console.log('2. Run: npm start');
console.log(`3. Open http://${localIP}:${frontendPort} on your phone\n`);
console.log('💡 Tip: Make sure your phone and computer are on the same WiFi network!\n');

