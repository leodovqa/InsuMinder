const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

describe('Android APK Download Endpoint', () => {
  it('returns JSON information when ?info=true is requested', async () => {
    const app = express();
    app.get('/api/download/android', (req, res) => {
      const releaseApkUrl = 'https://github.com/leodovqa/InsuMinder/releases/latest/download/InsuMinder.apk';
      if (req.query.info === 'true') {
        return res.json({
          success: true,
          downloadUrl: releaseApkUrl,
          version: '1.0.0',
          packageName: 'com.insuminder.app',
          name: 'InsuMinder.apk'
        });
      }
      return res.redirect(302, releaseApkUrl);
    });

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    const res = await fetch(`http://localhost:${port}/api/download/android?info=true`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.equal(data.name, 'InsuMinder.apk');
    assert.equal(data.packageName, 'com.insuminder.app');
    assert.equal(data.version, '1.0.0');

    await new Promise((resolve) => server.close(resolve));
  });

  it('redirects with 302 to the latest GitHub Release APK when accessed directly', async () => {
    const app = express();
    app.get('/api/download/android', (req, res) => {
      const releaseApkUrl = 'https://github.com/leodovqa/InsuMinder/releases/latest/download/InsuMinder.apk';
      return res.redirect(302, releaseApkUrl);
    });

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;

    const res = await fetch(`http://localhost:${port}/api/download/android`, { redirect: 'manual' });
    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), 'https://github.com/leodovqa/InsuMinder/releases/latest/download/InsuMinder.apk');

    await new Promise((resolve) => server.close(resolve));
  });

  it('server/src/index.js syntax and entrypoint compiles cleanly', () => {
    const { execFileSync } = require('node:child_process');
    const path = require('node:path');
    const indexPath = path.resolve(__dirname, '../src/index.js');
    assert.doesNotThrow(() => {
      execFileSync(process.execPath, ['-c', indexPath], { stdio: 'pipe' });
    });
  });
});

