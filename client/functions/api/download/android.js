export async function onRequestGet(context) {
  const { request } = context;
  const url = new URL(request.url);

  const releaseApkUrl = 'https://github.com/leodovqa/InsuMinder/releases/latest/download/InsuMinder.apk';

  if (url.searchParams.get('info') === 'true') {
    return new Response(JSON.stringify({
      success: true,
      downloadUrl: releaseApkUrl,
      version: '1.0.0',
      packageName: 'com.insuminder.app',
      name: 'InsuMinder.apk'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }

  return Response.redirect(releaseApkUrl, 302);
}

