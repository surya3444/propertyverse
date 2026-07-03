// Minimal ambient types for react-native-sound (the package ships no types).
declare module 'react-native-sound' {
  export default class Sound {
    static MAIN_BUNDLE: string;
    static setCategory(category: string, mixWithOthers?: boolean): void;
    constructor(filename: string, basePath: string, onError?: (error: unknown) => void);
    play(onEnd?: (success: boolean) => void): void;
    stop(callback?: () => void): void;
    setCurrentTime(seconds: number): void;
    setVolume(volume: number): Sound;
    release(): void;
    isLoaded(): boolean;
  }
}
