package com.frontend

import android.content.Intent
import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

/**
 * JS bridge for the self-hosted push stream. `start(token, baseUrl)` launches the
 * [NotificationStreamService] foreground service; `stop()` tears it down (logout).
 * While mounted it also relays foreground stream events to JS as `pvNotification`
 * so the in-app unread badge can refresh instantly.
 */
class NotificationStreamModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  init {
    // Bump the JS badge when an event arrives while the app is running.
    NotificationStreamService.jsListener = {
      try {
        if (reactApplicationContext.hasActiveReactInstance()) {
          reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit("pvNotification", null)
        }
      } catch (_: Exception) {}
    }
  }

  override fun getName() = "NotificationStream"

  @ReactMethod
  fun start(token: String, baseUrl: String) {
    val intent = Intent(reactApplicationContext, NotificationStreamService::class.java).apply {
      putExtra(NotificationStreamService.EXTRA_TOKEN, token)
      putExtra(NotificationStreamService.EXTRA_BASE_URL, baseUrl)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      reactApplicationContext.startForegroundService(intent)
    } else {
      reactApplicationContext.startService(intent)
    }
  }

  @ReactMethod
  fun stop() {
    reactApplicationContext.stopService(
      Intent(reactApplicationContext, NotificationStreamService::class.java)
    )
  }

  // Required stubs so React Native's event-emitter calls don't warn.
  @ReactMethod fun addListener(eventName: String) {}
  @ReactMethod fun removeListeners(count: Int) {}

  override fun invalidate() {
    NotificationStreamService.jsListener = null
    super.invalidate()
  }
}
