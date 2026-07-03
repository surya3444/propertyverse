const Notification = require('../models/Notification');
const PushToken = require('../models/PushToken');
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

// Register (or re-point) an FCM token for push. Idempotent via upsert on token.
exports.registerPushToken = async (req, res) => {
  try {
    const { token, platform } = req.body;
    if (!token) return res.status(400).json({ error: 'A push token is required.' });
    await PushToken.findOneAndUpdate(
      { token },
      { token, agentId: req.user.id, platform: platform || 'web' },
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
