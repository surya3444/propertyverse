const express = require('express');
const propertyController = require('../controllers/propertyController');
const matchController = require('../controllers/matchController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');
const { aiLimiter } = require('../middleware/rateLimit');

const router = express.Router();

// All property routes require a logged-in agent.
router.use(auth);

// Voice-note draft: form-data field named 'audio'. Returns extracted fields
// (not persisted) for the agent to review before saving. Rate-limited (paid AI).
router.post('/voice', aiLimiter, upload.single('audio'), propertyController.draftPropertyFromVoice);

router.post('/', propertyController.createProperty);
router.get('/', propertyController.listProperties);
router.get('/:id', propertyController.getProperty);
router.put('/:id', propertyController.updateProperty);
router.delete('/:id', propertyController.deleteProperty);

// Intelligent matching: leads that fit this property.
router.get('/:propertyId/leads', matchController.findLeadsForProperty);

module.exports = router;
