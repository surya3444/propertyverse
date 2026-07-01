const express = require('express');
const leadController = require('../controllers/leadController');
const matchController = require('../controllers/matchController');
const auth = require('../middleware/auth');
const upload = require('../middleware/upload');

const router = express.Router();

// All lead routes require a logged-in agent.
router.use(auth);

// Voice-note capture: form-data field named 'audio'.
router.post('/voice', upload.single('audio'), leadController.createLeadFromVoice);

router.post('/', leadController.createLead);
router.get('/', leadController.listLeads);
router.get('/:id', leadController.getLead);
router.put('/:id', leadController.updateLead);
router.delete('/:id', leadController.deleteLead);

// Intelligent matching: properties that fit this lead.
router.get('/:leadId/matches', matchController.findMatchesForLead);

module.exports = router;
