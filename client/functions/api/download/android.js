export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);

  const releaseApkUrl = 'https://github.com/leodovqa/InsuMinder/releases/latest/download/InsuMinder.apk';

  if (url.searchParams.get('info') === 'true') {
    return new Response(JSON.stringify({
      success: true,
      downloadUrl: releaseApkUrl,
      version: '2.3.0',
      packageName: 'com.insuminder.app',
      name: 'InsuMinder.apk',
      sha256Url: 'https://github.com/leodovqa/InsuMinder/releases/latest/download/InsuMinder.apk.sha256',
      signature: 'Android Scheme v2/v3 Verified',
      verified: true
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }

  try {
    const upstreamRes = await fetch(releaseApkUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'InsuMinder-Cloudflare-Worker'
      }
    });

    if (!upstreamRes.ok) {
      return Response.redirect(releaseApkUrl, 302);
    }

    const headers = new Headers(upstreamRes.headers);
    headers.set('Content-Type', 'application/vnd.android.package-archive');
    headers.set('Content-Disposition', 'attachment; filename="InsuMinder.apk"');
    headers.set('Cache-Control', 'public, max-age=3600');

    return new Response(upstreamRes.body, {
      status: upstreamRes.status,
      headers
    });
  } catch (err) {
    void err;
    return Response.redirect(releaseApkUrl, 302);
  }
}
