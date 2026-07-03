// Web implementation of the record start/stop cue sounds using the Web Audio
// API — no assets to bundle. A rising two-note chirp for start, a lower
// falling one for stop.
export type SoundCue = 'start' | 'stop';

let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext || (window as any).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  return ctx;
}

function beep(ac: AudioContext, freq: number, start: number, duration: number) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  // Quick fade in/out so the tone doesn't click.
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
  gain.gain.linearRampToValueAtTime(0, start + duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(start);
  osc.stop(start + duration);
}

export function playCue(cue: SoundCue) {
  try {
    const ac = context();
    if (!ac) return;
    if (ac.state === 'suspended') ac.resume();
    const t = ac.currentTime;
    if (cue === 'start') {
      beep(ac, 660, t, 0.1);
      beep(ac, 880, t + 0.1, 0.12);
    } else {
      beep(ac, 660, t, 0.1);
      beep(ac, 440, t + 0.1, 0.14);
    }
  } catch {
    // Sound is best-effort; never let it break the interaction.
  }
}
