package com.insuminder.app;

import com.insuminder.app.BuildConfig;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Dialog;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.AlarmManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Message;
import android.provider.Settings;
import android.util.Log;
import android.view.KeyEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.PermissionRequest;
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
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.tasks.Task;

/**
 * WebContainerActivity
 * Provides an embedded, zero-leak, hardware-accelerated WebContainer for InsuMinder.
 * Enforces HTTPS-only, isolates external links, supports Service Worker caching and live updates.
 * Seamlessly supports Google Identity Services and OAuth popups within the native container.
 */
public class WebContainerActivity extends androidx.appcompat.app.AppCompatActivity {

    public static final int RC_GOOGLE_SIGN_IN = 9001;
    public static final int RC_POST_NOTIFICATIONS = 9002;
    public static final String NOTIFICATION_CHANNEL_ID = "insuminder_reminders";
    public static final String NOTIFICATION_CHANNEL_NAME = "InsuMinder Reminders";
    public static final String DEFAULT_WEB_CLIENT_ID = "49202391060-u2o79b29r36940t0ep9p8b7g6prm9d2q.apps.googleusercontent.com";

    private WebView mWebView;
    private ProgressBar mProgressBar;
    private GoogleSignInClient mGoogleSignInClient;
    private String mCurrentClientId = "";
    private Runnable mPendingNotificationAfterPermission = null;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Immersive window appearance with brand background
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(Color.parseColor("#0284c7"));
        window.setNavigationBarColor(Color.parseColor("#0f172a"));

