// functions/api/_fcm.js - Firebase Cloud Messaging (FCM HTTP v1) Dispatcher
// Pure Web Crypto implementation with zero external dependencies (Cloudflare Pages & Node.js 18+ compliant)

export function resolveFcmCredentials(env = null) {
  let raw = env?.FIREBASE_SERVICE_ACCOUNT;
  if (!raw && typeof process !== 'undefined' && process.env) {
    raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  }
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    console.error('[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e);
    return null;
  }
}

function base64UrlEncode(bufferOrString) {
  let bytes;
  if (typeof bufferOrString === 'string') {
    bytes = new TextEncoder().encode(bufferOrString);
  } else if (bufferOrString instanceof Uint8Array) {
    bytes = bufferOrString;
  } else {
    bytes = new Uint8Array(bufferOrString);
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function pemToArrayBuffer(pem) {
  const b64 = pem.replace(/-----[A-Z ]+-----/g, '').replace(/\s+/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

let cachedAccessToken = null;
let tokenExpiresAt = 0;

export async function getFcmAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && now < tokenExpiresAt - 60) {
    return cachedAccessToken;
  }

  const keyBuffer = pemToArrayBuffer(creds.private_key);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: creds.client_email,
    sub: creds.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  }));

  const dataToSign = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, dataToSign);
  const jwt = `${header}.${payload}.${base64UrlEncode(signature)}`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || tokenData.error || 'Failed to acquire FCM OAuth2 token');
  }

  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = now + (tokenData.expires_in || 3600);
  return cachedAccessToken;
}

export async function sendFcmNotification(token, { reminderId, title, body, targetUrl } = {}, { env = null } = {}) {
  const creds = resolveFcmCredentials(env);
  if (!creds || !creds.project_id || !creds.client_email || !creds.private_key) {
    return { success: false, error: 'Firebase credentials not configured.' };
  }

  try {
    const accessToken = await getFcmAccessToken(creds);
    const fcmEndpoint = `https://fcm.googleapis.com/v1/projects/${creds.project_id}/messages:send`;

    const message = {
      token,
      data: {
        reminder_id: reminderId || 'insuminder-reminder',
        title: title || 'InsuMinder',
        body: body || '',
        target_url: targetUrl || 'https://insuminder.pages.dev/'
      },
      android: {
        priority: 'high',
        direct_boot_ok: true,
        notification: {
          title: title || 'InsuMinder',
          body: body || '',
          channel_id: 'insuminder_reminders',
          notification_priority: 'PRIORITY_MAX',
          default_sound: true,
          default_vibrate_timings: true
        }
      }
    };

    const res = await fetch(fcmEndpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message })
    });

    if (res.ok) {
      return { success: true };
    }

    const errData = await res.json().catch(() => ({}));
    const errMsg = errData.error?.message || `HTTP ${res.status}`;

    // Token unregistered or expired
    if (res.status === 404 || /unregistered|not found|invalid registration/i.test(errMsg)) {
      return { success: false, expired: true, error: errMsg };
    }

    return { success: false, error: errMsg };
  } catch (err) {
    console.error('[FCM] Error dispatching notification:', err);
    return { success: false, error: err.message };
  }
}

