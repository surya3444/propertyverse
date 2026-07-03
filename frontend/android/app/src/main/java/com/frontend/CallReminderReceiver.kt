package com.frontend

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.telephony.TelephonyManager

/**
 * Detects when a phone call ends — even if the app is backgrounded or fully
 * killed. Because it's registered in the manifest, Android spawns a process to
 * run it when the app isn't running. When a call ends and the app isn't in the
 * foreground, it posts a "log this call?" reminder that simply opens the app;
 * the JS layer then reads the latest call from the log and prefills the recorder.
 */
class CallReminderReceiver : BroadcastReceiver() {

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != TelephonyManager.ACTION_PHONE_STATE_CHANGED) return
    val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return

    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val last = prefs.getString(KEY_LAST_STATE, TelephonyManager.EXTRA_STATE_IDLE)
    prefs.edit().putString(KEY_LAST_STATE, state).apply()

    // A call ended = a transition from RINGING/OFFHOOK back to IDLE (once per call).
    val callEnded = state == TelephonyManager.EXTRA_STATE_IDLE &&
      (last == TelephonyManager.EXTRA_STATE_OFFHOOK || last == TelephonyManager.EXTRA_STATE_RINGING)
    if (!callEnded) return

    // If the app is already on screen, the user is here — no notification needed.
    if (AppForegroundTracker.isForeground) return

    postReminder(context.applicationContext)
  }

  private fun postReminder(context: Context) {
    val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Call reminders",
        NotificationManager.IMPORTANCE_HIGH
      ).apply { description = "Reminds you to log a lead after a call" }
      nm.createNotificationChannel(channel)
    }

    // Tapping the reminder just opens the app; the JS reopen-check does the rest.
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      putExtra(EXTRA_FROM_REMINDER, true)
    }
    var flags = PendingIntent.FLAG_UPDATE_CURRENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags = flags or PendingIntent.FLAG_IMMUTABLE
    val pending = PendingIntent.getActivity(context, 0, launch, flags)

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH)
    }
    builder
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle("Log this call as a lead?")
      .setContentText("Tap to record the requirement while it's fresh.")
      .setAutoCancel(true)
      .setContentIntent(pending)

    nm.notify(NOTIF_ID, builder.build())
  }

  companion object {
    private const val PREFS = "call_reminder"
    private const val KEY_LAST_STATE = "last_state"
    private const val CHANNEL_ID = "call-reminders"
    private const val NOTIF_ID = 4711
    const val EXTRA_FROM_REMINDER = "pv_from_reminder"
  }
}
