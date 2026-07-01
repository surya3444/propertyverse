const express = require('express');
const locationController = require('../controllers/locationController');
const auth = require('../middleware/auth');

const router = express.Router();

// Location search requires a logged-in agent (keeps the proxy from being abused).
router.use(auth);

router.get('/autocomplete', locationController.autocomplete);
router.get('/details', locationController.details);

module.exports = router;
