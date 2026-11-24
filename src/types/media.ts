export type MediaFormat = 'cd' | 'cassette' | 'vinyl';

export type FilterMode = 'all' | MediaFormat;

export type AppMode = 'loader' | 'shelf' | 'player';

export type PlayerSection = 'overview' | 'media' | 'display' | 'volume' | 'keys';

export type MediaSide = 'A' | 'B';

export type CoverStyleId =
  | 'meadow-sky'
  | 'night-bus'
  | 'heatwave-static'
  | 'glass-harbor'
  | 'sunday-club'
  | 'copper-silence'
  | 'daylight-loop'
  | 'suburban-echo'
  | 'winter-concourse';

export interface TrackSideInfo {
  title: string;
  durationSec: number;
  bpm: number;
  rootHz: number;
  scaleIntervals: number[];
  waveform: 'sine' | 'triangle' | 'sawtooth' | 'square';
}

export interface MediaRecord {
  id: string;
  indexNumber: string;
  title: string;
  artist: string;
  format: MediaFormat;
  catalogCode: string;
  year: string;
  accentColor: string;
  shellColor: string;
  coverStyle: CoverStyleId;
  customCoverDataUrl?: string;
  customAudioUrl?: string;
  customAudioName?: string;
  sideA: TrackSideInfo;
  sideB: TrackSideInfo;
}

export interface PlayerStatusSnapshot {
  isPlaying: boolean;
  elapsedSec: number;
  durationSec: number;
  volume: number;
  side: MediaSide;
  antiSkip: boolean;
  rpmMode: 33 | 45;
  level: number;
}
