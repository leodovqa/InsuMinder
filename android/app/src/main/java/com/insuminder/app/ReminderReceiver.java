package com.insuminder.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * ReminderReceiver
 * Native Android BroadcastReceiver triggered by AlarmManager (including setAlarmClock).
 * Dispatches high-priority insulin reminders directly to the notification drawer
 * with automatic deduplication against FCM push.
 */
public class ReminderReceiver extends BroadcastReceiver {

    public static final String ACTION_REMINDER = "com.insuminder.app.ACTION_REMINDER";
    public static final String EXTRA_REMINDER_ID = "reminder_id";
    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_BODY = "body";
    public static final String EXTRA_TARGET_URL = "target_url";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;

        String reminderId = intent.getStringExtra(EXTRA_REMINDER_ID);
        String title = intent.getStringExtra(EXTRA_TITLE);
        String body = intent.getStringExtra(EXTRA_BODY);
        String targetUrl = intent.getStringExtra(EXTRA_TARGET_URL);

        Log.i("InsuMinderAlarm", "ReminderReceiver triggered: " + reminderId + " | " + title);
        NotificationHelper.displayNotification(context, reminderId, title, body, targetUrl);

        // Once fired, remove from persistent schedules
        if (reminderId != null) {
            NotificationHelper.removeScheduledReminder(context, reminderId);
        }
    }
}
