const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');
const User = require('../models/User');
const formService = require('../services/formService');
const { notifyFormResponse } = require('../services/notificationService');

// Shape a form for public consumption: only the presentation + enabled fields,
// never the agentId or internal counters.
function publicShape(form, agentName) {
  const fields = form.fields
    .filter((f) => f.enabled)
    .sort((a, b) => a.order - b.order)
    .map((f) => ({
      key: f.key,
      label: f.label,
      type: f.type,
      required: f.required,
      options: f.options,
      placeholder: f.placeholder,
    }));
  return {
    publicId: form.publicId,
    type: form.type,
    title: form.title,
    description: form.description,
    accentColor: form.accentColor,
    agentName,
    fields,
  };
}

// GET /api/public/forms/:publicId — the public definition the web app renders.
exports.getPublicForm = async (req, res) => {
  try {
    const form = await Form.findOne({ publicId: req.params.publicId });
    if (!form || !form.isActive) {
      return res.status(404).json({ error: 'This form is not available.' });
    }
    const agent = await User.findById(form.agentId).select('name');
    res.status(200).json({ form: publicShape(form, agent ? agent.name : undefined) });
  } catch (error) {
    console.error('Get public form error:', error);
    res.status(500).json({ error: 'Failed to load the form.' });
  }
};

// POST /api/public/forms/:publicId/submit — turn a submission into records.
exports.submitPublicForm = async (req, res) => {
  try {
    const form = await Form.findOne({ publicId: req.params.publicId });
    if (!form || !form.isActive) {
      return res.status(404).json({ error: 'This form is not available.' });
    }

    const data = req.body && typeof req.body === 'object' ? req.body.data || req.body : {};
    const { values, custom } = formService.mapSubmission(form, data);

    let entityType;
    let entityId;
    let contactId;
    let personName;

    if (form.type === 'property') {
      const { ownerId, property } = await formService.applyPropertySubmission(
        form.agentId, form, values, custom
      );
      entityType = 'Property';
      entityId = property._id;
      contactId = ownerId;
      personName = values.ownerName;
    } else {
      const { contact, lead } = await formService.applyLeadSubmission(
        form.agentId, form, values, custom
      );
      entityType = 'Lead';
      entityId = lead._id;
      contactId = contact._id;
      personName = values.name;
    }

    // Persist the raw submission as a response + bump the form's counter.
    const response = await FormResponse.create({
      formId: form._id,
      agentId: form.agentId,
      formType: form.type,
      data,
      contactId,
      leadId: form.type === 'lead' ? entityId : undefined,
      propertyId: form.type === 'property' ? entityId : undefined,
    });
    await Form.updateOne({ _id: form._id }, { $inc: { responseCount: 1 } });

    // Notify the agent (in-app + best-effort push).
    await notifyFormResponse(form.agentId, {
      form, response, entityType, entityId, personName,
    });

    res.status(201).json({
      message:
        form.type === 'property'
          ? 'Thanks! Your property has been submitted.'
          : 'Thanks! We’ve received your requirement and will be in touch.',
    });
  } catch (error) {
    // Validation / mapping errors carry a user-facing message + status.
    if (error && error.status === 400) {
      return res.status(400).json({ error: error.message });
    }
    // Mongoose validation (e.g. an out-of-enum select value).
    if (error && error.name === 'ValidationError') {
      return res.status(400).json({ error: 'Some answers were invalid. Please review and try again.' });
    }
    console.error('Submit public form error:', error);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
};
