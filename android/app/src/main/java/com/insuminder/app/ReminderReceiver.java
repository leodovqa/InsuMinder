package com.insuminder.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

/**
 * ReminderReceiver
 * Native Android BroadcastReceiver triggered by AlarmManager.
 * Dispatches high-priority insulin reminders directly to the Android notification drawer,
 * even when the InsuMinder app is closed or the device is in Doze/standby mode.
 */
public class ReminderReceiver extends BroadcastReceiver {

    public static final String ACTION_REMINDER = "com.insuminder.app.ACTION_REMINDER";
    public static final String EXTRA_REMINDER_ID = "reminder_id";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";
    public static final String EXTRA_TARGET_URL = "target_url";

    public static final String NOTIFICATION_CHANNEL_ID = "insuminder_reminders";
    public static final String NOTIFICATION_CHANNEL_NAME = "InsuMinder Reminders";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String reminderId = intent.getStringExtra(EXTRA_REMINDER_ID);
        String title = intent.getStringExtra(EXTRA_TITLE);
        String body = intent.getStringExtra(EXTRA_BODY);
        String targetUrl = intent.getStringExtra(EXTRA_TARGET_URL);

        if (title == null || title.trim().isEmpty()) {
            title = "🔔 InsuMinder";
        }
        if (body == null || body.trim().isEmpty()) {
            body = "You have an insulin dose reminder.";
        }
        if (targetUrl == null || targetUrl.trim().isEmpty()) {
            targetUrl = "https://insuminder.pages.dev/?action=basal";
        }

        // Verify that notifications are enabled on the device
        NotificationManagerCompat managerCompat = NotificationManagerCompat.from(context);
        if (!managerCompat.areNotificationsEnabled()) {
            return;
        }

        // Ensure Notification Channel exists
        createNotificationChannel(context);

        // Build target Intent for notification click
        Intent openIntent = new Intent(context, WebContainerActivity.class);
        String destination = targetUrl;
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

        openIntent.setData(Uri.parse(destination));
        openIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        int requestCode = reminderId != null ? Math.abs(reminderId.hashCode()) : (int) System.currentTimeMillis();
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        PendingIntent pendingIntent = PendingIntent.getActivity(context, requestCode, openIntent, flags);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_insuminder)
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(pendingIntent)
                .setColor(Color.parseColor("#0ea5e9"));

        try {
            Bitmap largeIcon = BitmapFactory.decodeResource(context.getResources(), R.drawable.ic_launcher_foreground);
            if (largeIcon != null) {
                builder.setLargeIcon(largeIcon);
            }
        } catch (Exception ignored) {
        }

        if (destination.contains("action=basal")) {
            builder.addAction(R.drawable.ic_stat_insuminder, "💉 Log Basal", pendingIntent);
        }

        try {
            managerCompat.notify(reminderId != null ? reminderId : "insuminder_reminder", requestCode, builder.build());
        } catch (Exception e) {
            Log.e("InsuMinder", "ReminderReceiver: Failed to post notification", e);
        }
    }

    private void createNotificationChannel(Context context) {
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

            NotificationManager manager = context.getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
