const Notification = require('../models/Notification');
const PushToken = require('../models/PushToken');
const { getVapidPublicKey } = require('../services/pushService');
const { parsePagination } = require('../utils/query');

// GET /api/notifications — the agent's notifications (newest first) + unread count.
exports.listNotifications = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { defaultLimit: 30 });
    const filter = { agentId: req.user.id };
    if (req.query.unread === 'true') filter.read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments(filter),
      Notification.countDocuments({ agentId: req.user.id, read: false }),
    ]);
    res.status(200).json({ count: notifications.length, total, unreadCount, page, limit, notifications });
  } catch (error) {
    console.error('List notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
};

exports.markRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, agentId: req.user.id },
      { read: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ error: 'Notification not found.' });
    res.status(200).json({ notification });
  } catch (error) {
    console.error('Mark read error:', error);
    res.status(500).json({ error: 'Failed to update notification.' });
  }
};

exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ agentId: req.user.id, read: false }, { read: true });
    res.status(200).json({ message: 'All notifications marked read.' });
  } catch (error) {
    console.error('Mark all read error:', error);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
};

// The public VAPID key a browser needs to create a Web Push subscription. Null
// when web push isn't configured (client then skips subscribing).
exports.getVapidKey = (req, res) => {
  res.status(200).json({ publicKey: getVapidPublicKey() });
};

// Register (or re-point) a Web Push (VAPID) subscription for this agent.
// Idempotent via upsert on the subscription endpoint.
exports.subscribeWebPush = async (req, res) => {
  try {
    const sub = req.body && req.body.subscription ? req.body.subscription : req.body;
    if (!sub || !sub.endpoint || !sub.keys) {
      return res.status(400).json({ error: 'A valid push subscription is required.' });
    }
    await PushToken.findOneAndUpdate(
      { endpoint: sub.endpoint },
      {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
        agentId: req.user.id,
        provider: 'webpush',
        platform: 'web',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ message: 'Subscribed to push notifications.' });
  } catch (error) {
    console.error('Subscribe web push error:', error);
    res.status(500).json({ error: 'Failed to subscribe.' });
  }
};

exports.unsubscribeWebPush = async (req, res) => {
  try {
    const endpoint = req.body && req.body.endpoint;
    if (endpoint) await PushToken.deleteOne({ endpoint, agentId: req.user.id });
    res.status(200).json({ message: 'Unsubscribed.' });
  } catch (error) {
    console.error('Unsubscribe web push error:', error);
    res.status(500).json({ error: 'Failed to unsubscribe.' });
  }
};

// Register (or re-point) an FCM device token (optional native path).
exports.registerPushToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ error: 'A push token is required.' });
    await PushToken.findOneAndUpdate(
      { token },
      { token, agentId: req.user.id, provider: 'fcm', platform: platform || 'android' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(200).json({ message: 'Push token registered.' });
  } catch (error) {
    console.error('Register push token error:', error);
    res.status(500).json({ error: 'Failed to register push token.' });
  }
};

exports.unregisterPushToken = async (req, res) => {
  try {
    await PushToken.deleteOne({ token: req.params.token, agentId: req.user.id });
    res.status(200).json({ message: 'Push token removed.' });
  } catch (error) {
    console.error('Unregister push token error:', error);
    res.status(500).json({ error: 'Failed to remove push token.' });
  }
};
