const Activity = require('../models/Activity');
const Lead = require('../models/Lead');
const audit = require('../services/auditService');
const { parsePagination } = require('../utils/query');

// Logging a real interaction (a call, visit or follow-up) means the agent has
// engaged the contact — so nudge that contact's brand-new leads to "Contacted".
const ENGAGING_KINDS = ['Call', 'Visit', 'Follow-up'];

async function advanceLeadsForContact(agentId, contactId, kind) {
  if (!contactId || !ENGAGING_KINDS.includes(kind)) return;
  try {
    await Lead.updateMany(
      { agentId, contactId, status: 'New' },
      { $set: { status: 'Contacted' } }
    );
  } catch (err) {
    console.error('Failed to advance leads after activity:', err.message);
  }
}

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

    // Keep the pipeline in sync: engaging a contact advances their new leads.
    await advanceLeadsForContact(req.user.id, contactId, activity.kind);
    await audit.record(req.user.id, 'create', 'Activity', activity._id, {
      after: audit.snapshot(activity),
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
    const { page, limit, skip } = parsePagination(req.query);
    const [activities, total] = await Promise.all([
      Activity.find(query)
        .sort({ scheduledAt: sortDir })
        .skip(skip)
        .limit(limit)
        .populate('contactId', 'name phone')
        .populate('propertyId', 'title location'),
      Activity.countDocuments(query),
    ]);

    res.status(200).json({ count: activities.length, total, page, limit, activities });
  } catch (error) {
    console.error('List activities error:', error);
    res.status(500).json({ error: 'Failed to fetch activities.' });
  }
};

exports.updateActivity = async (req, res) => {
  try {
    const before = await Activity.findOne({ _id: req.params.id, agentId: req.user.id });
    if (!before) return res.status(404).json({ error: 'Activity not found.' });

    const activity = await Activity.findOneAndUpdate(
      { _id: req.params.id, agentId: req.user.id },
      req.body,
      { new: true, runValidators: true }
    )
      .populate('contactId', 'name phone')
      .populate('propertyId', 'title location');

    await audit.record(req.user.id, 'update', 'Activity', activity._id, {
      before: audit.snapshot(before),
      after: audit.snapshot(activity),
    });
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
    await audit.record(req.user.id, 'delete', 'Activity', activity._id, {
      before: audit.snapshot(activity),
    });
    res.status(200).json({ message: 'Deleted.' });
  } catch (error) {
    console.error('Delete activity error:', error);
    res.status(500).json({ error: 'Failed to delete activity.' });
  }
};

// Sweep: any Scheduled activity whose time has passed is marked Missed. Run on an
// interval from the server so the agenda reflects reality without manual updates.
exports.markOverdueActivities = async () => {
  try {
    const res = await Activity.updateMany(
      { status: 'Scheduled', scheduledAt: { $lt: new Date() } },
      { $set: { status: 'Missed' } }
    );
    if (res.modifiedCount) {
      console.log(`Marked ${res.modifiedCount} overdue activit${res.modifiedCount === 1 ? 'y' : 'ies'} as Missed.`);
    }
  } catch (err) {
    console.error('Overdue activity sweep failed:', err.message);
  }
};
