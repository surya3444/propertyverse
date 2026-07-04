package com.frontend

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Self-hosted push stream (SSE foreground service). Not autolinked
          // because it lives in the app module.
          add(NotificationStreamPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
    // Track foreground state so the post-call receiver knows whether to notify.
    registerActivityLifecycleCallbacks(AppForegroundTracker)
  }
}
