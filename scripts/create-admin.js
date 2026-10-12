#!/usr/bin/env node
// scripts/create-admin.js
// Interactive helper that sets (or resets) the admin login for the site.
// Run with: npm run create-admin
// It writes ADMIN_USERNAME / ADMIN_PASSWORD_HASH / SESSION_SECRET into a
// .env file in the project root (creating one from .env.example if needed).

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const ROOT = path.join(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const EXAMPLE_PATH = path.join(ROOT, '.env.example');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const text = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function writeEnvFile(filePath, values) {
  const lines = Object.entries(values).map(([k, v]) => `${k}=${v}`);
  fs.writeFileSync(filePath, lines.join('\n') + '\n');
}

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

async function main() {
  const existing = { ...loadEnvFile(EXAMPLE_PATH), ...loadEnvFile(ENV_PATH) };

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('Set up (or reset) your blog admin login.\n');
  const usernameAnswer = await ask(rl, `Admin username [${existing.ADMIN_USERNAME || 'admin'}]: `);
  const username = usernameAnswer.trim() || existing.ADMIN_USERNAME || 'admin';

  console.log('(Your password will be visible as you type -- that\'s expected. Only its');
  console.log(' one-way hash ever gets saved to disk, never the password itself.)');
  let password = '';
  while (password.length < 8) {
    password = await ask(rl, 'Admin password (min 8 characters): ');
    if (password.length < 8) console.log('  Please use at least 8 characters.');
  }
  rl.close();

  const hash = bcrypt.hashSync(password, 12);
  const sessionSecret = existing.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

  writeEnvFile(ENV_PATH, {
    ADMIN_USERNAME: username,
    ADMIN_PASSWORD_HASH: hash,
    SESSION_SECRET: sessionSecret,
    PORT: existing.PORT || '3000',
  });

  console.log(`\nSaved to ${ENV_PATH}`);
  console.log('You can now log in at /admin/login with that username and password.');
}

main().catch((err) => {
  console.error('Something went wrong setting up your admin login:', err.message);
  process.exit(1);
});
