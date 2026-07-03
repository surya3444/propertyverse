// Web recording via the browser MediaRecorder API.
export interface Recording {
  uri: string;
  part: unknown; // a Blob on web
  fileName: string;
  mimeType: string;
}

let mediaRecorder: MediaRecorder | null = null;
let stream: MediaStream | null = null;
let chunks: Blob[] = [];
let startTs = 0;
let timer: ReturnType<typeof setInterval> | null = null;

// Prefer a container Gemini understands well; fall back to whatever the browser supports.
function pickMimeType(): string {
  const candidates = ['audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm'];
  for (const c of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(c)) return c;
  }
  return '';
}

export async function requestPermission(): Promise<boolean> {
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: true });
    s.getTracks().forEach((t) => t.stop());
    return true;
  } catch {
    return false;
  }
}

export async function startRecording(onTick: (elapsedMs: number) => void): Promise<void> {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  const mimeType = pickMimeType();
  mediaRecorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.start();
  startTs = Date.now();
  timer = setInterval(() => onTick(Date.now() - startTs), 200);
}

export function stopRecording(): Promise<Recording> {
  return new Promise((resolve) => {
    const recorder = mediaRecorder;
    if (!recorder) {
      resolve({ uri: '', part: new Blob(), fileName: 'voice-note.webm', mimeType: 'audio/webm' });
      return;
    }
    recorder.onstop = () => {
      if (timer) clearInterval(timer);
      const mimeType = recorder.mimeType || 'audio/webm';
      const blob = new Blob(chunks, { type: mimeType });
      stream?.getTracks().forEach((t) => t.stop());
      const ext = mimeType.includes('mp4')
        ? 'mp4'
        : mimeType.includes('ogg')
        ? 'ogg'
        : 'webm';
      resolve({
        uri: URL.createObjectURL(blob),
        part: blob,
        fileName: `voice-note.${ext}`,
        mimeType: mimeType.split(';')[0],
      });
    };
    recorder.stop();
  });
}

export async function cancelRecording(): Promise<void> {
  if (timer) clearInterval(timer);
  try {
    mediaRecorder?.stop();
    stream?.getTracks().forEach((t) => t.stop());
  } catch {
    // already stopped
  }
}

export function formatElapsed(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = String(Math.floor(total / 60)).padStart(2, '0');
  const s = String(total % 60).padStart(2, '0');
  return `${m}:${s}`;
}
