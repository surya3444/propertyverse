package com.frontend

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

/**
 * Self-hosted push, no Firebase. A foreground service that holds a long-lived
 * Server-Sent Events (SSE) connection to our backend
 * (GET /api/notifications/stream) so notifications are delivered even when the
 * app is backgrounded or fully killed. Each `notification` event becomes a local
 * Android notification (suppressed when the app is already on-screen — the in-app
 * bell covers that). Auto-reconnects with backoff.
 *
 * Started/stopped from JS via [NotificationStreamModule]. START_STICKY so Android
 * restarts it after the process is reclaimed.
 */
class NotificationStreamService : Service() {

  @Volatile private var running = false
  @Volatile private var token: String? = null
  @Volatile private var baseUrl: String? = null
  @Volatile private var connection: HttpURLConnection? = null
  private var worker: Thread? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val newToken = intent?.getStringExtra(EXTRA_TOKEN)
    val newBase = intent?.getStringExtra(EXTRA_BASE_URL)
    val credsChanged = (!newToken.isNullOrEmpty() && newToken != token) ||
      (!newBase.isNullOrEmpty() && newBase != baseUrl)
    if (!newToken.isNullOrEmpty()) token = newToken
    if (!newBase.isNullOrEmpty()) baseUrl = newBase

    startInForeground()

    if (!running) {
      running = true
      worker = Thread { streamLoop() }.also { it.start() }
    } else if (credsChanged) {
      // Drop the live connection so the loop reconnects with the new token/URL.
      try { connection?.disconnect() } catch (_: Exception) {}
    }
    return START_STICKY
  }

  override fun onDestroy() {
    running = false
    try { connection?.disconnect() } catch (_: Exception) {}
    worker?.interrupt()
    super.onDestroy()
  }

  // ---- SSE (plain HttpURLConnection — no third-party dependency) ----

  private fun streamLoop() {
    var backoffMs = 2000L
    while (running) {
      val t = token
      val base = baseUrl
      if (t.isNullOrEmpty() || base.isNullOrEmpty()) {
        sleep(3000); continue
      }
      var conn: HttpURLConnection? = null
      try {
        val url = URL(base.trimEnd('/') + "/notifications/stream")
        conn = (url.openConnection() as HttpURLConnection).apply {
          requestMethod = "GET"
          setRequestProperty("Authorization", "Bearer $t")
          setRequestProperty("Accept", "text/event-stream")
          connectTimeout = 20000
          readTimeout = 0 // block indefinitely; server heartbeats keep it alive
          doInput = true
        }
        connection = conn
        conn.connect()
        if (conn.responseCode !in 200..299) {
          // 401 etc: wait longer before retrying with the same (bad) token.
          sleep(backoffMs); backoffMs = (backoffMs * 2).coerceAtMost(60000); continue
        }
        backoffMs = 2000L // reset after a good connection
        val reader = BufferedReader(InputStreamReader(conn.inputStream, "UTF-8"))
        val dataBuf = StringBuilder()
        while (running) {
          val line = reader.readLine() ?: break // null = stream closed
          when {
            line.startsWith("data:") -> dataBuf.append(line.substring(5).trim())
            line.isEmpty() -> {
              if (dataBuf.isNotEmpty()) {
                handleEvent(dataBuf.toString())
                dataBuf.setLength(0)
              }
            }
            // comment (":") / other SSE fields (event:, id:, retry:) are ignored.
          }
        }
      } catch (_: Exception) {
        // network dropped / cancelled — fall through to backoff + reconnect.
      } finally {
        try { conn?.disconnect() } catch (_: Exception) {}
      }
      if (running) {
        sleep(backoffMs)
        backoffMs = (backoffMs * 2).coerceAtMost(60000)
      }
    }
  }

  private fun handleEvent(json: String) {
    val obj = try { JSONObject(json) } catch (_: Exception) { return }
    val title = obj.optString("title", "PropertyVerse")
    val body = obj.optString("body", "You have a new notification.")
    val data = obj.optJSONObject("data")

    // Let JS bump the unread badge if the app is running (best-effort).
    try { jsListener?.invoke() } catch (_: Exception) {}

    // Skip the heads-up notification while the app is on-screen; the in-app bell
    // already shows it. Post it whenever backgrounded or killed.
    if (AppForegroundTracker.isForeground) return
    postNotification(title, body, data)
  }

  private fun postNotification(title: String, body: String, data: JSONObject?) {
    val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    ensureAlertChannel(nm)

    val launch = packageManager.getLaunchIntentForPackage(packageName)?.apply {
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      putExtra(EXTRA_FROM_NOTIFICATION, true)
      data?.keys()?.forEach { k -> putExtra("pv_$k", data.optString(k)) }
    }
    var flags = PendingIntent.FLAG_UPDATE_CURRENT
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags = flags or PendingIntent.FLAG_IMMUTABLE
    // Unique request code so multiple notifications don't collapse their intents.
    val pending = PendingIntent.getActivity(this, System.currentTimeMillis().toInt(), launch, flags)

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, ALERT_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this).setPriority(Notification.PRIORITY_HIGH)
    }
    builder
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(Notification.BigTextStyle().bigText(body))
      .setAutoCancel(true)
      .setContentIntent(pending)

    // A distinct id per notification so they stack instead of replacing.
    nm.notify(System.currentTimeMillis().toInt(), builder.build())
  }

  // ---- Foreground service plumbing ----

  private fun startInForeground() {
    val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        SERVICE_CHANNEL_ID,
        "Background updates",
        NotificationManager.IMPORTANCE_MIN
      ).apply { description = "Keeps notifications flowing while the app is closed" }
      nm.createNotificationChannel(channel)
    }
    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      Notification.Builder(this, SERVICE_CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(this).setPriority(Notification.PRIORITY_MIN)
    }
    val notification = builder
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("PropertyVerse")
      .setContentText("Listening for new leads and properties")
      .setOngoing(true)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(SERVICE_NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC)
    } else {
      startForeground(SERVICE_NOTIF_ID, notification)
    }
  }

  private fun ensureAlertChannel(nm: NotificationManager) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        ALERT_CHANNEL_ID,
        "New submissions",
        NotificationManager.IMPORTANCE_HIGH
      ).apply { description = "Alerts when someone submits one of your forms" }
      nm.createNotificationChannel(channel)
    }
  }

  private fun sleep(ms: Long) {
    try { Thread.sleep(ms) } catch (_: InterruptedException) {}
  }

  companion object {
    // Set by the JS module while the app is running so foreground events can
    // refresh the in-app badge; null when JS isn't attached.
    @Volatile var jsListener: (() -> Unit)? = null

    const val EXTRA_TOKEN = "pv_token"
    const val EXTRA_BASE_URL = "pv_base_url"
    const val EXTRA_FROM_NOTIFICATION = "pv_from_notification"

    private const val SERVICE_CHANNEL_ID = "pv-stream-service"
    private const val ALERT_CHANNEL_ID = "pv-form-alerts"
    private const val SERVICE_NOTIF_ID = 5120
  }
}
