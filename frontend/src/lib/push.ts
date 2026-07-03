// Native push registration (Android / iOS).
//
// This is intentionally a no-op scaffold. Real native push needs the
// @react-native-firebase packages plus a Firebase project config
// (google-services.json / GoogleService-Info.plist) and a native rebuild —
// none of which can ship without the account owner's credentials. In-app
// notifications (the bell + Notifications screen) work regardless.
//
// To enable it later:
//   1. npm i @react-native-firebase/app @react-native-firebase/messaging
//   2. Drop google-services.json into android/app (and the iOS plist), rebuild.
//   3. Replace the body below with:
//        import messaging from '@react-native-firebase/messaging';
//        await messaging().requestPermission();
//        const token = await messaging().getToken();
//        await notificationsApi.registerPushToken(token, Platform.OS);
//        messaging().onMessage(() => onMessage?.());
//
// `onMessage` lets the caller refresh the unread badge when a push arrives
// while the app is foregrounded.
export async function registerForPush(_onMessage?: () => void): Promise<void> {
  // No-op on native until Firebase is wired (see note above).
}
