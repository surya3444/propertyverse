const Form = require('../models/Form');

// Resolve :publicId to an active form and hang it on req.form.
//
// This runs *before* multer on the upload route. Ordered the other way, the
// request body is parsed into memory first — up to 6 files x 15 MB — and only
// then does the controller discover the form doesn't exist. That makes the
// unauthenticated endpoint a memory-pressure lever for anyone who can make
// requests with a made-up publicId.
module.exports = async function activeForm(req, res, next) {
  try {
    const form = await Form.findOne({ publicId: req.params.publicId });
    if (!form || !form.isActive) {
      return res.status(404).json({ error: 'This form is not available.' });
    }
    req.form = form;
    next();
  } catch (err) {
    next(err);
  }
};
