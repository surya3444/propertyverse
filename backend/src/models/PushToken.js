const mongoose = require('mongoose');

// A push registration for an agent — used to fan out notifications (see
// services/pushService.js). Two shapes are supported:
//   • Web Push (VAPID): `endpoint` + `keys` from the browser PushSubscription.
//     This is the default, self-hosted path — our backend sends straight to the
//     browser's push service, no Firebase.
//   • FCM (optional/native): a device `token` string.
// A single agent can have many (phone, tablet, browsers).
const pushTokenSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    provider: { type: String, enum: ['webpush', 'fcm'], default: 'webpush' },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'web' },

    // Web Push (VAPID) subscription.
    endpoint: { type: String },
    keys: {
      p256dh: { type: String },
      auth: { type: String },
    },

    // FCM device token (optional).
    token: { type: String },
  },
  { timestamps: true }
);

// A subscription is identified by its endpoint (web) or token (fcm). Unique +
// sparse so either kind can't duplicate while the other stays absent.
pushTokenSchema.index({ endpoint: 1 }, { unique: true, sparse: true });
pushTokenSchema.index({ token: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('PushToken', pushTokenSchema);
