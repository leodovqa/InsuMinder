import { resolveVapidKeys } from '../_webpush.js';

export async function onRequestGet(context) {
  const keys = await resolveVapidKeys(context?.env);
  return new Response(JSON.stringify({ publicKey: keys.publicKey }), {
    headers: { 'Content-Type': 'application/json' }
  });
}

