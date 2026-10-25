import { ensureTablesExist } from '../_telegram.js';
import { getAuthUser } from '../_auth.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  if (!db) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding (DB) is missing.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  await ensureTablesExist(db);

  try {
    const authUser = await getAuthUser(request, env);
    if (!authUser) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized. Please sign in.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('q');
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '20', 10) || 20, 1), 100);

    let rows;
    if (search && search.trim().length > 0) {
      const term = `%${search.trim().toLowerCase()}%`;
      const res = await db.prepare(
        `SELECT id, user_id, name, carbs_per_100g, created_at, updated_at
         FROM saved_foods
         WHERE user_id = ? AND LOWER(name) LIKE ?
         ORDER BY updated_at DESC
         LIMIT ?`
      ).bind(authUser.userId, term, limit).all();
      rows = res.results || [];
    } else {
      const res = await db.prepare(
        `SELECT id, user_id, name, carbs_per_100g, created_at, updated_at
         FROM saved_foods
         WHERE user_id = ?
         ORDER BY updated_at DESC
         LIMIT ?`
      ).bind(authUser.userId, limit).all();
      rows = res.results || [];
    }

    return new Response(JSON.stringify({ success: true, foods: rows }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[API] Error in GET /api/foods:', err);
    return new Response(JSON.stringify({ success: false, error: err.message || 'Internal server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  if (!db) {
    return new Response(JSON.stringify({ success: false, error: 'Database binding (DB) is missing.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  await ensureTablesExist(db);

  try {
    const authUser = await getAuthUser(request, env);
    if (!authUser) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized. Please sign in.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json().catch(() => ({}));
    const trimmedName = (body.name || '').trim();
    const carbs = parseFloat(body.carbsPer100g);

    if (!trimmedName) {
      return new Response(JSON.stringify({ success: false, error: 'Food name is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    if (isNaN(carbs) || carbs < 0 || carbs > 1000) {
      return new Response(JSON.stringify({ success: false, error: 'Valid carbohydrates value (0-1000) is required.' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const now = new Date().toISOString();
    const insertRes = await db.prepare(
      `INSERT INTO saved_foods (user_id, name, carbs_per_100g, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(authUser.userId, trimmedName, carbs, now, now).run();

    const newFood = {
      id: insertRes.meta?.last_row_id || insertRes.lastRowId,
      user_id: authUser.userId,
      name: trimmedName,
      carbs_per_100g: carbs,
      created_at: now,
      updated_at: now
    };

    return new Response(JSON.stringify({ success: true, food: newFood }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('[API] Error in POST /api/foods:', err);
    return new Response(JSON.stringify({ success: false, error: err.message || 'Internal server error.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

