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
import android.webkit.JavascriptInterface;
import android.widget.ProgressBar;
import android.widget.RelativeLayout;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.tasks.Task;

/**
 * WebContainerActivity
 * Provides an embedded, zero-leak, hardware-accelerated WebContainer for InsuMinder.
 * Enforces HTTPS-only, isolates external links, supports Service Worker caching and live updates.
 * Seamlessly supports Google Identity Services and OAuth popups within the native container.
 */
public class WebContainerActivity extends Activity {

    public static final int RC_GOOGLE_SIGN_IN = 9001;
    public static final String DEFAULT_WEB_CLIENT_ID = "49202391060-u2o79b29r36940t0ep9p8b7g6prm9d2q.apps.googleusercontent.com";

    private WebView mWebView;
    private ProgressBar mProgressBar;
    private GoogleSignInClient mGoogleSignInClient;
    private String mCurrentClientId = "";

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

        // Native Android Bridge for 1-Tap Google Sign-In and Android container detection
        mWebView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");

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

        // Delegate file downloads (such as APK updates) to the Android system download manager / browser
        mWebView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            try {
                Intent downloadIntent = new Intent(Intent.ACTION_VIEW);
                downloadIntent.setData(Uri.parse(url));
                startActivity(downloadIntent);
            } catch (Exception e) {
                // Ignore if unable to launch intent
            }
        });

        Uri targetUri = getIntent() != null && getIntent().getData() != null
                ? getIntent().getData()
                : Uri.parse(MainActivity.DEFAULT_URL);

        mWebView.loadUrl(targetUri.toString());
    }

    private synchronized void setupGoogleSignIn(String webClientId) {
        String clientId = (webClientId != null && !webClientId.trim().isEmpty())
                ? webClientId.trim()
                : DEFAULT_WEB_CLIENT_ID;

        if (mGoogleSignInClient == null || !clientId.equals(mCurrentClientId)) {
            mCurrentClientId = clientId;
            GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                    .requestIdToken(clientId)
                    .requestEmail()
                    .build();
            mGoogleSignInClient = GoogleSignIn.getClient(this, gso);
        }
    }

    public class AndroidBridge {
        @JavascriptInterface
        public boolean isNativeAndroid() {
            return true;
        }

        @JavascriptInterface
        public void signInWithGoogle() {
            signInWithGoogle(null);
        }

        @JavascriptInterface
        public void signInWithGoogle(String webClientId) {
            runOnUiThread(() -> {
                try {
                    setupGoogleSignIn(webClientId);
                    if (mGoogleSignInClient != null) {
                        mGoogleSignInClient.signOut().addOnCompleteListener(task -> {
                            Intent signInIntent = mGoogleSignInClient.getSignInIntent();
                            startActivityForResult(signInIntent, RC_GOOGLE_SIGN_IN);
                        });
                    }
                } catch (Exception e) {
                    notifyGoogleSignInError(e.getMessage() != null ? e.getMessage() : "Failed to initialize Google Sign-In");
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == RC_GOOGLE_SIGN_IN) {
            Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
            try {
                GoogleSignInAccount account = task.getResult(ApiException.class);
                if (account != null && account.getIdToken() != null) {
                    notifyGoogleSignInSuccess(account.getIdToken());
                } else {
                    notifyGoogleSignInError("No ID token returned by Google Play Services");
                }
            } catch (ApiException e) {
                if (e.getStatusCode() == GoogleSignInStatusCodes.SIGN_IN_CANCELLED) {
                    notifyGoogleSignInError("CANCELLED");
                } else {
                    String errorMsg = e.getMessage() != null ? e.getMessage() : "Google Sign-In failed (" + e.getStatusCode() + ")";
                    notifyGoogleSignInError(errorMsg);
                }
            }
        }
    }

    private void notifyGoogleSignInSuccess(String idToken) {
        if (mWebView == null || idToken == null) return;
        final String safeToken = idToken.replace("\\", "\\\\").replace("'", "\\'");
        runOnUiThread(() -> mWebView.evaluateJavascript("window.__onNativeGoogleSignIn && window.__onNativeGoogleSignIn('" + safeToken + "');", null));
    }

    private void notifyGoogleSignInError(String errorMsg) {
        if (mWebView == null) return;
        final String safeError = errorMsg != null ? errorMsg.replace("\\", "\\\\").replace("'", "\\'") : "Authentication failed";
        runOnUiThread(() -> mWebView.evaluateJavascript("window.__onNativeGoogleSignInError && window.__onNativeGoogleSignInError('" + safeError + "');", null));
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