        // Initialize high-priority notification channel for dose reminders
        createNotificationChannel();

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
            public void onCloseWindow(WebView window) {
                super.onCloseWindow(window);
                finishAffinity();
            }

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
            public void onPermissionRequest(final PermissionRequest request) {
                if (request == null) return;
                runOnUiThread(() -> {
                    try {
                        request.grant(request.getResources());
                    } catch (Exception e) {
                        // Ignore
                    }
                });
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

                popupView.setDownloadListener((url, userAgent1, contentDisposition, mimetype, contentLength) -> {
                    try {
                        Intent downloadIntent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        downloadIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(downloadIntent);
                    } catch (Exception e) {
                        Log.w("InsuMinder", "Failed to launch external download from popup: " + e.getMessage());
                    }
                    popupDialog.dismiss();
                });

                popupView.setWebViewClient(new WebViewClient() {
                    @Override
                    public boolean shouldOverrideUrlLoading(WebView pView, WebResourceRequest pRequest) {
                        // insuminder://exit from popup
                        Uri pUriCheck = pRequest.getUrl();
                        if (pUriCheck != null && "insuminder".equalsIgnoreCase(pUriCheck.getScheme())) {
                            if ("exit".equalsIgnoreCase(pUriCheck.getHost()) || pUriCheck.toString().contains("action=exit") || pUriCheck.toString().contains("insuminder://exit")) {
                                popupDialog.dismiss();
                                finishAffinity();
                                return true;
                            }
                        }
                        Uri pUri = pRequest.getUrl();
                        if (pUri != null && (
                                pUri.toString().endsWith(".apk") ||
                                (pUri.getPath() != null && (pUri.getPath().contains("/download") || pUri.getPath().contains("/releases/")))
                        )) {
                            try {
                                Intent downloadIntent = new Intent(Intent.ACTION_VIEW, pUri);
                                downloadIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(downloadIntent);
                            } catch (Exception e) {
                                Log.w("InsuMinder", "Failed to launch external download from popup: " + e.getMessage());
                            }
                            popupDialog.dismiss();
                            return true;
                        }
                        String pHost = pUri != null ? pUri.getHost() : null;
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

                // insuminder://exit from main webview
                if (uri != null && "insuminder".equalsIgnoreCase(uri.getScheme())) {
                    if ("exit".equalsIgnoreCase(uri.getHost()) || uri.toString().contains("action=exit") || uri.toString().contains("insuminder://exit")) {
                        finishAffinity();
                        return true;
                    }
                }

                                // Direct APK and release downloads open in external system browser/installer
                if (uri != null && (
                        uri.toString().endsWith(".apk") ||
                        (uri.getPath() != null && (uri.getPath().contains("/download") || uri.getPath().contains("/releases/")))
                )) {
                    try {
                        Intent downloadIntent = new Intent(Intent.ACTION_VIEW, uri);
                        downloadIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                        startActivity(downloadIntent);
                        return true;
                    } catch (Exception e) {
                        Log.w("InsuMinder", "Failed to launch external download: " + e.getMessage());
                    }
                }

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

                // Parse intent:// URIs directly to Android Intent
                if (uri != null && "intent".equalsIgnoreCase(uri.getScheme())) {
                    try {
                        Intent parsedIntent = Intent.parseUri(uri.toString(), Intent.URI_INTENT_SCHEME);
                        if (parsedIntent != null) {
                            startActivity(parsedIntent);
                            return true;
                        }
                    } catch (Exception e) {
                        Log.w("InsuMinder", "Failed to parse intent URI: " + e.getMessage());
                    }
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

        targetUri = resolveTargetUri(targetUri);
        mWebView.loadUrl(targetUri.toString());

        getOnBackPressedDispatcher().addCallback(this, new androidx.activity.OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                handleBackPressed();
            }
        });

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,
                this::handleBackPressed
            );
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        if (intent != null && intent.getData() != null) {
            Uri targetUri = resolveTargetUri(intent.getData());
            if (mWebView != null) {
                mWebView.loadUrl(targetUri.toString());
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        notifyNotificationPermissionResult(hasNotificationPermission());
        if (mWebView != null) {
            runOnUiThread(() -> mWebView.evaluateJavascript("window.__onNativeResume && window.__onNativeResume();", null));
        }
    }

    private Uri resolveTargetUri(Uri rawUri) {
        if (rawUri == null) {
            return Uri.parse(MainActivity.DEFAULT_URL);
        }

        // Support custom scheme insuminder:// (e.g. insuminder://open?action=basal or insuminder://?action=basal)
        if ("insuminder".equalsIgnoreCase(rawUri.getScheme())) {
            // insuminder exit in resolveTargetUri
            if ("exit".equalsIgnoreCase(rawUri.getHost()) || rawUri.toString().contains("action=exit") || rawUri.toString().contains("insuminder://exit")) {
                finishAffinity();
                return rawUri;
            }
            String query = rawUri.getEncodedQuery();
            String path = rawUri.getPath() != null ? rawUri.getPath() : "";
            if (path.startsWith("/open")) {
                path = path.substring(5);
            }
            String url = "https://insuminder.pages.dev" + path + (query != null ? "?" + query : "");
            rawUri = Uri.parse(url);
        }

        // Ensure ?app=android query parameter is present so web app identifies native container
        if (rawUri.getQueryParameter("app") == null) {
            rawUri = rawUri.buildUpon().appendQueryParameter("app", "android").build();
        }

        return rawUri;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    NOTIFICATION_CHANNEL_ID,
                    NOTIFICATION_CHANNEL_NAME,
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("Insulin dose reminders and notifications");
            channel.enableLights(true);
            channel.setLightColor(Color.parseColor("#0ea5e9"));
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 300, 200, 300});
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    public boolean hasNotificationPermission() {
        NotificationManagerCompat managerCompat = NotificationManagerCompat.from(this);
        if (!managerCompat.areNotificationsEnabled()) {
            return false;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
        }
        return true;
    }

    private boolean isXiaomiDevice() {
        return "xiaomi".equalsIgnoreCase(Build.MANUFACTURER) ||
               "xiaomi".equalsIgnoreCase(Build.BRAND) ||
               "redmi".equalsIgnoreCase(Build.BRAND) ||
               "poco".equalsIgnoreCase(Build.BRAND);
    }

    public void requestNotificationPermission() {
        if (hasNotificationPermission()) {
            notifyNotificationPermissionResult(true);
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                try {
                    requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, RC_POST_NOTIFICATIONS);
                    return;
                } catch (Exception ignored) {}
            }
        }

        notifyNotificationPermissionResult(hasNotificationPermission());
    }

