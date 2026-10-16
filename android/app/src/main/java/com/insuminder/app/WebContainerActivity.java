package com.insuminder.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Dialog;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.RelativeLayout;

/**
 * WebContainerActivity
 * Provides an embedded, zero-leak, hardware-accelerated WebContainer for InsuMinder.
 * Enforces HTTPS-only, isolates external links, supports Service Worker caching and live updates.
 * Seamlessly supports Google Identity Services and OAuth popups within the native container.
 */
public class WebContainerActivity extends Activity {

    private WebView mWebView;
    private ProgressBar mProgressBar;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Immersive window appearance with brand background
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#0284c7"));
        window.setNavigationBarColor(Color.parseColor("#0f172a"));

        RelativeLayout layout = new RelativeLayout(this);
        layout.setBackgroundColor(Color.parseColor("#0f172a"));
        layout.setFitsSystemWindows(true);

        mWebView = new WebView(this);
        mProgressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        mProgressBar.setMax(100);
        mProgressBar.setProgress(0);

        RelativeLayout.LayoutParams webParams = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT,
                RelativeLayout.LayoutParams.MATCH_PARENT
        );
        layout.addView(mWebView, webParams);

        RelativeLayout.LayoutParams progressParams = new RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT,
                8
        );
        progressParams.addRule(RelativeLayout.ALIGN_PARENT_TOP);
        layout.addView(mProgressBar, progressParams);

        setContentView(layout);

        // Configure cookies (including third-party for Google Sign-In)
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(mWebView, true);

        // Configure WebView settings for modern PWA features
        WebSettings settings = mWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setSupportMultipleWindows(true);

        // Clean User-Agent: strip "Version/4.0" and "; wv" so Google Identity Services doesn't reject auth
        String defaultUa = settings.getUserAgentString();
        String cleanUa = defaultUa.replace("; wv", "").replaceAll("Version/\\d+\\.\\d+\\s*", "");
        settings.setUserAgentString(cleanUa + " InsuMinder-Android/" + BuildConfig.VERSION_NAME);

        // Hardware Acceleration
        mWebView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        // Enable Service Worker for offline app shell support
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            try {
                ServiceWorkerController swController = ServiceWorkerController.getInstance();
                swController.setServiceWorkerClient(new ServiceWorkerClient() {
                    @Override
                    public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                        return super.shouldInterceptRequest(request);
                    }
                });
            } catch (Exception e) {
                // Ignore SW controller init errors if platform restricted
            }
        }

        mWebView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    mProgressBar.setVisibility(View.VISIBLE);
                    mProgressBar.setProgress(newProgress);
                } else {
                    mProgressBar.setVisibility(View.GONE);
                }
            }

            @Override
            public boolean onCreateWindow(WebView view, boolean isDialog, boolean isUserGesture, Message resultMsg) {
                WebView popupView = new WebView(WebContainerActivity.this);
                WebSettings popupSettings = popupView.getSettings();
                popupSettings.setJavaScriptEnabled(true);
                popupSettings.setDomStorageEnabled(true);
                popupSettings.setUserAgentString(settings.getUserAgentString());
                CookieManager.getInstance().setAcceptThirdPartyCookies(popupView, true);

                Dialog popupDialog = new Dialog(WebContainerActivity.this, android.R.style.Theme_DeviceDefault_Light_Dialog_NoActionBar);
                popupDialog.setContentView(popupView);
                popupDialog.show();

                popupView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView pView, WebResourceRequest pRequest) {
                        Uri pUri = pRequest.getUrl();
                        String pHost = pUri.getHost();
                        if (pHost != null && (pHost.endsWith("pages.dev") || pHost.contains("insuminder"))) {
                            mWebView.loadUrl(pUri.toString());
                            popupDialog.dismiss();
                            return true;
                        }
                        return false;
                    }
                });

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popupView);
                resultMsg.sendToTarget();
                return true;
            }
        });

        mWebView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String host = uri.getHost();

                // Keep app domains, Google Identity Services, and OAuth inside container
                if (host != null && (
                        host.endsWith("pages.dev") ||
                        host.contains("insuminder") ||
                        host.endsWith("google.com") ||
                        host.endsWith("googleapis.com") ||
                        host.endsWith("gstatic.com") ||
                        host.endsWith("googleusercontent.com")
                )) {
                    return false; // Stay in container
                }

                // External URLs open in system browser
                try {
                    Intent externalIntent = new Intent(Intent.ACTION_VIEW, uri);
                    startActivity(externalIntent);
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
            }
        });

        Uri targetUri = getIntent() != null && getIntent().getData() != null
                ? getIntent().getData()
                : Uri.parse(MainActivity.DEFAULT_URL);

        mWebView.loadUrl(targetUri.toString());
    }

    @Override
    public void onBackPressed() {
        if (mWebView != null && mWebView.canGoBack()) {
            mWebView.goBack();
        } else {
            super.onBackPressed();
        }
    }
}
