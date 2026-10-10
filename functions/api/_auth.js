// Cloudflare Pages / Workers Web Crypto Auth Helper

const AUTH_SECRET = 'insuminder-dev-auth-secret-key-2026';

export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const trimmed = email.trim();
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) return false;

  const parts = trimmed.split('@');
  if (parts.length !== 2) return false;
  const domain = parts[1];
  if (!domain.includes('.')) return false;
  const domainParts = domain.split('.');
  if (domainParts.some(p => p.length === 0)) return false;
  const tld = domainParts[domainParts.length - 1];
  if (tld.length < 2) return false;

  if (domain.endsWith('.invalid') || domain.endsWith('.fail') || domain === 'localhost') {
    return false;
  }

  return true;
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToUint8Array(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return arr;
}

function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function base64UrlDecode(str) {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return decodeURIComponent(escape(atob(base64)));
}

export async function hashPassword(password) {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  return `pbkdf2:100000:${bufferToHex(salt)}:${bufferToHex(derivedBits)}`;
}

export async function verifyPassword(password, storedHash) {
  if (!password || !storedHash || typeof storedHash !== 'string') return false;
  const parts = storedHash.split(':');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const iterations = parseInt(parts[1], 10);
  const salt = hexToUint8Array(parts[2]);
  const originalKeyHex = parts[3];

  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );

  return bufferToHex(derivedBits) === originalKeyHex;
}

export function generateVerificationCode() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = 100000 + (array[0] % 900000);
  return String(code);
}

export async function createSessionToken(user, secret = AUTH_SECRET) {
  const payload = {
    userId: user.id,
    email: user.email,
    name: user.name || '',
    exp: Date.now() + 30 * 24 * 60 * 60 * 1000
  };
  const payloadStr = base64UrlEncode(JSON.stringify(payload));

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign('HMAC', key, enc.encode(payloadStr));
  const signatureHex = bufferToHex(signatureBuffer);

  return `${payloadStr}.${signatureHex}`;
}

export async function verifySessionToken(token, secret = AUTH_SECRET) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadStr, signatureHex] = parts;
  const enc = new TextEncoder();

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      hexToUint8Array(signatureHex),
      enc.encode(payloadStr)
    );

    if (!valid) return null;

    const payload = JSON.parse(base64UrlDecode(payloadStr));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getAuthUser(request, env) {
  const secret = (env && env.AUTH_SECRET) || AUTH_SECRET;
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : request.headers.get('x-auth-token');

  if (!token) return null;
  return await verifySessionToken(token, secret);
}

export function generateShareCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const array = new Uint8Array(6);
  crypto.getRandomValues(array);
  let code = 'INSU-';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(array[i] % chars.length);
  }
  return code;
}

export async function getEffectiveUserId(request, env, authUser, db) {
  if (!authUser || !authUser.userId) return null;
  const contextHeader = request.headers.get('x-active-context');
  const ownerIdHeader = request.headers.get('x-active-owner-id');

  if (contextHeader === 'shared' && ownerIdHeader) {
    const ownerId = parseInt(ownerIdHeader, 10);
    if (!isNaN(ownerId)) {
      const membership = await db
        .prepare("SELECT id FROM shared_members WHERE owner_id = ? AND member_id = ?")
        .bind(ownerId, authUser.userId)
        .first();
      if (membership) {
        return ownerId;
      }
    }
  }

  return authUser.userId;
}


