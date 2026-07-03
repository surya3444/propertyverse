const PushToken = require('../models/PushToken');

// Best-effort push fan-out via Firebase Cloud Messaging. This is intentionally
// additive: if Firebase isn't configured (no FIREBASE_SERVICE_ACCOUNT), every
// send is a silent no-op and the in-app notification path still works. Wire a
// real Firebase project + service account to light it up (Android + web).

let messaging = null; // lazily-initialised FCM messaging instance
let initTried = false;

function getMessaging() {
  if (initTried) return messaging;
  initTried = true;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.log('[push] FIREBASE_SERVICE_ACCOUNT not set — push disabled (in-app notifications still work).');
    return null;
  }

  try {
    // firebase-admin is an optional dependency: only require it when configured
    // so the server runs without it installed.
    const admin = require('firebase-admin');
    const credentials = JSON.parse(raw);
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(credentials) });
    }
    messaging = admin.messaging();
    console.log('[push] Firebase messaging initialised.');
  } catch (err) {
    console.warn('[push] Failed to initialise Firebase, push disabled:', err.message);
    messaging = null;
  }
  return messaging;
}

// Send a notification to every registered device/browser for an agent. Prunes
// tokens FCM reports as unregistered. Never throws (best-effort).
async function sendToAgent(agentId, { title, body, data = {} }) {
  const fcm = getMessaging();
  if (!fcm) return;

  try {
    const tokens = await PushToken.find({ agentId }).distinct('token');
    if (!tokens.length) return;

    const res = await fcm.sendEachForMulticast({
      tokens,
      notification: { title, body },
      // FCM data values must be strings.
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });

    const dead = [];
    res.responses.forEach((r, i) => {
      const code = r.error && r.error.code;
      if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
        dead.push(tokens[i]);
      }
    });
    if (dead.length) await PushToken.deleteMany({ token: { $in: dead } });
  } catch (err) {
    console.warn('[push] sendToAgent failed:', err.message);
  }
}

module.exports = { sendToAgent };
