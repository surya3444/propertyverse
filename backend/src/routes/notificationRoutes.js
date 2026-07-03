const express = require('express');
const notificationController = require('../controllers/notificationController');
const auth = require('../middleware/auth');

const router = express.Router();

// All notification routes require a logged-in agent.
router.use(auth);

router.get('/', notificationController.listNotifications);
router.put('/read-all', notificationController.markAllRead);
router.put('/:id/read', notificationController.markRead);
router.post('/push-tokens', notificationController.registerPushToken);
router.delete('/push-tokens/:token', notificationController.unregisterPushToken);

module.exports = router;
