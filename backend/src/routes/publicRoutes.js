const express = require('express');
const publicFormController = require('../controllers/publicFormController');
const { publicSubmitLimiter } = require('../middleware/rateLimit');

// Unauthenticated routes hit by the public Next.js form app. Mounted at
// /api/public. The baseline apiLimiter still applies; submissions get an extra
// per-IP throttle on top.
const router = express.Router();

router.get('/forms/:publicId', publicFormController.getPublicForm);
router.post('/forms/:publicId/submit', publicSubmitLimiter, publicFormController.submitPublicForm);

module.exports = router;
