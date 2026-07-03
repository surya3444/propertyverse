const Notification = require('../models/Notification');
const pushService = require('./pushService');

// Raise a notification for a new public form submission: persist the in-app
// notification (surfaced by the bell/badge) and best-effort push it to the
// agent's devices. Never throws — a notification failure must not fail the
// public submission that triggered it.
async function notifyFormResponse(agentId, { form, response, entityType, entityId, personName }) {
  const who = personName || 'Someone';
  const noun = form.type === 'property' ? 'submitted a property' : 'submitted a requirement';
  const title = form.type === 'property' ? 'New property submission' : 'New lead from your form';
  const body = `${who} ${noun} via “${form.title}”.`;

  try {
    const notification = await Notification.create({
      agentId,
      type: 'form_response',
      title,
      body,
      formId: form._id,
      responseId: response._id,
      entityType,
      entityId,
    });

    await pushService.sendToAgent(agentId, {
      title,
      body,
      data: {
        type: 'form_response',
        notificationId: notification._id.toString(),
        entityType: entityType || '',
        entityId: entityId ? entityId.toString() : '',
        formId: form._id.toString(),
      },
    });
    return notification;
  } catch (err) {
    console.warn('[notify] notifyFormResponse failed:', err.message);
    return null;
  }
}

module.exports = { notifyFormResponse };