    public void openAppNotificationSettings() {
        runOnUiThread(() -> {
            if (isXiaomiDevice()) {
                // On Xiaomi HyperOS / MIUI, ACTION_APPLICATION_DETAILS_SETTINGS (App Info)
                // is the only intent guaranteed to bypass Xiaomi's security manager restrictions
                // and directly expose the notification and permission toggles.
                try {
                    Intent appInfoIntent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    appInfoIntent.setData(Uri.fromParts("package", getPackageName(), null));
                    appInfoIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(appInfoIntent);
                    return;
                } catch (Exception e) {
                    Log.w("InsuMinder", "Xiaomi ACTION_APPLICATION_DETAILS_SETTINGS failed: " + e.getMessage());
                }

                try {
                    Intent permIntent = new Intent("miui.intent.action.APP_PERM_EDITOR");
                    permIntent.setClassName("com.miui.securitycenter", "com.miui.permcenter.permissions.PermissionsEditorActivity");
                    permIntent.putExtra("extra_pkgname", getPackageName());
                    permIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(permIntent);
                    return;
                } catch (Exception ignored) {
                }
            }

            // Standard Android 8.0+ Notification Settings (Samsung, Pixel, OnePlus, etc.)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                try {
                    Intent intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                    return;
                } catch (Exception e) {
                    Log.w("InsuMinder", "ACTION_APP_NOTIFICATION_SETTINGS failed: " + e.getMessage());
                }
            }

            // Universal Fallback: Application Details Settings (App Info page)
            try {
                Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                fallback.setData(Uri.fromParts("package", getPackageName(), null));
                fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(fallback);
            } catch (Exception e) {
                Log.e("InsuMinder", "ACTION_APPLICATION_DETAILS_SETTINGS failed: " + e.getMessage());
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == RC_POST_NOTIFICATIONS) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED && NotificationManagerCompat.from(this).areNotificationsEnabled();
            notifyNotificationPermissionResult(granted);
            if (granted) {
                if (mPendingNotificationAfterPermission != null) {
                    Runnable action = mPendingNotificationAfterPermission;
                    mPendingNotificationAfterPermission = null;
                    action.run();
                }
            }
        }
    }

    private void notifyNotificationPermissionResult(boolean granted) {
        if (mWebView == null) return;
        runOnUiThread(() -> mWebView.evaluateJavascript("window.__onNativeNotificationPermissionResult && window.__onNativeNotificationPermissionResult(" + granted + ");", null));
    }

    public void showNativeNotification(String title, String body, String tag, String targetUrl) {
        if (!hasNotificationPermission()) {
            mPendingNotificationAfterPermission = () -> showNativeNotification(title, body, tag, targetUrl);
            requestNotificationPermission();
            return;
        }

        createNotificationChannel();

        String destination = (targetUrl != null && !targetUrl.trim().isEmpty())
                ? targetUrl.trim()
                : "https://insuminder.pages.dev/";

        if (!destination.startsWith("http://") && !destination.startsWith("https://") && !destination.startsWith("insuminder://")) {
            if (destination.startsWith("/")) {
                destination = "https://insuminder.pages.dev" + destination;
            } else {
                destination = "https://insuminder.pages.dev/" + destination;
            }
        }

        if (!destination.contains("app=android")) {
            destination = destination + (destination.contains("?") ? "&" : "?") + "app=android";
        }

        Intent intent = new Intent(this, WebContainerActivity.class);
        intent.setData(Uri.parse(destination));
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int requestCode = tag != null ? Math.abs(tag.hashCode()) : (int) System.currentTimeMillis();
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(this, requestCode, intent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_insuminder)
                .setContentTitle(title != null && !title.trim().isEmpty() ? title : "InsuMinder")
                .setContentText(body != null ? body : "")
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setColor(Color.parseColor("#0ea5e9"));

        try {
            Bitmap largeIcon = BitmapFactory.decodeResource(getResources(), R.drawable.ic_launcher_foreground);
            if (largeIcon != null) {
                builder.setLargeIcon(largeIcon);
            }
        } catch (Exception ignored) {
        }

        if (destination.contains("action=basal")) {
            builder.addAction(R.drawable.ic_stat_insuminder, "💉 Log Basal", pendingIntent);
        }

        NotificationManagerCompat managerCompat = NotificationManagerCompat.from(this);
        try {
            managerCompat.notify(tag != null ? tag : "insuminder_reminder", requestCode, builder.build());
        } catch (Exception e) {
            Log.e("InsuMinder", "Failed to post notification", e);
        }
    }

    public void scheduleNativeReminder(String reminderId, String title, String body, long triggerAtMillis, String targetUrl) {
        if (reminderId == null || triggerAtMillis <= System.currentTimeMillis()) return;
        try {
            AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent intent = new Intent(this, ReminderReceiver.class);
            intent.setAction(ReminderReceiver.ACTION_REMINDER);
            intent.putExtra(ReminderReceiver.EXTRA_REMINDER_ID, reminderId);
            intent.putExtra(ReminderReceiver.EXTRA_TITLE, title);
            intent.putExtra(ReminderReceiver.EXTRA_BODY, body);
            intent.putExtra(ReminderReceiver.EXTRA_TARGET_URL, targetUrl);

            int requestCode = Math.abs(reminderId.hashCode());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(this, requestCode, intent, flags);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                if (alarmManager.canScheduleExactAlarms()) {
                    alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                } else {
                    alarmManager.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            } else {
                alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAtMillis, pendingIntent);
            }
        } catch (Exception e) {
            Log.e("InsuMinder", "scheduleNativeReminder failed: " + e.getMessage());
        }
    }

    public void cancelNativeReminder(String reminderId) {
        if (reminderId == null) return;
        try {
            AlarmManager alarmManager = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (alarmManager == null) return;

            Intent intent = new Intent(this, ReminderReceiver.class);
            intent.setAction(ReminderReceiver.ACTION_REMINDER);
            int requestCode = Math.abs(reminderId.hashCode());
            int flags = PendingIntent.FLAG_NO_CREATE;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(this, requestCode, intent, flags);
            if (pendingIntent != null) {
                alarmManager.cancel(pendingIntent);
                pendingIntent.cancel();
            }
        } catch (Exception e) {
            Log.e("InsuMinder", "cancelNativeReminder failed: " + e.getMessage());
        }
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
        public String getNativeVersion() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
            } catch (Exception e) {
                return "2.0.0";
            }
        }

        @JavascriptInterface
        public int getNativeVersionCode() {
            try {
                return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode;
            } catch (Exception e) {
                return 23;
            }
        }

        @JavascriptInterface
        public void exitApp() {
            runOnUiThread(() -> {
                try {
                    finishAffinity();
                } catch (Exception e) {
                    finish();
                }
            });
        }

        @JavascriptInterface
        public void downloadApk(String url) {
            runOnUiThread(() -> {
                try {
                    String targetUrl = (url != null && !url.trim().isEmpty())
                            ? url.trim()
                            : "https://github.com/leodovqa/InsuMinder/releases/latest/download/InsuMinder.apk";
                    Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(targetUrl));
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(i);
                } catch (Exception e) {
                    Log.w("InsuMinder", "Native downloadApk failed: " + e.getMessage());
                }
            });
        }
        @JavascriptInterface
        public boolean isNativeAndroid() {
            return true;
        }

        @JavascriptInterface
        public boolean isNotificationPermissionGranted() {
            return hasNotificationPermission();
        }

        @JavascriptInterface
        public boolean isNotificationPermissionBlocked() {
            if (hasNotificationPermission()) return false;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                return !shouldShowRequestPermissionRationale(android.Manifest.permission.POST_NOTIFICATIONS);
            }
            return !NotificationManagerCompat.from(WebContainerActivity.this).areNotificationsEnabled();
        }

        @JavascriptInterface
        public void requestNotificationPermission() {
            runOnUiThread(() -> WebContainerActivity.this.requestNotificationPermission());
        }

        @JavascriptInterface
        public void openNotificationSettings() {
            runOnUiThread(() -> WebContainerActivity.this.openAppNotificationSettings());
        }

        @JavascriptInterface
        public void postNativeNotification(String title, String body, String tag, String targetUrl) {
            runOnUiThread(() -> showNativeNotification(title, body, tag, targetUrl));
        }

        @JavascriptInterface
        public void scheduleNativeReminder(String reminderId, String title, String body, long triggerAtMillis, String targetUrl) {
            runOnUiThread(() -> WebContainerActivity.this.scheduleNativeReminder(reminderId, title, body, triggerAtMillis, targetUrl));
        }

        @JavascriptInterface
        public void cancelNativeReminder(String reminderId) {
            runOnUiThread(() -> WebContainerActivity.this.cancelNativeReminder(reminderId));
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
                            try {
                                Intent signInIntent = mGoogleSignInClient.getSignInIntent();
                                startActivityForResult(signInIntent, RC_GOOGLE_SIGN_IN);
                            } catch (Exception e) {
                                notifyGoogleSignInError(e.getMessage() != null ? e.getMessage() : "Failed to launch Google Sign-In");
                            }
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
                } else if (e.getStatusCode() == CommonStatusCodes.DEVELOPER_ERROR) {
                    notifyGoogleSignInError("Google Sign-In configuration error (Developer Error 10). Android SHA-1 certificate fingerprint needs to be registered in Google Cloud Console.");
                } else {
                    String rawMsg = e.getMessage();
                    String errorMsg = (rawMsg != null && !rawMsg.trim().equals(e.getStatusCode() + ":") && !rawMsg.trim().isEmpty())
                            ? rawMsg
                            : "Google Sign-In failed (Status code: " + e.getStatusCode() + ")";
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
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getKeyCode() == KeyEvent.KEYCODE_BACK) {
            if (event.getAction() == KeyEvent.ACTION_UP) {
                handleBackPressed();
            }
            return true;
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public boolean onKeyDown(int keyCode, KeyEvent event) {
        if (keyCode == KeyEvent.KEYCODE_BACK) {
            handleBackPressed();
            return true;
        }
        return super.onKeyDown(keyCode, event);
    }

    @Override
    public void onBackPressed() {
        handleBackPressed();
    }

    private void handleBackPressed() {
        if (mWebView != null) {
            runOnUiThread(() -> mWebView.evaluateJavascript("window.__onNativeBackPressed ? window.__onNativeBackPressed() : false;", null));
        }
    }
}
