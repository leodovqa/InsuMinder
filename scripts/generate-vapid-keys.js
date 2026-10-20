#!/usr/bin/env node

/**
 * scripts/generate-vapid-keys.js
 * Generates an RFC 8292 compliant ECDSA P-256 (prime256v1) VAPID keypair
 * using Node's built-in crypto module (zero external dependencies).
 *
 * Usage:
 *   npm run generate:vapid
 *   node scripts/generate-vapid-keys.js
 *
 * Under Rule 13 (Zero Hardcoded Secrets), NEVER commit the generated keys to Git!
 */

const crypto = require('crypto');

function generateVapidKeys() {
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const publicKey = ecdh.getPublicKey('base64url');
  const privateKey = ecdh.getPrivateKey('base64url');
  return { publicKey, privateKey };
}

const { publicKey, privateKey } = generateVapidKeys();
const defaultSubject = 'mailto:insuminder@gmail.com';

console.log('='.repeat(70));
console.log('🔑 Fresh VAPID Keypair Generated Successfully');
console.log('='.repeat(70));
console.log('');
console.log('📋 Values:');
console.log('  Public Key  :', publicKey);
console.log('  Private Key :', privateKey);
console.log('  Subject     :', defaultSubject);
console.log('');
console.log('='.repeat(70));
console.log('1️⃣  Cloudflare Pages Production Setup');
console.log('='.repeat(70));
console.log('Navigate to: Workers & Pages → InsuMinder → Settings → Variables and secrets');
console.log('');
console.log('Add the following 3 variables:');
console.log('  Variable name : VAPID_PUBLIC_KEY');
console.log('  Type          : Text (or Secret)');
console.log('  Value         :', publicKey);
console.log('');
console.log('  Variable name : VAPID_PRIVATE_KEY');
console.log('  Type          : Secret  (Encrypted)');
console.log('  Value         :', privateKey);
console.log('');
console.log('  Variable name : VAPID_SUBJECT');
console.log('  Type          : Text');
console.log('  Value         :', defaultSubject);
console.log('');
console.log('='.repeat(70));
console.log('2️⃣  Local Development Setup (.env)');
console.log('='.repeat(70));
console.log('If running locally, paste the following into your local .env file:');
console.log('');
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=${defaultSubject}`);
console.log('');
console.log('⚠️  CRITICAL REMINDER (Rule 13 - Zero Hardcoded Secrets):');
console.log('   NEVER commit these keys or paste them into tracked repository files.');
console.log('='.repeat(70));
