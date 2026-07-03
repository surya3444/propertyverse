const PushToken = require('../models/PushToken');

// Push fan-out. Primary path is **Web Push (VAPID)** — our own backend sends
// notifications straight to the browser's push service via the `web-push`
// library, with no Firebase/Google project. An optional FCM path (for native)
// stays available when FIREBASE_SERVICE_ACCOUNT is configured.
//
// Everything is best-effort: if VAPID keys aren't set, web sends are no-ops and
// the in-app bell/badge still works.

// ---- Web Push (VAPID) ----

let webpush = null;
let webpushReady = false;
let webpushInit = false;

function getWebPush() {
  if (webpushInit) return webpushReady ? webpush : null;
  webpushInit = true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.log('[push] VAPID keys not set — web push disabled (in-app notifications still work).');
    return null;
  }
  try {
    webpush = require('web-push');
    const subject = process.env.VAPID_SUBJECT || 'mailto:admin@propertyverse.app';
    webpush.setVapidDetails(subject, publicKey, privateKey);
    webpushReady = true;
    console.log('[push] Web Push (VAPID) initialised.');
    return webpush;
  } catch (err) {
    console.warn('[push] Failed to initialise web-push, web push disabled:', err.message);
    return null;
  }
}

// The public VAPID key clients need to subscribe (safe to expose).
function getVapidPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

async function sendWebPush(subs, payload) {
  const wp = getWebPush();
  if (!wp || !subs.length) return;

  const dead = [];
  await Promise.all(
    subs.map(async (doc) => {
      try {
        await wp.sendNotification(
          { endpoint: doc.endpoint, keys: doc.keys },
          JSON.stringify(payload)
        );
      } catch (err) {
        // 404/410 mean the subscription is gone — prune it.
        if (err.statusCode === 404 || err.statusCode === 410) dead.push(doc._id);
        else console.warn('[push] web push send failed:', err.statusCode || err.message);
      }
    })
  );
  if (dead.length) await PushToken.deleteMany({ _id: { $in: dead } });
}

// ---- FCM (optional, native) ----

let messaging = null;
let fcmInit = false;

function getMessaging() {
  if (fcmInit) return messaging;
  fcmInit = true;
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) return null;
  try {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(raw)) });
    }
    messaging = admin.messaging();
    console.log('[push] Firebase messaging initialised.');
  } catch (err) {
    console.warn('[push] Failed to initialise Firebase, FCM disabled:', err.message);
    messaging = null;
  }
  return messaging;
}

async function sendFcm(tokens, { title, body, data }) {
  const fcm = getMessaging();
  if (!fcm || !tokens.length) return;
  try {
    const res = await fcm.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v)])),
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
    console.warn('[push] FCM send failed:', err.message);
  }
}

// Send a notification to every registered device/browser for an agent. Never
// throws (best-effort).
async function sendToAgent(agentId, { title, body, data = {} }) {
  try {
    const regs = await PushToken.find({ agentId });
    const webSubs = regs.filter((r) => r.endpoint);
    const fcmTokens = regs.filter((r) => r.token && !r.endpoint).map((r) => r.token);

    await Promise.all([
      sendWebPush(webSubs, { title, body, data }),
      sendFcm(fcmTokens, { title, body, data }),
    ]);
  } catch (err) {
    console.warn('[push] sendToAgent failed:', err.message);
  }
}

module.exports = { sendToAgent, getVapidPublicKey };
