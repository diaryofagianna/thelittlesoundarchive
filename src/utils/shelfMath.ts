import type {
  AppMode,
  FilterMode,
  MediaFormat,
  MediaRecord,
  PlayerSection,
} from '../types/media';

export interface ShelfTransform {
  x: number;
  y: number;
  z: number;
  rotY: number;
  scale: number;
  isFocused: boolean;
}

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

export interface SectionOption {
  id: PlayerSection;
  label: string;
}

export function filterRecords(
  records: MediaRecord[],
  filter: FilterMode
): MediaRecord[] {
  if (filter === 'all') {
    return records;
  }
  return records.filter((item) => item.format === filter);
}

export function clampShelfScroll(value: number, count: number): number {
  if (count <= 1) return 0;
  return Math.min(count - 1, Math.max(0, value));
}

export function nearestShelfIndex(scroll: number, count: number): number {
  if (count <= 0) return 0;
  return Math.round(clampShelfScroll(scroll, count));
}

export function computeShelfTransform(
  itemIndex: number,
  currentScroll: number
): ShelfTransform {
  const offset = itemIndex - currentScroll;
  const absOffset = Math.abs(offset);
  const focusWeight = Math.max(0, 1 - absOffset * 1.15);

  const x = offset * 3.15;
  const z = -absOffset * 0.55 - offset * offset * 0.11 + focusWeight * 0.42;
  const y = focusWeight * 0.16;
  const rotY = Math.max(-0.55, Math.min(0.55, -offset * 0.13));
  const scale = 0.92 + focusWeight * 0.14;

  return {
    x,
    y,
    z,
    rotY,
    scale,
    isFocused: absOffset < 0.45,
  };
}

export function formatLcdTime(seconds: number): string {
  const totalCentis = Math.max(0, Math.round(seconds * 100));
  const mins = Math.floor(totalCentis / 6000);
  const secs = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;
  return `${mins}.${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
}

export function formatDurationLabel(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function getSectionOptionsForFormat(format: MediaFormat): SectionOption[] {
  switch (format) {
    case 'cd':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'media', label: 'The disc' },
        { id: 'display', label: 'Display' },
        { id: 'volume', label: 'Volume' },
        { id: 'keys', label: 'Keys' },
      ];
    case 'cassette':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'media', label: 'The reels' },
        { id: 'display', label: 'Window' },
        { id: 'volume', label: 'Volume' },
        { id: 'keys', label: 'Keys' },
      ];
    case 'vinyl':
      return [
        { id: 'overview', label: 'Overview' },
        { id: 'media', label: 'The vinyl' },
        { id: 'display', label: 'Tonearm' },
        { id: 'volume', label: 'Speed' },
        { id: 'keys', label: 'Sleeve' },
      ];
  }
}

export function getCameraPoseForState(
  mode: AppMode,
  format: MediaFormat,
  section: PlayerSection
): CameraPose {
  if (mode !== 'player') {
    return {
      position: [0, 0.35, 7.6],
      target: [0, 0.02, 0],
    };
  }

  if (format === 'cd') {
    switch (section) {
      case 'overview':
        return { position: [0.0, 0.25, 6.75], target: [0.0, 0.08, 0] };
      case 'media':
        return { position: [1.05, 0.1, 3.25], target: [1.05, 0.06, 0.1] };
      case 'display':
        return { position: [1.45, 1.44, 2.55], target: [1.45, 1.42, 0.28] };
      case 'volume':
        return { position: [2.35, -0.3, 2.7], target: [1.95, -0.34, 0.18] };
      case 'keys':
        return { position: [1.05, -1.14, 2.65], target: [1.05, -1.14, 0.25] };
    }
  }

  if (format === 'cassette') {
    switch (section) {
      case 'overview':
        return { position: [0.0, 0.35, 5.9], target: [0, -0.02, 0] };
      case 'media':
        return { position: [-0.36, 0.04, 2.85], target: [-0.36, -0.02, 0.2] };
      case 'display':
        return { position: [-0.36, 0.42, 3.25], target: [-0.36, 0.0, 0.2] };
      case 'volume':
        return { position: [1.95, 0.15, 3.0], target: [1.45, 0.05, 0.15] };
      case 'keys':
        return { position: [-0.25, 1.35, 2.85], target: [-0.25, 0.85, 0.1] };
    }
  }

  // Vinyl Turntable poses (plinth tilted +0.24*PI toward camera)
  switch (section) {
    case 'overview':
      return { position: [0.0, 1.75, 6.1], target: [-0.18, -0.04, 0] };
    case 'media':
      return { position: [0.35, 1.55, 3.35], target: [0.35, 0.2, 0.1] };
    case 'display':
      return { position: [1.65, 1.35, 2.95], target: [1.4, 0.45, -0.25] };
    case 'volume':
      return { position: [-0.85, 1.15, 3.1], target: [-0.65, -0.1, 0.65] };
    case 'keys':
      return { position: [-2.35, 0.55, 3.9], target: [-2.25, 0.24, -0.1] };
  }
}

export function getNextRecordIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current + 1) % total;
}

export function getPrevRecordIndex(current: number, total: number): number {
  if (total <= 0) return 0;
  return (current - 1 + total) % total;
}
