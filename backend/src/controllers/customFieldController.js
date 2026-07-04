const {
  ENTITY_TYPES,
  sanitizeFieldDefs,
  getOrCreateDef,
} = require('../services/customFieldService');

function validEntity(req, res) {
  const { entityType } = req.params;
  if (!ENTITY_TYPES.includes(entityType)) {
    res.status(400).json({ error: 'Unknown entity type.' });
    return null;
  }
  return entityType;
}

// GET /api/custom-fields/:entityType — the agent's custom-field schema for
// property | lead | contact (created empty on first read).
exports.getSchema = async (req, res) => {
  try {
    const entityType = validEntity(req, res);
    if (!entityType) return;
    const def = await getOrCreateDef(req.user.id, entityType);
    res.status(200).json({ entityType, fields: def.fields });
  } catch (error) {
    console.error('Get custom fields error:', error);
    res.status(500).json({ error: 'Failed to load custom fields.' });
  }
};

// PUT /api/custom-fields/:entityType — replace the agent's field definitions.
exports.updateSchema = async (req, res) => {
  try {
    const entityType = validEntity(req, res);
    if (!entityType) return;
    const fields = sanitizeFieldDefs(req.body.fields).map((f, i) => ({ ...f, order: i }));
    const def = await getOrCreateDef(req.user.id, entityType);
    def.fields = fields;
    await def.save();
    res.status(200).json({ message: 'Custom fields updated.', entityType, fields: def.fields });
  } catch (error) {
    console.error('Update custom fields error:', error);
    res.status(500).json({ error: 'Failed to update custom fields.' });
  }
};
