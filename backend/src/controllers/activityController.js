const Activity = require('../models/Activity');

// Create a visit / follow-up / call / note against a contact (and optionally a
// property). The contact must already exist (the app picks or creates it first).
exports.createActivity = async (req, res) => {
  try {
    const { contactId, propertyId, kind, scheduledAt, notes, outcome, status } = req.body;
    if (!contactId) {
      return res.status(400).json({ error: 'A contact is required.' });
    }
    const activity = await Activity.create({
      agentId: req.user.id,
      contactId,
      propertyId,
      kind,
      scheduledAt,
      notes,
      outcome,
      status,
    });
    const populated = await activity.populate([
      { path: 'contactId', select: 'name phone' },
      { path: 'propertyId', select: 'title location' },
    ]);
    res.status(201).json({ message: 'Scheduled.', activity: populated });
  } catch (error) {
    console.error('Create activity error:', error);
    res.status(500).json({ error: 'Failed to schedule.' });
  }
};

// Agenda / list. Filters: ?scope=upcoming|today|past, ?status=, ?contactId=,
// ?propertyId=, or an explicit ?from=&to= ISO range.
exports.listActivities = async (req, res) => {
  try {
    const { scope, status, contactId, propertyId, from, to } = req.query;
    const query = { agentId: req.user.id };
    if (status) query.status = status;
    if (contactId) query.contactId = contactId;
    if (propertyId) query.propertyId = propertyId;

    const now = new Date();
    if (from || to) {
      query.scheduledAt = {};
      if (from) query.scheduledAt.$gte = new Date(from);
      if (to) query.scheduledAt.$lte = new Date(to);
    } else if (scope === 'today') {
      const start = new Date(now); start.setHours(0, 0, 0, 0);
      const end = new Date(now); end.setHours(23, 59, 59, 999);
      query.scheduledAt = { $gte: start, $lte: end };
    } else if (scope === 'upcoming') {
      query.scheduledAt = { $gte: now };
      query.status = query.status || 'Scheduled';
    } else if (scope === 'past') {
      query.scheduledAt = { $lt: now };
    }

    // Upcoming reads best ascending; everything else newest-first.
    const sortDir = scope === 'upcoming' ? 1 : -1;
    const activities = await Activity.find(query)
      .sort({ scheduledAt: sortDir })
      .populate('contactId', 'name phone')
      .populate('propertyId', 'title location');

    res.status(200).json({ count: activities.length, activities });
  } catch (error) {
    console.error('List activities error:', error);
    res.status(500).json({ error: 'Failed to fetch activities.' });
  }
};

exports.updateActivity = async (req, res) => {
  try {
    const activity = await Activity.findOneAndUpdate(
      { _id: req.params.id, agentId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    )
      .populate('contactId', 'name phone')
      .populate('propertyId', 'title location');
    if (!activity) return res.status(404).json({ error: 'Activity not found.' });
    res.status(200).json({ message: 'Updated.', activity });
  } catch (error) {
    console.error('Update activity error:', error);
    res.status(500).json({ error: 'Failed to update activity.' });
  }
};

exports.deleteActivity = async (req, res) => {
  try {
    const activity = await Activity.findOneAndDelete({ _id: req.params.id, agentId: req.user.id });
    if (!activity) return res.status(404).json({ error: 'Activity not found.' });
    res.status(200).json({ message: 'Deleted.' });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ error: 'Failed to delete activity.' });
  }
};
