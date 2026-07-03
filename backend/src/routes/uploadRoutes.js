const express = require('express');
const uploadController = require('../controllers/uploadController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();
router.use(auth);

// Up to 10 files per request (each capped by multer at 15 MB).
router.post('/', upload.array('files', 10), uploadController.uploadMedia);

module.exports = router;
