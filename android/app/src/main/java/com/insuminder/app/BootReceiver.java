package com.insuminder.app;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.util.Log;
import java.util.List;

/**
 * BootReceiver
 * Restores all pending insulin reminders and alarms when the device reboots or app is updated.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "InsuMinderBoot";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (context == null || intent == null) return;
        String action = intent.getAction();
        Log.i(TAG, "BootReceiver received action: " + action);

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager == null) return;

        List<NotificationHelper.ScheduledItem> items = NotificationHelper.getAllScheduledReminders(context);
        long now = System.currentTimeMillis();

        for (NotificationHelper.ScheduledItem item : items) {
            if (item.triggerAtMillis > now) {
                try {
                    Intent alarmIntent = new Intent(context, ReminderReceiver.class);
                    alarmIntent.setAction(ReminderReceiver.ACTION_REMINDER);
                    alarmIntent.putExtra(ReminderReceiver.EXTRA_REMINDER_ID, item.reminderId);
                    alarmIntent.putExtra(ReminderReceiver.EXTRA_TITLE, item.title);
                    alarmIntent.putExtra(ReminderReceiver.EXTRA_BODY, item.body);
                    alarmIntent.putExtra(ReminderReceiver.EXTRA_TARGET_URL, item.targetUrl);

                    int requestCode = Math.abs(item.reminderId.hashCode());
                    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        flags |= PendingIntent.FLAG_IMMUTABLE;
                    }
                    PendingIntent pendingIntent = PendingIntent.getBroadcast(context, requestCode, alarmIntent, flags);

                    // Create show intent for AlarmClockInfo
                    Intent showIntent = new Intent(context, WebContainerActivity.class);
                    showIntent.setData(Uri.parse(item.targetUrl != null && !item.targetUrl.isEmpty() ? item.targetUrl : "https://insuminder.pages.dev/"));
                    PendingIntent showPendingIntent = PendingIntent.getActivity(context, requestCode + 1, showIntent, flags);

                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        AlarmManager.AlarmClockInfo clockInfo = new AlarmManager.AlarmClockInfo(item.triggerAtMillis, showPendingIntent);
                        alarmManager.setAlarmClock(clockInfo, pendingIntent);
                    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, item.triggerAtMillis, pendingIntent);
                    } else {
                        alarmManager.setExact(AlarmManager.RTC_WAKEUP, item.triggerAtMillis, pendingIntent);
                    }
                    Log.i(TAG, "Restored alarm on boot: " + item.reminderId + " at " + item.triggerAtMillis);
                } catch (Exception e) {
                    Log.e(TAG, "Failed to restore alarm for " + item.reminderId + ": " + e.getMessage());
                }
            } else {
                // Expired while phone was off
                NotificationHelper.removeScheduledReminder(context, item.reminderId);
            }
        }
    }
}

