// functions/api/_webpush.js - RFC 8291 & RFC 8292 Zero-Dependency Web Push Dispatcher
// Works 100% identically across Cloudflare Pages Functions and modern Node.js runtimes

export const VAPID_PUBLIC_KEY = 'BNACDjD1nn2PsLMW8wXHd24MFshk1rHd72u-_NC28fa9nepN7SJTsBmAGaI1ooxPvTv-lOYuQrkxE2z7iVwUJHs';
export const VAPID_PRIVATE_KEY = 'OgxOXBOxQ9xAWgVbeDkyRe3pYeGYPvLW8n04TrFK3tY';
export const VAPID_SUBJECT = 'mailto:support@insuminder.com';

function base64UrlToUint8Array(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function uint8ArrayToBase64Url(uint8Array) {
  let binary = '';
  for (let i = 0; i < uint8Array.byteLength; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary)
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

/**
 * Creates an RFC 8292 VAPID Authorization JWT
 */
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

  const encHeader = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const encPayload = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
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
    new TextEncoder().encode(unsignedToken)
  );

  const encSignature = uint8ArrayToBase64Url(new Uint8Array(signature));
  const jwt = `${unsignedToken}.${encSignature}`;

  return `vapid t=${jwt}, k=${publicKeyBase64}`;
}

/**
 * Encrypts payload with AES-128-GCM according to RFC 8291
 */
async function encryptPayload(payloadString, clientP256dhBase64, clientAuthBase64) {
  const clientPublicKeyBytes = base64UrlToUint8Array(clientP256dhBase64);
  const clientAuthBytes = base64UrlToUint8Array(clientAuthBase64);

  // 1. Generate local ephemeral ECDH keypair
  const localKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );
  const localPublicKeyRaw = await crypto.subtle.exportKey('raw', localKeyPair.publicKey);
  const localPublicKeyBytes = new Uint8Array(localPublicKeyRaw);

  // 2. Import client public key
  const clientKey = await crypto.subtle.importKey(
    'raw',
    clientPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // 3. Derive shared secret (32 bytes)
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: clientKey },
    localKeyPair.privateKey,
    256
  );

  // 4. Generate 16-byte random salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // 5. HKDF step 1 (auth secret)
  const authKey = await crypto.subtle.importKey(
    'raw',
    clientAuthBytes,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  const infoPrefix = new TextEncoder().encode('WebPush: info\0');
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

  // 6. HKDF step 2: derive CEK and nonce
  const ikmKey = await crypto.subtle.importKey(
    'raw',
    ikmBits,
    { name: 'HKDF' },
    false,
    ['deriveKey', 'deriveBits']
  );

  const cekInfo = new TextEncoder().encode('Content-Encoding: aes128gcm\0');
  const nonceInfo = new TextEncoder().encode('Content-Encoding: nonce\0');

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

  // 7. Pad & Encrypt payload (0x02 = end of single record)
  const payloadBytes = new TextEncoder().encode(payloadString);
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

  // 8. Assemble RFC 8291 body header
  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x00]); // 4096 bytes
  const idlen = new Uint8Array([localPublicKeyBytes.length]); // 65 bytes
  return concatBuffers(salt, rs, idlen, localPublicKeyBytes, new Uint8Array(ciphertext));
}

/**
 * Sends a Web Push Notification to a subscription
 *
 * @param {Object} subscription - { endpoint, p256dh, auth } or { endpoint, keys: { p256dh, auth } }
 * @param {string|Object} payload - Notification data payload
 * @param {Object} [options] - Optional overrides { subject, privateKey, publicKey }
 * @returns {Promise<{ ok: boolean, status: number, expired?: boolean, error?: string }>}
 */
export async function sendWebPush(subscription, payload, options = {}) {
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

    // 404 or 410 indicates the subscription is expired or uninstalled
    if (res.status === 404 || res.status === 410) {
      return { ok: false, status: res.status, expired: true, error: 'Subscription has expired or unsubscribed.' };
    }

    const errText = await res.text().catch(() => '');
    return { ok: false, status: res.status, error: `Push service rejected notification (${res.status}): ${errText}` };
  } catch (err) {
    return { ok: false, error: err.message || 'Network error delivering push notification.' };
  }
}

