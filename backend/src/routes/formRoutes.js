const express = require('express');
const formController = require('../controllers/formController');
const auth = require('../middleware/auth');

const router = express.Router();

// All form-management routes require a logged-in agent.
router.use(auth);

router.get('/', formController.listForms);
router.post('/', formController.createForm);
router.get('/:id', formController.getForm);
router.put('/:id', formController.updateForm);
router.delete('/:id', formController.deleteForm);
router.get('/:id/responses', formController.listResponses);

module.exports = router;
