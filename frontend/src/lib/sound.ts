import Sound from 'react-native-sound';

// Short UI cue sounds for record start/stop, played via react-native-sound.
// The audio files live in android/app/src/main/res/raw (Android) and the app
// bundle (iOS). Tactile feedback is handled separately by haptic() — see
// ./haptics. See sound.web.ts for the Web Audio implementation.
export type SoundCue = 'start' | 'stop';

// Play through the media/playback channel so cues are audible (and don't get
// treated as ringer sounds). Mix with other audio rather than interrupting it.
// Guarded so a not-yet-linked native module can't crash screen imports.
try {
  Sound.setCategory('Playback', true);
} catch {
  // native module unavailable (e.g. before the rebuild) — cues stay silent
}

const FILES: Record<SoundCue, string> = {
  start: 'rec_start.wav',
  stop: 'rec_stop.wav',
};

const cues: Partial<Record<SoundCue, Sound>> = {};

// Preload both cues once so the first tap doesn't pay decode latency.
(Object.keys(FILES) as SoundCue[]).forEach((cue) => {
  try {
    const sound = new Sound(FILES[cue], Sound.MAIN_BUNDLE, (error) => {
      if (!error) cues[cue] = sound;
    });
  } catch {
    // Sound is best-effort; never let it break recording.
  }
});

export function playCue(cue: SoundCue) {
  const sound = cues[cue];
  if (!sound) return;
  try {
    // Rewind then play so rapid start/stop taps always retrigger.
    sound.stop(() => {
      sound.setCurrentTime(0);
      sound.play();
    });
  } catch {
    // ignore
  }
}
