// Tiny in-app event bus for "the unread count may have changed". The push layer
// (src/lib/push.ts) fires this when a real-time stream event arrives while the
// app is foregrounded, so the header bell can refresh its badge instantly
// instead of only on screen focus.
type Listener = () => void;

const listeners = new Set<Listener>();

export function onUnreadChanged(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function notifyUnreadChanged(): void {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* a bad listener must not break the others */
    }
  });
}
