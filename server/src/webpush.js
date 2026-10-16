const crypto = require('crypto');

// Dynamic / environment VAPID key resolution to prevent secret leakage
function resolveVapidKeys() {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
      privateKey: process.env.VAPID_PRIVATE_KEY,
      subject: process.env.VAPID_SUBJECT || 'mailto:support@insuminder.com'
    };
  }
  const ec = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const privJwk = ec.privateKey.export({ format: 'jwk' });
  const pubJwk = ec.publicKey.export({ format: 'jwk' });
  const x = Buffer.from(pubJwk.x, 'base64');
  const y = Buffer.from(pubJwk.y, 'base64');
  const uncompressed = Buffer.concat([Buffer.from([0x04]), x, y])
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return {
    publicKey: uncompressed,
    privateKey: privJwk.d,
    subject: process.env.VAPID_SUBJECT || 'mailto:support@insuminder.com'
  };
}

const _vapid = resolveVapidKeys();
const VAPID_PUBLIC_KEY = _vapid.publicKey;
const VAPID_PRIVATE_KEY = _vapid.privateKey;
const VAPID_SUBJECT = _vapid.subject;

function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function uint8ArrayToBase64Url(uint8Array) {
  return Buffer.from(uint8Array)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function concatBuffers(...buffers) {
  let totalLength = 0;
  for (const b of buffers) totalLength += b.length;
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of buffers) {
    result.set(b, offset);
    offset += b.length;
  }
  return result;
}

async function createVapidHeader(endpointUrl, subject, privateKeyBase64, publicKeyBase64) {
  const url = new URL(endpointUrl);
  const audience = `${url.protocol}//${url.host}`;
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: 'ES256', typ: 'JWT' };
  const payload = {
    aud: audience,
    exp: now + 86400,
    sub: subject
  };

  const encHeader = uint8ArrayToBase64Url(Buffer.from(JSON.stringify(header)));
  const encPayload = uint8ArrayToBase64Url(Buffer.from(JSON.stringify(payload)));
  const unsignedToken = `${encHeader}.${encPayload}`;

  const pubBytes = base64UrlToUint8Array(publicKeyBase64);
  const x = uint8ArrayToBase64Url(pubBytes.slice(1, 33));
  const y = uint8ArrayToBase64Url(pubBytes.slice(33, 65));

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    {
      kty: 'EC',
      crv: 'P-256',
      d: privateKeyBase64,
      x: x,
      y: y,
      ext: true
    },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    Buffer.from(unsignedToken)
  );

  const encSignature = uint8ArrayToBase64Url(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${encSignature}`;

  return `vapid t=${jwt}, k=${publicKeyBase64}`;
}

async function encryptPayload(payloadString, clientP256dhBase64, clientAuthBase64) {
  const clientPublicKeyBytes = base64UrlToUint8Array(clientP256dhBase64);
  const clientAuthBytes = base64UrlToUint8Array(clientAuthBase64);

  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKeyBytes = new Uint8Array(localPublicKeyRaw);

  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    localKeyPair.privateKey,
    256
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const authKey = await crypto.subtle.importKey(
    'raw',
    clientAuthBytes,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const infoPrefix = Buffer.from('WebPush: info\0');
  const ikmInfo = concatBuffers(infoPrefix, clientPublicKeyBytes, localPublicKeyBytes);

  const ikmBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(sharedSecret),
      info: ikmInfo
    },
    authKey,
    256
  );

  const ikmKey = await crypto.subtle.importKey(
    'raw',
    ikmBits,
    { name: 'HKDF' },
    false,
    ['deriveKey', 'deriveBits']
  );

  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0');
  const nonceInfo = Buffer.from('Content-Encoding: nonce\0');

  const cek = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: cekInfo
    },
    ikmKey,
    { name: 'AES-GCM', length: 128 },
    false,
    ['encrypt']
  );

  const nonceBits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt,
      info: nonceInfo
    },
    ikmKey,
    96
  );

  const payloadBytes = Buffer.from(payloadString);
  const record = concatBuffers(payloadBytes, new Uint8Array([0x02]));

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(nonceBits),
      tagLength: 128
    },
    cek,
    record
  );

  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x00]);
  const idlen = new Uint8Array([localPublicKeyBytes.length]);
  return concatBuffers(salt, rs, idlen, localPublicKeyBytes, new Uint8Array(ciphertext));
}

async function sendWebPush(subscription, payload, options = {}) {
  if (!subscription || !subscription.endpoint) {
    return { ok: false, error: 'Subscription missing endpoint.' };
  }

  const endpoint = subscription.endpoint;
  const p256dh = subscription.p256dh || (subscription.keys && subscription.keys.p256dh);
  const auth = subscription.auth || (subscription.keys && subscription.keys.auth);

  if (!p256dh || !auth) {
    return { ok: false, error: 'Subscription missing p256dh or auth keys.' };
  }

  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const subject = options.subject || VAPID_SUBJECT;
  const privateKey = options.privateKey || VAPID_PRIVATE_KEY;
  const publicKey = options.publicKey || VAPID_PUBLIC_KEY;

  try {
    const authHeader = await createVapidHeader(endpoint, subject, privateKey, publicKey);
    const body = await encryptPayload(payloadString, p256dh, auth);

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'TTL': '86400',
        'Urgency': 'high',
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Authorization': authHeader
      },
      body: body
    });

    if (res.status === 201 || res.status === 200 || res.status === 202) {
      return { ok: true, status: res.status };
    }

    if (res.status === 404 || res.status === 410) {
      return { ok: false, status: res.status, expired: true, error: 'Subscription has expired or unsubscribed.' };
    }

    const errText = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: `Push service rejected notification (${res.status}): ${errText}` };
  } catch (err) {
    return { ok: false, error: err.message || 'Network error delivering push notification.' };
  }
}

module.exports = {
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  VAPID_SUBJECT,
  sendWebPush
};

