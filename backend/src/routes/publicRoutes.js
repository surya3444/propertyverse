const express = require('express');
const publicFormController = require('../controllers/publicFormController');
const publicUploadController = require('../controllers/publicUploadController');
const upload = require('../middleware/upload');
const activeForm = require('../middleware/activeForm');
const { publicSubmitLimiter, publicUploadLimiter } = require('../middleware/rateLimit');

// Unauthenticated routes hit by the public Next.js form app. Mounted at
// /api/public. The baseline apiLimiter still applies; submissions + uploads get
// an extra per-IP throttle on top.
const router = express.Router();

router.get('/forms/:publicId', activeForm, publicFormController.getPublicForm);

router.post(
  '/forms/:publicId/submit',
  publicSubmitLimiter,
  activeForm,
  publicFormController.submitPublicForm
);

// Up to 6 files per request (each capped by multer at 15 MB). `activeForm` runs
// before multer so bytes are only buffered for a form that really exists.
router.post(
  '/forms/:publicId/upload',
  publicUploadLimiter,
  activeForm,
  upload.array('files', 6),
  publicUploadController.uploadPublicMedia
);

module.exports = router;
