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

// Agenda / list. Filters: ?scope=overdue|today|upcoming|past, ?status=,
// ?contactId=, ?propertyId=, or an explicit ?from=&to= ISO range.
//
//  - overdue : still Scheduled but the time has passed — needs attention now.
//              (These stay actionable; they are NOT auto-archived.)
//  - today   : anything scheduled for the calendar day.
//  - upcoming: Scheduled and in the future.
//  - past    : the historical trail (done / cancelled / missed / any past time).
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
    } else if (scope === 'overdue') {
      // Past-due but the agent hasn't closed it out yet — the "needs action" bucket.
      query.status = query.status || 'Scheduled';
      query.scheduledAt = { $lt: now };
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

    // Overdue reads best oldest-first (most stale on top); upcoming ascending;
    // everything else newest-first.
    const sortDir = scope === 'upcoming' || scope === 'overdue' ? 1 : -1;
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

// Fetch a single activity (used by the edit form so it can prefill every field).
exports.getActivity = async (req, res) => {
  try {
    const activity = await Activity.findOne({ _id: req.params.id, agentId: req.user.id })
      .populate('contactId', 'name phone')
      .populate('propertyId', 'title location');
    if (!activity) return res.status(404).json({ error: 'Activity not found.' });
    res.status(200).json({ activity });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity.' });
  }
};

exports.updateActivity = async (req, res) => {
  try {
    const before = await Activity.findOne({ _id: req.params.id, agentId: req.user.id });
    if (!before) return res.status(404).json({ error: 'Activity not found.' });

    const update = { ...req.body };

    // Rescheduling to a future time revives a Missed/Cancelled item back to
    // Scheduled — unless the caller set an explicit status. This is what makes
    // "snooze / reschedule" behave the way an agent expects: it's live again.
    if (update.scheduledAt && update.status === undefined) {
      const when = new Date(update.scheduledAt);
      if (when > new Date() && (before.status === 'Missed' || before.status === 'Cancelled')) {
        update.status = 'Scheduled';
      }
    }

    // Marking Done stamps a completion time on the record for the timeline.
    if (update.status === 'Done' && update.completedAt === undefined) {
      update.completedAt = new Date();
    }

    const activity = await Activity.findOneAndUpdate(
      { _id: req.params.id, agentId: req.user.id },
      update,
      { new: true, runValidators: true }
    )
      .populate('contactId', 'name phone')
      .populate('propertyId', 'title location');

    // Completing/logging a real interaction advances the contact's new leads.
    if (update.status === 'Done') {
      await advanceLeadsForContact(req.user.id, String(before.contactId), activity.kind);
    }

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

// How long a time-bound event stays "overdue" (actionable) before it is
// auto-archived as Missed. Follow-ups and Notes are open tasks/records and are
// NEVER auto-missed — an agent must close them out deliberately. Default 24h.
const MISS_GRACE_MS = Number(process.env.ACTIVITY_MISS_GRACE_MS) || 24 * 60 * 60 * 1000;

// Sweep: a time-bound Scheduled event (a Visit or Call) whose time passed more
// than the grace window ago is archived as Missed. This keeps the agenda honest
// without yanking same-day follow-ups out from under the agent the moment their
// clock ticks past — those surface in the "Overdue" bucket until acted on.
exports.markOverdueActivities = async () => {
  try {
    const cutoff = new Date(Date.now() - MISS_GRACE_MS);
    const res = await Activity.updateMany(
      { status: 'Scheduled', kind: { $in: ['Visit', 'Call'] }, scheduledAt: { $lt: cutoff } },
      { $set: { status: 'Missed' } }
    );
    if (res.modifiedCount) {
      console.log(`Marked ${res.modifiedCount} overdue activit${res.modifiedCount === 1 ? 'y' : 'ies'} as Missed.`);
    }
  } catch (err) {
    console.error('Overdue activity sweep failed:', err.message);
  }
};
