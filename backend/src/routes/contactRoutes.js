const express = require('express');
const contactController = require('../controllers/contactController');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

router.post('/', contactController.createContact);
router.get('/', contactController.listContacts);
router.get('/:id', contactController.getContact);
router.put('/:id', contactController.updateContact);
router.delete('/:id', contactController.deleteContact);

module.exports = router;
