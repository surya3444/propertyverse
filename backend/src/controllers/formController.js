const Form = require('../models/Form');
const FormResponse = require('../models/FormResponse');
const { defaultFields, ensureDefaultForms } = require('../services/formService');
const { parsePagination } = require('../utils/query');

// Fields on a Form the agent is allowed to set (agentId/publicId/type/counters
// are server-owned).
const EDITABLE = ['title', 'description', 'accentColor', 'isActive', 'fields'];

// Normalise an incoming fields array: keep only known props and re-index order.
function sanitizeFields(fields) {
  if (!Array.isArray(fields)) return undefined;
  return fields.map((f, i) => ({
    key: f.key,
    label: f.label,
    type: f.type || 'text',
    required: !!f.required,
    enabled: f.enabled !== false,
    order: typeof f.order === 'number' ? f.order : i,
    options: Array.isArray(f.options) ? f.options.filter((o) => typeof o === 'string') : [],
    placeholder: f.placeholder,
    custom: !!f.custom,
  }));
}

function pickEditable(body) {
  const out = {};
  for (const key of EDITABLE) {
    if (body[key] === undefined) continue;
    out[key] = key === 'fields' ? sanitizeFields(body[key]) : body[key];
  }
  return out;
}

// List the agent's forms (seeding the two defaults on first use).
exports.listForms = async (req, res) => {
  try {
    await ensureDefaultForms(req.user.id);
    const forms = await Form.find({ agentId: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json({ count: forms.length, forms });
  } catch (error) {
    console.error('List forms error:', error);
    res.status(500).json({ error: 'Failed to fetch forms.' });
  }
};

// Create a new form. Defaults to the template field set for its type unless the
// client supplies its own fields.
exports.createForm = async (req, res) => {
  try {
    const type = req.body.type === 'property' ? 'property' : 'lead';
    const fields = sanitizeFields(req.body.fields) || defaultFields(type);
    const form = await Form.create({
      agentId: req.user.id,
      type,
      title: req.body.title || (type === 'property' ? 'Property submission' : 'Lead capture'),
      description: req.body.description,
      accentColor: req.body.accentColor,
      fields,
    });
    res.status(201).json({ message: 'Form created.', form });
  } catch (error) {
    console.error('Create form error:', error);
    res.status(500).json({ error: 'Failed to create form.' });
  }
};

exports.getForm = async (req, res) => {
  try {
    const form = await Form.findOne({ _id: req.params.id, agentId: req.user.id });
    if (!form) return res.status(404).json({ error: 'Form not found.' });
    res.status(200).json({ form });
  } catch (error) {
    console.error('Get form error:', error);
    res.status(500).json({ error: 'Failed to fetch form.' });
  }
};

exports.updateForm = async (req, res) => {
  try {
    const update = pickEditable(req.body);
    const form = await Form.findOneAndUpdate(
      { _id: req.params.id, agentId: req.user.id },
      update,
      { new: true, runValidators: true }
    );
    if (!form) return res.status(404).json({ error: 'Form not found.' });
    res.status(200).json({ message: 'Form updated.', form });
  } catch (error) {
    console.error('Update form error:', error);
    res.status(500).json({ error: 'Failed to update form.' });
  }
};

exports.deleteForm = async (req, res) => {
  try {
    const form = await Form.findOneAndDelete({ _id: req.params.id, agentId: req.user.id });
    if (!form) return res.status(404).json({ error: 'Form not found.' });
    // Keep the produced Lead/Property records; just drop the response feed.
    await FormResponse.deleteMany({ formId: form._id });
    res.status(200).json({ message: 'Form deleted.' });
  } catch (error) {
    console.error('Delete form error:', error);
    res.status(500).json({ error: 'Failed to delete form.' });
  }
};

// The response feed for a form (newest first).
exports.listResponses = async (req, res) => {
  try {
    const form = await Form.findOne({ _id: req.params.id, agentId: req.user.id });
    if (!form) return res.status(404).json({ error: 'Form not found.' });

    const { page, limit, skip } = parsePagination(req.query);
    const [responses, total] = await Promise.all([
      FormResponse.find({ formId: form._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      FormResponse.countDocuments({ formId: form._id }),
    ]);
    res.status(200).json({ count: responses.length, total, page, limit, responses });
  } catch (error) {
    console.error('List responses error:', error);
    res.status(500).json({ error: 'Failed to fetch responses.' });
  }
};
