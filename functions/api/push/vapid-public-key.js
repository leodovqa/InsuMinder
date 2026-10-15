import { VAPID_PUBLIC_KEY } from '../_webpush.js';

export async function onRequestGet() {
  return new Response(JSON.stringify({ publicKey: VAPID_PUBLIC_KEY }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

