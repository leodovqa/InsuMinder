package com.insuminder.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import androidx.annotation.NonNull;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * InsuMinder Firebase Cloud Messaging Service
 * Receives remote high-priority push notifications dispatched via Google FCM,
 * waking the device even when InsuMinder is completely closed or killed.
 */
public class InsuMinderMessagingService extends FirebaseMessagingService {

    private static final String TAG = "InsuMinderFCM";
    public static final String PREF_FCM_TOKEN = "fcm_device_token";
    private static final String PREFS_NAME = "insuminder_notifications_prefs";

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        Log.i(TAG, "New FCM Device Token generated: " + token);

        // Save token to SharedPreferences
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(PREF_FCM_TOKEN, token).apply();

        // Forward token to active WebView if running
        WebContainerActivity.notifyFcmTokenReceived(token);
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "FCM Message received from: " + remoteMessage.getFrom());

        String reminderId = null;
        String title = null;
        String body = null;
        String targetUrl = null;

        // 1. Check data payload (high priority data messages)
        Map<String, String> data = remoteMessage.getData();
        if (data != null && !data.isEmpty()) {
            reminderId = data.get("reminder_id");
            title = data.get("title");
            body = data.get("body");
            targetUrl = data.get("target_url");
        }

        // 2. Check notification payload fallback
        if (remoteMessage.getNotification() != null) {
            if (title == null || title.isEmpty()) {
                title = remoteMessage.getNotification().getTitle();
            }
            if (body == null || body.isEmpty()) {
                body = remoteMessage.getNotification().getBody();
            }
        }

        if (reminderId == null || reminderId.isEmpty()) {
            reminderId = "fcm-" + remoteMessage.getMessageId();
        }

        Log.i(TAG, "Dispatching notification via NotificationHelper: " + reminderId + " | " + title);
        NotificationHelper.displayNotification(this, reminderId, title, body, targetUrl);
    }
}

