package com.insuminder.app;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import androidx.browser.customtabs.CustomTabColorSchemeParams;
import androidx.browser.customtabs.CustomTabsIntent;
import java.util.List;

/**
 * InsuMinder Launcher Activity
 * Uses AndroidX Custom Tabs / Trusted Web Activity with native WebContainer fallback.
 * Live-updates seamlessly whenever the web app is deployed without requiring new APK downloads.
 */
public class MainActivity extends Activity {

    public static final String DEFAULT_URL = "https://insuminder.pages.dev?app=android";
    public static final int BRAND_COLOR = Color.parseColor("#0ea5e9");
    public static final int BRAND_DARK = Color.parseColor("#0284c7");
    public static final int BRAND_BG = Color.parseColor("#0f172a");

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Uri targetUri = resolveTargetUri(getIntent() != null ? getIntent().getData() : null);

        // Always launch native embedded WebContainer for standalone APK experience
        launchWebContainer(targetUri);
        finish();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        Uri targetUri = resolveTargetUri(intent != null ? intent.getData() : null);
        launchWebContainer(targetUri);
        finish();
    }

    private Uri resolveTargetUri(Uri rawUri) {
        if (rawUri == null) {
            return Uri.parse(DEFAULT_URL);
        }

        // Support custom scheme insuminder:// (e.g. insuminder://open?action=basal or insuminder://?action=basal)
        if ("insuminder".equalsIgnoreCase(rawUri.getScheme())) {
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

    private boolean hasCustomTabsSupport() {
        Intent serviceIntent = new Intent("android.support.customtabs.action.CustomTabsService");
        List<ResolveInfo> resolveInfoList = getPackageManager().queryIntentServices(serviceIntent, 0);
        return resolveInfoList != null && !resolveInfoList.isEmpty();
    }

    private void launchCustomTabs(Uri uri) {
        CustomTabColorSchemeParams params = new CustomTabColorSchemeParams.Builder()
                .setToolbarColor(BRAND_DARK)
                .setNavigationBarColor(BRAND_BG)
                .build();

        CustomTabsIntent customTabsIntent = new CustomTabsIntent.Builder()
                .setDefaultColorSchemeParams(params)
                .setShowTitle(false)
                .setUrlBarHidingEnabled(true)
                .build();

        customTabsIntent.intent.putExtra(Intent.EXTRA_REFERRER, Uri.parse("android-app://" + getPackageName()));
        customTabsIntent.launchUrl(this, uri);
    }

    private void launchWebContainer(Uri uri) {
        Intent intent = new Intent(this, WebContainerActivity.class);
        intent.setData(uri);
        intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        startActivity(intent);
    }
}

