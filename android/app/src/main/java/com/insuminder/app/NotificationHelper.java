package com.insuminder.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.List;

/**
 * Shared Notification Helper for InsuMinder
 * Centralizes notification channel setup, deduplication between local alarms and FCM,
 * and persistent storage of active schedules for boot recovery.
 */
public class NotificationHelper {

    public static final String NOTIFICATION_CHANNEL_ID = "insuminder_reminders";
    public static final String NOTIFICATION_CHANNEL_NAME = "InsuMinder Reminders";
    private static final String PREFS_NAME = "insuminder_notifications_prefs";
    private static final String PREF_SCHEDULES_JSON = "active_reminder_schedules";
    private static final String TAG = "InsuMinderNotification";

    public static void createNotificationChannel(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null && manager.getNotificationChannel(NOTIFICATION_CHANNEL_ID) == null) {
                NotificationChannel channel = new NotificationChannel(
                        NOTIFICATION_CHANNEL_ID,
                        NOTIFICATION_CHANNEL_NAME,
                        NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Scheduled insulin injection reminders and glucose checks");
                channel.enableLights(true);
                channel.setLightColor(Color.parseColor("#0ea5e9"));
                channel.enableVibration(true);
                channel.setShowBadge(true);
                channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                manager.createNotificationChannel(channel);
            }
        }
    }

    /**
     * Deduplication guard: returns true if the reminder was NOT shown recently (within cooldownMs).
     */
    public static synchronized boolean shouldDisplayNotification(Context context, String reminderId, long cooldownMs) {
        if (context == null || reminderId == null) return true;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        long lastTime = prefs.getLong("last_alert_" + reminderId, 0);
        long now = System.currentTimeMillis();

        if (now - lastTime < cooldownMs) {
            Log.d(TAG, "Suppressed duplicate notification for reminderId: " + reminderId + " (shown " + (now - lastTime) + "ms ago)");
            return false;
        }

        prefs.edit().putLong("last_alert_" + reminderId, now).apply();
        return true;
    }

    /**
     * Unified Notification Poster: used by both local alarms and remote FCM.
     */
    public static void displayNotification(Context context, String reminderId, String title, String body, String targetUrl) {
        if (context == null) return;

        NotificationManagerCompat managerCompat = NotificationManagerCompat.from(context);
        if (!managerCompat.areNotificationsEnabled()) {
            Log.w(TAG, "Cannot post notification: notifications disabled by user in OS settings");
            return;
        }

        String safeId = reminderId != null ? reminderId : "insuminder-alert-" + System.currentTimeMillis();

        // 60-second duplicate suppression between AlarmManager and FCM
        if (!shouldDisplayNotification(context, safeId, 60000L)) {
            return;
        }

        createNotificationChannel(context);

        String finalTitle = (title != null && !title.trim().isEmpty()) ? title : "🔔 InsuMinder";
        String finalBody = (body != null && !body.trim().isEmpty()) ? body : "You have an insulin dose reminder.";

        String destination = (targetUrl != null && !targetUrl.trim().isEmpty()) ? targetUrl : "https://insuminder.pages.dev/";
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

        Intent openIntent = new Intent(context, WebContainerActivity.class);
        openIntent.setData(Uri.parse(destination));
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int requestCode = Math.abs(safeId.hashCode());
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(context, requestCode, openIntent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_insuminder)
                .setContentTitle(finalTitle)
                .setContentText(finalBody)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(finalBody))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setOnlyAlertOnce(true) // Guarantees zero double-ringing if updated
                .setContentIntent(pendingIntent)
                .setColor(Color.parseColor("#0ea5e9"));

        try {
            Bitmap largeIcon = BitmapFactory.decodeResource(context.getResources(), R.drawable.ic_launcher_foreground);
            if (largeIcon != null) {
                builder.setLargeIcon(largeIcon);
            }
        } catch (Throwable ignored) {}

        try {
            managerCompat.notify(safeId, requestCode, builder.build());
            Log.d(TAG, "Notification displayed successfully: " + safeId + " -> " + finalTitle);
        } catch (SecurityException se) {
            Log.e(TAG, "SecurityException posting notification: " + se.getMessage());
        } catch (Exception e) {
            Log.e(TAG, "Failed to display notification: " + e.getMessage());
        }
    }

    // --- Active Schedules Persistence for Reboot Restoration ---

    public static class ScheduledItem {
        public String reminderId;
        public String title;
        public String body;
        public long triggerAtMillis;
        public String targetUrl;

        public ScheduledItem(String reminderId, String title, String body, long triggerAtMillis, String targetUrl) {
            this.reminderId = reminderId;
            this.title = title;
            this.body = body;
            this.triggerAtMillis = triggerAtMillis;
            this.targetUrl = targetUrl;
        }
    }

    public static synchronized void saveScheduledReminder(Context context, String reminderId, String title, String body, long triggerAtMillis, String targetUrl) {
        if (context == null || reminderId == null) return;
        try {
            List<ScheduledItem> items = getAllScheduledReminders(context);
            // Replace if existing
            items.removeIf(item -> item.reminderId.equals(reminderId));
            items.add(new ScheduledItem(reminderId, title, body, triggerAtMillis, targetUrl));

            JSONArray arr = new JSONArray();
            for (ScheduledItem it : items) {
                JSONObject obj = new JSONObject();
                obj.put("reminderId", it.reminderId);
                obj.put("title", it.title);
                obj.put("body", it.body);
                obj.put("triggerAtMillis", it.triggerAtMillis);
                obj.put("targetUrl", it.targetUrl);
                arr.put(obj);
            }
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString(PREF_SCHEDULES_JSON, arr.toString())
                    .apply();
        } catch (Exception e) {
            Log.e(TAG, "Failed to save scheduled reminder: " + e.getMessage());
        }
    }

    public static synchronized void removeScheduledReminder(Context context, String reminderId) {
        if (context == null || reminderId == null) return;
        try {
            List<ScheduledItem> items = getAllScheduledReminders(context);
            items.removeIf(item -> item.reminderId.equals(reminderId));

            JSONArray arr = new JSONArray();
            for (ScheduledItem it : items) {
                JSONObject obj = new JSONObject();
                obj.put("reminderId", it.reminderId);
                obj.put("title", it.title);
                obj.put("body", it.body);
                obj.put("triggerAtMillis", it.triggerAtMillis);
                obj.put("targetUrl", it.targetUrl);
                arr.put(obj);
            }
            context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString(PREF_SCHEDULES_JSON, arr.toString())
                    .apply();
        } catch (Exception e) {
            Log.e(TAG, "Failed to remove scheduled reminder: " + e.getMessage());
        }
    }

    public static synchronized List<ScheduledItem> getAllScheduledReminders(Context context) {
        List<ScheduledItem> list = new ArrayList<>();
        if (context == null) return list;
        try {
            String json = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .getString(PREF_SCHEDULES_JSON, null);
            if (json == null) return list;
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject obj = arr.getJSONObject(i);
                list.add(new ScheduledItem(
                        obj.getString("reminderId"),
                        obj.optString("title", ""),
                        obj.optString("body", ""),
                        obj.getLong("triggerAtMillis"),
                        obj.optString("targetUrl", "")
                ));
            }
        } catch (Exception e) {
            Log.e(TAG, "Failed to parse scheduled reminders: " + e.getMessage());
        }
        return list;
    }
}

