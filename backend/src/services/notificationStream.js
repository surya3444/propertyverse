// In-process pub/sub for real-time notification delivery over Server-Sent Events
// (SSE) — the self-hosted push transport (no Firebase). The Android app holds an
// SSE connection (via a foreground service) and posts a local notification for
// each event; the web app can consume the same stream.
//
// Memory-only and best-effort: on a process restart clients simply reconnect and
// catch up via GET /api/notifications. This works for a single backend process;
// behind multiple instances you'd swap this bus for a shared one (e.g. Redis
// pub/sub) — the public API here would stay the same.

// agentId (string) -> Set of open SSE `res` objects.
const clients = new Map();

// Register an open SSE response for an agent. Returns a cleanup function to call
// when the connection closes.
function addClient(agentId, res) {
  const key = String(agentId);
  let set = clients.get(key);
  if (!set) {
    set = new Set();
    clients.set(key, set);
  }
  set.add(res);
  return () => {
    const s = clients.get(key);
    if (!s) return;
    s.delete(res);
    if (s.size === 0) clients.delete(key);
  };
}

// Push an event to every open connection for an agent. No-op when nobody is
// listening. Never throws.
function publish(agentId, event) {
  const set = clients.get(String(agentId));
  if (!set || set.size === 0) return;
  const payload = `event: notification\ndata: ${JSON.stringify(event)}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch (_) {
      // Broken pipe: it'll be cleaned up by the connection's close handler.
    }
  }
}

// How many live connections an agent currently has (diagnostics / tests).
function clientCount(agentId) {
  const set = clients.get(String(agentId));
  return set ? set.size : 0;
}

module.exports = { addClient, publish, clientCount };
