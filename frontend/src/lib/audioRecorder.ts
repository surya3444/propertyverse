import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import { PermissionsAndroid, Platform } from 'react-native';

// A ready-to-upload recording. `part` is what gets appended to FormData under
// the 'audio' field: on native it's an RN file descriptor object.
export interface Recording {
  uri: string;
  part: unknown;
  fileName: string;
  mimeType: string;
}

export async function requestPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    {
      title: 'Microphone access',
      message: 'PropertyVerse needs the microphone to record your voice note.',
      buttonPositive: 'Allow',
    }
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function startRecording(onTick: (elapsedMs: number) => void): Promise<void> {
  await AudioRecorderPlayer.startRecorder();
  AudioRecorderPlayer.addRecordBackListener((e) => onTick(e.currentPosition));
}

export async function stopRecording(): Promise<Recording> {
  const uri = await AudioRecorderPlayer.stopRecorder();
  AudioRecorderPlayer.removeRecordBackListener();
  return {
    uri,
    part: { uri, name: 'voice-note.m4a', type: 'audio/m4a' },
    fileName: 'voice-note.m4a',
    mimeType: 'audio/m4a',
  };
}

export async function cancelRecording(): Promise<void> {
  try {
    await AudioRecorderPlayer.stopRecorder();
    AudioRecorderPlayer.removeRecordBackListener();
  } catch {
    // already stopped
  }
}

export function formatElapsed(ms: number): string {
  return AudioRecorderPlayer.mmss(Math.floor(ms / 1000));
}
