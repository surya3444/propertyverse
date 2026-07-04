const express = require('express');
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');

const router = express.Router();

// Real-time SSE stream. Registered before the shared `auth` middleware because it
// authenticates inline (header OR ?token= for EventSource clients).
router.get('/stream', notificationController.streamNotifications);

// All remaining notification routes require a logged-in agent.
router.use(auth);

router.get('/', notificationController.listNotifications);
router.put('/read-all', notificationController.markAllRead);
router.put('/:id/read', notificationController.markRead);

// Web Push (VAPID) — self-hosted browser push, no Firebase.
router.get('/vapid-public-key', notificationController.getVapidKey);
router.post('/subscribe', notificationController.subscribeWebPush);
router.post('/unsubscribe', notificationController.unsubscribeWebPush);

// FCM device tokens (optional native path).
router.post('/push-tokens', notificationController.registerPushToken);
router.delete('/push-tokens/:token', notificationController.unregisterPushToken);

module.exports = router;
