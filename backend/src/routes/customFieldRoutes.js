const express = require('express');
const customFieldController = require('../controllers/customFieldController');
const auth = require('../middleware/auth');

// Agent-defined custom field schemas per entity type. All routes require auth.
const router = express.Router();
router.use(auth);

router.get('/:entityType', customFieldController.getSchema);
router.put('/:entityType', customFieldController.updateSchema);

module.exports = router;
