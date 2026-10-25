// server/src/fcm.js - Firebase Cloud Messaging (FCM HTTP v1) Dispatcher for Node.js
const crypto = require('crypto');

function resolveFcmCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch (e) {
    console.error('[FCM] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON:', e);
    return null;
  }
}

function base64UrlEncode(bufferOrString) {
  let buf;
  if (typeof bufferOrString === 'string') {
    buf = Buffer.from(bufferOrString);
  } else {
    buf = Buffer.from(bufferOrString);
  }
  return buf.toString('base64url');
}

let cachedAccessToken = null;
let tokenExpiresAt = 0;

async function getFcmAccessToken(creds) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && now < tokenExpiresAt - 60) {
    return cachedAccessToken;
  }

  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: creds.client_email,
    sub: creds.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  }));

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(`${header}.${payload}`);
  const signature = sign.sign(creds.private_key, 'base64url');
  const jwt = `${header}.${payload}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`
  });

  const data = await res.json();
  if (!res.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Failed to acquire FCM OAuth2 token');
  }

  cachedAccessToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in || 3600);
  return cachedAccessToken;
}

async function sendFcmNotification(token, { reminderId, title, body, targetUrl } = {}) {
  const creds = resolveFcmCredentials();
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

    if (res.status === 404 || /unregistered|not found|invalid registration/i.test(errMsg)) {
      return { success: false, expired: true, error: errMsg };
    }

    return { success: false, error: errMsg };
  } catch (err) {
    console.error('[FCM] Error dispatching notification:', err);
    return { success: false, error: err.message };
  }
}

module.exports = {
  resolveFcmCredentials,
  getFcmAccessToken,
  sendFcmNotification
};

