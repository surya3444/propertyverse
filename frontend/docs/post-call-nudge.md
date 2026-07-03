# Post-call lead capture

Reminds the agent to record a caller as a lead after a phone call. Android-only
(web/iOS have no call-log/telephony access). Everything degrades gracefully via
lazy-required native modules — if a module isn't linked yet, the feature is inert
instead of crashing.

## In-app popup (app open / reopened)
- `src/components/CallNudge.tsx` — the popup UI + orchestration.
- On `AppState` → active and on a detected call-end while foreground, it reads the
  latest call (`getLatestCall` in `src/lib/callLog.ts`) and shows a card offering to
  record it. Re-checks a few times over ~6s to beat Android's call-log write lag.
- Opens `RecordLead` with `{ phoneNumber, clientName }` prefilled via the nav ref
  in `RootNavigator.tsx`.

## Background + killed reminder (fully native)
A manifest-registered `PHONE_STATE` receiver handles background AND killed states
uniformly — no JS deps, no notifee. Android spawns a process to run the receiver
even when the app is swiped away.

- `android/app/src/main/java/com/frontend/CallReminderReceiver.kt` — detects a
  RINGING/OFFHOOK → IDLE transition (call ended, tracked via SharedPreferences).
  If the app isn't in the foreground, it posts a native "Log this call as a lead?"
  notification whose tap simply opens the app.
- `AppForegroundTracker.kt` (registered in `MainApplication.onCreate`) — lets the
  receiver tell foreground (skip) from background/killed (notify).
- Registered in `AndroidManifest.xml` under `<application>`.
- Tap → app opens → the JS reopen-check (`CallNudge`) reads the latest call and
  shows the in-app popup → Record. So there's exactly one notification system
  (native) and one popup system (JS); no double-fire.
- `requestReminderPermissions()` in `src/lib/callLog.ts` requests
  `READ_CALL_LOG` + `READ_PHONE_STATE` + `POST_NOTIFICATIONS` on first launch.

## Permissions (AndroidManifest.xml)
`READ_CALL_LOG` (read number/name), `READ_PHONE_STATE` (receive PHONE_STATE),
`POST_NOTIFICATIONS` (Android 13+).

## Notes for release
- `READ_CALL_LOG` / `READ_PHONE_STATE` are Google Play "restricted" permissions and
  need a declared justification in the Play Console listing.
- iOS cannot detect PSTN calls (CallKit is VoIP-only) — this whole feature is Android.
- Aggressive OEM battery managers (Xiaomi/Oppo/etc.) can suppress manifest receivers
  for killed apps; users may need to allow "autostart"/disable battery optimization.
