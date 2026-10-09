import { ensureTablesExist } from '../_telegram.js';

export async function onRequestDelete(context) {
  try {
    const db = context.env.DB;
    if (!db) {
      return new Response(
        JSON.stringify({ success: false, error: "D1 database binding 'DB' not configured." }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    await ensureTablesExist(db);

    const id = parseInt(context.params.id, 10);
    if (isNaN(id)) {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid configuration ID.' }),
        { status: 400, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const target = await db
      .prepare("SELECT * FROM telegram_configs WHERE id = ?")
      .bind(id)
      .first();

    if (!target) {
      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      );
    }

    const wasDefault = Boolean(target.is_default);

    await db.prepare("DELETE FROM telegram_configs WHERE id = ?").bind(id).run();

    if (wasDefault) {
      // Promote the most recent remaining config to default
      await db.prepare(
        "UPDATE telegram_configs SET is_default = 1 WHERE id = (SELECT id FROM telegram_configs ORDER BY id DESC LIMIT 1)"
      ).run();
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    );
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

