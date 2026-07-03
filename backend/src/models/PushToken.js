const mongoose = require('mongoose');

// A device/browser FCM registration token for an agent. Used to fan out push
// notifications (see services/pushService.js). A single agent can have many
// (phone, tablet, web). Tokens are unique; a token that migrates to a new agent
// is re-pointed via upsert.
const pushTokenSchema = new mongoose.Schema(
  {
    agentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['android', 'ios', 'web'], default: 'web' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PushToken', pushTokenSchema);
