export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);

  const releaseApkUrl = 'https://github.com/leodovqa/InsuMinder/releases/latest/download/InsuMinder.apk';

  if (url.searchParams.get('info') === 'true') {
    return new Response(JSON.stringify({
      success: true,
      downloadUrl: releaseApkUrl,
      version: '1.8.0',
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
    const apkRes = await fetch(releaseApkUrl, { redirect: 'follow' });
    if (apkRes.ok && apkRes.body) {
      const headers = new Headers();
      headers.set('Content-Type', 'application/vnd.android.package-archive');
      headers.set('Content-Disposition', 'attachment; filename="InsuMinder.apk"');
      headers.set('Cache-Control', 'public, max-age=3600');
      const length = apkRes.headers.get('content-length');
      if (length) headers.set('Content-Length', length);

      return new Response(apkRes.body, {
        status: 200,
        headers
      });
    }
  } catch (err) {
    console.warn('[Download] Direct streaming failed, falling back to redirect:', err);
  }

  return Response.redirect(releaseApkUrl, 302);
}
