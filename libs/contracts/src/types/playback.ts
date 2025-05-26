import { MetronomeSettings } from './common.js';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  tempo: number;
  pitch: number;
  volume: number;
  metronomeSettings: MetronomeSettings;
}

export interface AudioTrack {
  id: string;
  url: string;
  type: 'reference' | 'drummer' | 'metronome';
  volume: number;
  muted: boolean;
}
