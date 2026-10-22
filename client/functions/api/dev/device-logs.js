// In-memory telemetry buffer for device logs in edge worker
const telemetryBuffer = [];
const MAX_LOGS = 50;

export async function onRequestPost(context) {
  const { request } = context;
  try {
    const body = await request.json().catch(() => ({}));
    const entry = {
      receivedAt: new Date().toISOString(),
      userAgent: request.headers.get('user-agent') || 'unknown',
      source: body.source || 'unknown',
      report: body.report || null
    };

    telemetryBuffer.unshift(entry);
    if (telemetryBuffer.length > MAX_LOGS) {
      telemetryBuffer.pop();
    }

    return new Response(JSON.stringify({ success: true, count: telemetryBuffer.length }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestGet() {
  return new Response(JSON.stringify({ success: true, logs: telemetryBuffer }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}

