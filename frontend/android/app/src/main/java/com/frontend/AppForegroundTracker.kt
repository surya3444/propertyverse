package com.frontend

import android.app.Activity
import android.app.Application
import android.os.Bundle

/**
 * Tracks whether any Activity is currently resumed, so [CallReminderReceiver] can
 * tell if the app is on-screen (skip the reminder notification) versus
 * backgrounded/killed (post it). Registered from [MainApplication.onCreate].
 */
object AppForegroundTracker : Application.ActivityLifecycleCallbacks {

  @Volatile
  var isForeground: Boolean = false
    private set

  private var resumedCount = 0

  override fun onActivityResumed(activity: Activity) {
    resumedCount++
    isForeground = resumedCount > 0
  }

  override fun onActivityPaused(activity: Activity) {
    resumedCount = (resumedCount - 1).coerceAtLeast(0)
    isForeground = resumedCount > 0
  }

  override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
  override fun onActivityStarted(activity: Activity) {}
  override fun onActivityStopped(activity: Activity) {}
  override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
  override fun onActivityDestroyed(activity: Activity) {}
}
