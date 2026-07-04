const express = require('express');
const publicFormController = require('../controllers/publicFormController');
const publicUploadController = require('../controllers/publicUploadController');
const upload = require('../middleware/upload');
const { publicSubmitLimiter, publicUploadLimiter } = require('../middleware/rateLimit');

// Unauthenticated routes hit by the public Next.js form app. Mounted at
// /api/public. The baseline apiLimiter still applies; submissions + uploads get
// an extra per-IP throttle on top.
const router = express.Router();

router.get('/forms/:publicId', publicFormController.getPublicForm);
router.post('/forms/:publicId/submit', publicSubmitLimiter, publicFormController.submitPublicForm);
// Up to 6 files per request (each capped by multer at 15 MB).
router.post(
  '/forms/:publicId/upload',
  publicUploadLimiter,
  upload.array('files', 6),
  publicUploadController.uploadPublicMedia
);

module.exports = router;
