import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProceduralAudioEngine } from './audio/synthEngine';
import { BottomControlDock } from './components/BottomControlDock';
import { FrequencyVisualizerOverlay } from './components/FrequencyVisualizerOverlay';
import { LoaderScreen } from './components/LoaderScreen';
import { TopMetadataBar } from './components/TopMetadataBar';
import { getAudiusTrackStreamUrl, type AudiusTrack } from './utils/audius';
import {
  appendUniqueAudiusTracks,
  cycleAudiusRepeatMode,
  findAudiusQueueIndex,
  getNextAudiusQueueTrack,
  loadAudiusQueueState,
  removeAudiusQueueTrack,
  saveAudiusQueueState,
  shuffleAudiusQueue,
  type AudiusRepeatMode,
} from './utils/audiusQueue';
import { INITIAL_CATALOG } from './data/catalog';
import type { ListeningRoomScene } from './three/ListeningRoomScene';
import type {
  AppMode,
  FilterMode,
  MediaRecord,
  MediaSide,
  PlayerSection,
  PlayerStatusSnapshot,
} from './types/media';
import {
  filterRecords,
  getNextRecordIndex,
  getPrevRecordIndex,
} from './utils/shelfMath';

// Load the large 3D scene and optional panels as async chunks.
const AudiusPanel = lazy(async () => {
  const module = await import('./components/AudiusPanel');
  return { default: module.AudiusPanel };
});

const CoverEditorModal = lazy(async () => {
  const module = await import('./components/CoverEditorModal');
  return { default: module.CoverEditorModal };
});

export default function App() {
  const autostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);
  const [mode, setMode] = useState<AppMode>(autostart ? 'shelf' : 'loader');
  const [records, setRecords] = useState<MediaRecord[]>(INITIAL_CATALOG);
  const [filter, setFilter] = useState<FilterMode>('all');
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [playerRecordId, setPlayerRecordId] = useState<string>(INITIAL_CATALOG[0].id);
  const [section, setSection] = useState<PlayerSection>('overview');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showVisualizer, setShowVisualizer] = useState(true);
  const [coverEditorOpen, setCoverEditorOpen] = useState(false);
  const [hoverHint, setHoverHint] = useState<string | null>(null);
  const [webglLost, setWebglLost] = useState(false);
  const [audiusPanelOpen, setAudiusPanelOpen] = useState(false);
  const [audiusPanelInitialTab, setAudiusPanelInitialTab] = useState<'browse' | 'queue'>('browse');
  const [audiusActive, setAudiusActive] = useState(false);
  const [audiusMessage, setAudiusMessage] = useState('');
  const [audiusTrack, setAudiusTrack] = useState<AudiusTrack | null>(null);
  const [savedAudiusQueueState] = useState(() => loadAudiusQueueState());
  const [audiusQueue, setAudiusQueue] = useState<AudiusTrack[]>(savedAudiusQueueState.queue);
  const [shuffleEnabled, setShuffleEnabled] = useState(savedAudiusQueueState.shuffleEnabled);
  const [repeatMode, setRepeatMode] = useState<AudiusRepeatMode>(savedAudiusQueueState.repeatMode);
  const [queueSaved, setQueueSaved] = useState(savedAudiusQueueState.queue.length > 0);
  const audiusQueueRef = useRef<AudiusTrack[]>(audiusQueue);
  const repeatModeRef = useRef<AudiusRepeatMode>(repeatMode);
  audiusQueueRef.current = audiusQueue;
  repeatModeRef.current = repeatMode;
  const playAudiusQueueItemRef = useRef<(track: AudiusTrack, queue: AudiusTrack[]) => Promise<void>>(async () => {});

  const [status, setStatus] = useState<PlayerStatusSnapshot>({
    isPlaying: false,
    elapsedSec: 0,
    durationSec: INITIAL_CATALOG[0].sideA.durationSec,
    volume: 0.72,
    side: 'A',
    antiSkip: true,
    rpmMode: 33,
    level: 0,
  });

  const filteredRecords = useMemo(
    () => filterRecords(records, filter),
    [records, filter]
  );

  const focusedShelfRecord =
    filteredRecords[Math.min(focusedIndex, Math.max(0, filteredRecords.length - 1))] ||
    records[0];

  const activePlayerRecord = useMemo(
    () => records.find((r) => r.id === playerRecordId) || focusedShelfRecord,
    [records, playerRecordId, focusedShelfRecord]
  );

  const displayRecord = mode === 'player' ? activePlayerRecord : focusedShelfRecord;

  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ListeningRoomScene | null>(null);
  const audioRef = useRef<ProceduralAudioEngine | null>(null);
  const sceneInitStartedRef = useRef(false);
  const unmountedRef = useRef(false);
  const latestSceneSnapshotRef = useRef({
    mode,
    activeRecord: activePlayerRecord,
    section,
    status,
    visibleRecords: filteredRecords,
  });
  latestSceneSnapshotRef.current = {
    mode,
    activeRecord: activePlayerRecord,
    section,
    status,
    visibleRecords: filteredRecords,
  };

  // Refs for stable event callbacks inside WebGL mount
  const handleSelectForPlayerRef = useRef<(rec: MediaRecord) => void>(() => {});
  const handleHardwareActionRef = useRef<
    (action: 'stop' | 'togglePlay' | 'next' | 'prev' | 'side' | 'speed' | 'volume') => void
  >(() => {});

  // Save queue metadata and playback preferences automatically. Playback itself is never auto-started on reload.
  useEffect(() => {
    const saved = saveAudiusQueueState({ queue: audiusQueue, shuffleEnabled, repeatMode });
    setQueueSaved(saved);
  }, [audiusQueue, shuffleEnabled, repeatMode]);

  const playAudiusQueueItem = useCallback(async (
    track: AudiusTrack,
    queue: AudiusTrack[],
  ) => {
    const streamUrl = getAudiusTrackStreamUrl(track.id);
    const audio = audioRef.current;
    if (!audio) throw new Error('The listening-room audio engine is not ready.');

    // Publish queue changes before awaiting playback setup so tracks added while
    // a stream is preparing are not overwritten by an older queue snapshot.
    audiusQueueRef.current = queue;
    setAudiusQueue(queue);

    await audio.loadExternalTrack(
      { ...activePlayerRecord, title: track.title, artist: track.artist },
      track.id,
      streamUrl,
      true,
      () => {
        // Read the latest queue so tracks added while the current song is playing
        // are included when the browser fires the media element's `ended` event.
        const latestQueue = audiusQueueRef.current;
        const activeRepeatMode = repeatModeRef.current;
        const nextTrack = getNextAudiusQueueTrack(latestQueue, track.id, activeRepeatMode);
        if (nextTrack) {
          setAudiusMessage(activeRepeatMode === 'one'
            ? `Repeating · ${track.title}`
            : `Up next · ${nextTrack.title}`);
          void playAudiusQueueItemRef.current(nextTrack, latestQueue).catch(() => {
            setStatus((prev) => ({ ...prev, isPlaying: false, level: 0 }));
            setAudiusMessage('The next track could not be loaded. Choose another track from your queue.');
          });
          return;
        }
        setStatus((prev) => ({ ...prev, isPlaying: false, elapsedSec: prev.durationSec, level: 0 }));
        setAudiusMessage('Queue finished. Add more tracks to keep listening.');
      },
      () => {
        setStatus((prev) => ({ ...prev, isPlaying: false, level: 0 }));
        setAudiusMessage('This Audius stream could not be loaded. Try another public track.');
      },
    );

    setAudiusTrack(track);
    setAudiusActive(true);
    setAudiusMessage(`Now playing · ${track.title}`);
    setSection('overview');
    setMode('player');
    setStatus((prev) => ({
      ...prev,
      isPlaying: true,
      elapsedSec: 0,
      durationSec: track.durationSec || prev.durationSec,
      level: 0,
    }));
  }, [activePlayerRecord]);

  // Keep a stable callback ref for the HTMLAudioElement's asynchronous `ended` event.
  playAudiusQueueItemRef.current = playAudiusQueueItem;

  const handlePlayAudiusTrack = useCallback(async (track: AudiusTrack) => {
    const currentQueue = audiusQueueRef.current;
    const existingIndex = findAudiusQueueIndex(currentQueue, track.id);
    let nextQueue = currentQueue;

    if (existingIndex < 0) {
      if (audiusActive && audiusTrack) {
        const currentIndex = findAudiusQueueIndex(currentQueue, audiusTrack.id);
        const insertionIndex = currentIndex >= 0 ? currentIndex + 1 : currentQueue.length;
        nextQueue = [...currentQueue];
        nextQueue.splice(insertionIndex, 0, track);
      } else {
        nextQueue = [track, ...currentQueue];
      }
    }

    if (shuffleEnabled) nextQueue = shuffleAudiusQueue(nextQueue, track.id);
    await playAudiusQueueItem(track, nextQueue);
  }, [audiusActive, audiusTrack, playAudiusQueueItem, shuffleEnabled]);

  const handleAddAudiusTracks = useCallback((tracks: AudiusTrack[]) => {
    const result = appendUniqueAudiusTracks(audiusQueueRef.current, tracks);
    const nextQueue = shuffleEnabled && result.addedCount > 0
      ? shuffleAudiusQueue(result.queue, audiusTrack?.id ?? null)
      : result.queue;
    audiusQueueRef.current = nextQueue;
    setAudiusQueue(nextQueue);
    if (result.addedCount > 0) {
      setAudiusMessage(`${result.addedCount} ${result.addedCount === 1 ? 'track' : 'tracks'} added to queue.`);
    }
    return result.addedCount;
  }, [shuffleEnabled, audiusTrack]);

  const handleRemoveAudiusTrack = useCallback((trackId: string) => {
    const previousQueue = audiusQueueRef.current;
    const nextQueue = removeAudiusQueueTrack(previousQueue, trackId, audiusTrack?.id ?? null);
    if (nextQueue === previousQueue) return;

    audiusQueueRef.current = nextQueue;
    setAudiusQueue(nextQueue);
    setAudiusMessage('Track removed from queue.');
  }, [audiusTrack]);

  const handleClearAudiusQueue = useCallback(() => {
    const keepCurrent = audiusActive && audiusTrack ? [audiusTrack] : [];
    audiusQueueRef.current = keepCurrent;
    setAudiusQueue(keepCurrent);
    setAudiusMessage(keepCurrent.length > 0 ? 'Upcoming tracks cleared. The current track will finish.' : 'Queue cleared.');
  }, [audiusActive, audiusTrack]);

  const handlePlayAudiusQueue = useCallback(async () => {
    const queue = audiusQueueRef.current;
    if (queue.length === 0) throw new Error('Add tracks to your queue first.');
    const track = queue[0];
    if (!track) throw new Error('Your queue is empty.');
    await playAudiusQueueItem(track, queue);
  }, [playAudiusQueueItem]);

  const handleToggleShuffle = useCallback(() => {
    const nextEnabled = !shuffleEnabled;
    if (nextEnabled) {
      const nextQueue = shuffleAudiusQueue(audiusQueueRef.current, audiusTrack?.id ?? null);
      audiusQueueRef.current = nextQueue;
      setAudiusQueue(nextQueue);
    }
    setShuffleEnabled(nextEnabled);
    setAudiusMessage(nextEnabled ? 'Shuffle enabled · upcoming tracks reordered.' : 'Shuffle disabled · current queue order retained.');
  }, [shuffleEnabled, audiusTrack]);

  const handleCycleRepeatMode = useCallback(() => {
    const nextMode = cycleAudiusRepeatMode(repeatMode);
    setRepeatMode(nextMode);
    const label = nextMode === 'one' ? 'Repeat One' : nextMode === 'queue' ? 'Repeat Queue' : 'Repeat Off';
    setAudiusMessage(`${label} enabled.`);
  }, [repeatMode]);

  const handleSaveAudiusQueue = useCallback(() => {
    const saved = saveAudiusQueueState({
      queue: audiusQueueRef.current,
      shuffleEnabled,
      repeatMode,
    });
    setQueueSaved(saved);
    setAudiusMessage(saved
      ? 'Queue saved in this browser. It will be available next time you visit.'
      : 'This browser could not save local data. Check storage permissions or available space.');
  }, [shuffleEnabled, repeatMode]);

  const loadAndPlayInPlayer = useCallback(
    (rec: MediaRecord, autoPlay = true) => {
      setPlayerRecordId(rec.id);
      setSection('overview');
      setMode('player');
      setHoverHint(null);

      setAudiusActive(false);
      setAudiusTrack(null);
      const audio = audioRef.current;
      if (audio) {
        audio.loadRecord(rec, status.side, autoPlay);
      }

      const track = status.side === 'A' ? rec.sideA : rec.sideB;
      setStatus((prev) => ({
        ...prev,
        isPlaying: autoPlay,
        elapsedSec: 0,
        durationSec: track.durationSec,
      }));
    },
    [status.side]
  );

  const handleTogglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audiusActive) {
      if (status.isPlaying) {
        audio.pause();
        setStatus((prev) => ({ ...prev, isPlaying: false, elapsedSec: audio.getElapsedSec(), level: 0 }));
      } else {
        const reachedEnd = status.durationSec > 0 && status.elapsedSec >= status.durationSec - 0.5;
        if (reachedEnd) {
          const queue = audiusQueueRef.current;
          const nextTrack = getNextAudiusQueueTrack(queue, audiusTrack?.id ?? null, repeatModeRef.current);
          if (nextTrack) {
            void playAudiusQueueItem(nextTrack, queue);
            return;
          }
          audio.stop();
        }
        audio.play();
        setStatus((prev) => ({ ...prev, isPlaying: true, elapsedSec: audio.getElapsedSec() }));
      }
      return;
    }
    if (status.isPlaying) {
      audio.pause();
      setStatus((prev) => ({
        ...prev,
        isPlaying: false,
        elapsedSec: audio.getElapsedSec(),
        level: 0,
      }));
    } else {
      audio.loadRecord(activePlayerRecord, status.side, true);
      setStatus((prev) => ({ ...prev, isPlaying: true }));
    }
  }, [activePlayerRecord, status.isPlaying, status.side, status.elapsedSec, status.durationSec, audiusActive, audiusTrack, playAudiusQueueItem]);

  const handleStop = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.stop();
    setStatus((prev) => ({
      ...prev,
      isPlaying: false,
      elapsedSec: 0,
      level: 0,
    }));
  }, []);

  const handleStepTrackInPlayer = useCallback(
    (delta: number) => {
      if (audiusActive && audiusQueue.length > 0) {
        const currentIndex = findAudiusQueueIndex(audiusQueue, audiusTrack?.id ?? null);
        let nextIndex = currentIndex < 0 ? 0 : currentIndex + delta;
        if (nextIndex < 0 || nextIndex >= audiusQueue.length) {
          if (repeatModeRef.current === 'queue') {
            nextIndex = nextIndex < 0 ? audiusQueue.length - 1 : 0;
          } else if (delta < 0) {
            nextIndex = 0;
          } else {
            audioRef.current?.stop();
            setStatus((prev) => ({ ...prev, isPlaying: false, elapsedSec: 0, level: 0 }));
            setAudiusMessage('End of queue. Add more tracks or enable Repeat Queue.');
            return;
          }
        }
        const nextTrack = audiusQueue[nextIndex];
        if (nextTrack) void playAudiusQueueItem(nextTrack, audiusQueue);
        return;
      }
      const idx = records.findIndex((r) => r.id === activePlayerRecord.id);
      const nextIdx =
        delta > 0
          ? getNextRecordIndex(idx, records.length)
          : getPrevRecordIndex(idx, records.length);
      const nextRec = records[nextIdx];
      if (nextRec) {
        loadAndPlayInPlayer(nextRec, true);
      }
    },
    [records, activePlayerRecord.id, loadAndPlayInPlayer, audiusActive, audiusQueue, audiusTrack, playAudiusQueueItem]
  );

  const handleToggleSide = useCallback(
    (side: MediaSide) => {
      if (audiusActive) {
        setAudiusMessage('Side A/B switches the local cassette demo; Audius tracks play as a standalone stream.');
        return;
      }
      const targetRec = mode === 'player' ? activePlayerRecord : focusedShelfRecord;
      const track = side === 'A' ? targetRec.sideA : targetRec.sideB;
      const audio = audioRef.current;
      if (audio && mode === 'player') {
        const wasPlaying = status.isPlaying;
        audio.loadRecord(targetRec, side, wasPlaying);
      }
      setStatus((prev) => ({
        ...prev,
        side,
        elapsedSec: 0,
        durationSec: track.durationSec,
      }));
    },
    [mode, activePlayerRecord, focusedShelfRecord, status.isPlaying, audiusActive]
  );

  const handleChangeVolume = useCallback((vol: number) => {
    const clamped = Math.max(0, Math.min(1, vol));
    audioRef.current?.setVolume(clamped);
    setStatus((prev) => ({ ...prev, volume: clamped }));
  }, []);

  const handleToggleAntiSkip = useCallback(() => {
    setStatus((prev) => ({ ...prev, antiSkip: !prev.antiSkip }));
  }, []);

  const handleToggleRpm = useCallback(() => {
    if (audiusActive) {
      setAudiusMessage('RPM is a local turntable setting and does not change the speed of an Audius stream.');
      return;
    }
    setStatus((prev) => {
      const nextRpm = prev.rpmMode === 33 ? 45 : 33;
      audioRef.current?.setRpmMode(nextRpm);
      return { ...prev, rpmMode: nextRpm };
    });
  }, [audiusActive]);

  handleSelectForPlayerRef.current = (rec) => {
    loadAndPlayInPlayer(rec, true);
  };

  handleHardwareActionRef.current = (action) => {
    switch (action) {
      case 'togglePlay':
        handleTogglePlay();
        break;
      case 'stop':
        handleStop();
        break;
      case 'next':
        handleStepTrackInPlayer(1);
        break;
      case 'prev':
        handleStepTrackInPlayer(-1);
        break;
      case 'side':
        handleToggleSide(status.side === 'A' ? 'B' : 'A');
        break;
      case 'speed':
        handleToggleRpm();
        break;
      case 'volume':
        handleChangeVolume(status.volume >= 0.9 ? 0.3 : status.volume + 0.2);
        break;
    }
  };

  // Load the heavy Three.js scene only after the intro screen is complete.
  // This keeps the initial entry chunk small while preserving the same scene API.
  useEffect(() => {
    if (mode === 'loader' || sceneInitStartedRef.current) return;

    const mount = canvasMountRef.current;
    if (!mount) return;

    sceneInitStartedRef.current = true;

    const audio = new ProceduralAudioEngine();
    audio.setVolume(latestSceneSnapshotRef.current.status.volume);
    audioRef.current = audio;

    void import('./three/ListeningRoomScene')
      .then(({ ListeningRoomScene: Scene }) => {
        if (unmountedRef.current) return;

        const scene = new Scene(mount, INITIAL_CATALOG, {
          onFocusIndexChange: (idx) => setFocusedIndex(idx),
          onSelectRecordForPlayer: (rec) => handleSelectForPlayerRef.current(rec),
          onHardwareAction: (action) => handleHardwareActionRef.current(action),
          onHoverMediaChange: (hovered, label) => setHoverHint(hovered ? label : null),
          onWebGlContextLost: (lost) => setWebglLost(lost),
        });
        sceneRef.current = scene;

        // Effects may have run before the async scene chunk finished loading.
        const snapshot = latestSceneSnapshotRef.current;
        scene.setVisibleRecords(snapshot.visibleRecords);
        scene.setAppState({
          mode: snapshot.mode,
          activeRecord: snapshot.activeRecord,
          section: snapshot.section,
          status: snapshot.status,
        });
      })
      .catch((error: unknown) => {
        if (unmountedRef.current) return;
        console.error('Unable to load the 3D listening room scene.', error);
        setHoverHint('The 3D listening room could not be initialized. Please reload the page.');
      });
  }, [mode]);

  // Dispose the scene and audio engine only when the React app unmounts.
  useEffect(() => {
    return () => {
      unmountedRef.current = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
      audioRef.current?.dispose();
      audioRef.current = null;
    };
  }, []);

  // Sync filtered shelf records into Three.js
  useEffect(() => {
    if (!sceneRef.current) return;
    setFocusedIndex(0);
    sceneRef.current.setVisibleRecords(filteredRecords);
    sceneRef.current.scrollToShelfIndex(0);
  }, [filteredRecords]);

  // Sync mode, active record, section, and status to Three.js
  useEffect(() => {
    sceneRef.current?.setAppState({
      mode,
      activeRecord: activePlayerRecord,
      section,
      status,
    });
  }, [mode, activePlayerRecord, section, status]);

  // Throttled 10Hz playback timer & VU level update
  useEffect(() => {
    if (!status.isPlaying) return;
    const id = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio) return;
      const elapsedSec = audio.getElapsedSec();
      const level = audio.getLevel();
      setStatus((prev) => {
        const next = { ...prev, elapsedSec, level };
        sceneRef.current?.updatePlaybackTick(next);
        return next;
      });
    }, 100);
    return () => window.clearInterval(id);
  }, [status.isPlaying]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (coverEditorOpen) {
        if (e.key === 'Escape') setCoverEditorOpen(false);
        return;
      }
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'h' || e.key === 'H') {
        setDockCollapsed((c) => !c);
        return;
      }

      if (mode === 'shelf') {
        if (e.key === 'ArrowRight') {
          sceneRef.current?.stepShelf(1);
        } else if (e.key === 'ArrowLeft') {
          sceneRef.current?.stepShelf(-1);
        } else if (e.key === 'Enter') {
          loadAndPlayInPlayer(focusedShelfRecord, true);
        }
      } else if (mode === 'player') {
        if (e.key === ' ') {
          e.preventDefault();
          handleTogglePlay();
        } else if (e.key === 'Escape') {
          if (!audiusActive) handleStop();
          setMode('shelf');
        } else if (e.key === 'ArrowRight') {
          handleStepTrackInPlayer(1);
        } else if (e.key === 'ArrowLeft') {
          handleStepTrackInPlayer(-1);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    coverEditorOpen,
    mode,
    focusedShelfRecord,
    loadAndPlayInPlayer,
    handleTogglePlay,
    handleStop,
    handleStepTrackInPlayer,
    audiusActive,
  ]);

  const handleSaveEditedRecord = useCallback(
    (updated: MediaRecord) => {
      setRecords((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
      sceneRef.current?.updateRecordMetadata(updated);
      if (mode === 'player' && activePlayerRecord.id === updated.id && !audiusActive) {
        audioRef.current?.loadRecord(updated, status.side, status.isPlaying);
      }
    },
    [mode, activePlayerRecord.id, status.side, status.isPlaying, audiusActive]
  );

  const handleBackToShelf = useCallback(() => {
    // Let an Audius stream continue while browsing the shelf.
    if (!audiusActive) handleStop();
    setMode('shelf');
    const shelfIdx = filteredRecords.findIndex((r) => r.id === activePlayerRecord.id);
    if (shelfIdx >= 0) {
      setFocusedIndex(shelfIdx);
      sceneRef.current?.scrollToShelfIndex(shelfIdx);
    }
  }, [handleStop, audiusActive, filteredRecords, activePlayerRecord.id]);

  return (
    <main
      className="relative w-full h-full overflow-hidden bg-[#EDEDEA] studio-backdrop-grid select-none"
      data-mode={mode}
      data-active-id={displayRecord.id}
      data-playing={status.isPlaying ? 'true' : 'false'}
    >
      {/* Dedicated isolated WebGL canvas container */}
      <div
        ref={canvasMountRef}
        className="absolute inset-0 z-0"
        aria-label="Interactive 3D Sound Archive"
      />

      {webglLost && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-[#EDEDEA]/95 p-6">
          <div className="max-w-sm border border-[#171717]/20 bg-white p-6 text-center">
            <h2 className="text-base font-bold text-[#171717]">
              3D Graphics Context Paused
            </h2>
            <p className="mt-2 text-xs text-[#5C5C58]">
              WebGL rendering was interrupted by the browser. Reload the page to restore the 3D shelf and hardware players.
            </p>
          </div>
        </div>
      )}

      {mode === 'loader' && (
        <LoaderScreen onComplete={() => setMode('shelf')} />
      )}

      {mode !== 'loader' && (
        <>
          <TopMetadataBar
            mode={mode}
            record={displayRecord}
            side={status.side}
            totalCount={filteredRecords.length}
            hoverHint={hoverHint}
            onOpenPlayer={() => loadAndPlayInPlayer(focusedShelfRecord, true)}
            onBackToShelf={handleBackToShelf}
            onOpenCoverEditor={() => setCoverEditorOpen(true)}
            onOpenAudius={() => { setAudiusPanelInitialTab('browse'); setAudiusPanelOpen(true); }}
            audiusTrack={audiusActive ? audiusTrack : null}
          />

          <FrequencyVisualizerOverlay
            visible={mode === 'player' && status.isPlaying && showVisualizer}
            isPlaying={status.isPlaying}
            accentColor={displayRecord.accentColor}
            formatLabel={displayRecord.format}
            getFrequencyBands={(count) =>
              audioRef.current ? audioRef.current.getFrequencyBands(count) : []
            }
          />

          <BottomControlDock
            mode={mode}
            collapsed={dockCollapsed}
            onToggleCollapse={() => setDockCollapsed((c) => !c)}
            filter={filter}
            onChangeFilter={setFilter}
            activeRecord={displayRecord}
            section={section}
            onChangeSection={setSection}
            status={status}
            audiusActive={audiusActive}
            audiusTrack={audiusTrack}
            audiusQueueCount={audiusQueue.length}
            shuffleEnabled={shuffleEnabled}
            repeatMode={repeatMode}
            queueSaved={queueSaved}
            onToggleShuffle={handleToggleShuffle}
            onCycleRepeatMode={handleCycleRepeatMode}
            onSaveAudiusQueue={handleSaveAudiusQueue}
            onOpenAudiusQueue={() => { setAudiusPanelInitialTab('queue'); setAudiusPanelOpen(true); }}
            onStepShelf={(delta) => sceneRef.current?.stepShelf(delta)}
            onTogglePlay={handleTogglePlay}
            onStop={handleStop}
            onNextTrack={() => handleStepTrackInPlayer(1)}
            onPrevTrack={() => handleStepTrackInPlayer(-1)}
            onToggleSide={handleToggleSide}
            onChangeVolume={handleChangeVolume}
            onToggleAntiSkip={handleToggleAntiSkip}
            onToggleRpm={handleToggleRpm}
            showVisualizer={showVisualizer}
            onToggleVisualizer={() => setShowVisualizer((v) => !v)}
          />
        </>
      )}

      {audiusActive && mode === 'player' && (
        <div className="fixed right-5 top-36 z-20 max-w-[min(340px,88vw)] border border-[#648B72]/30 bg-[#F5F5F2]/95 px-3 py-2 shadow-sm" role="status">
          <p className="text-[10px] font-mono-tech font-semibold tracking-wide text-[#405E49]">AUDIUS STREAMING</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[#5C5C58]">{audiusMessage || 'Audio is streaming directly in this browser.'}</p>
          <button type="button" onClick={() => { setAudiusPanelInitialTab('browse'); setAudiusPanelOpen(true); }} className="mt-1 text-[10px] text-[#405E49] underline underline-offset-2">Browse Audius tracks</button>
        </div>
      )}

      {audiusPanelOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 text-xs text-white" role="status">Loading Audius catalog…</div>}>
          <AudiusPanel
            initialTab={audiusPanelInitialTab}
            currentTrackId={audiusTrack?.id ?? null}
            queue={audiusQueue}
            shuffleEnabled={shuffleEnabled}
            repeatMode={repeatMode}
            queueSaved={queueSaved}
            onToggleShuffle={handleToggleShuffle}
            onCycleRepeatMode={handleCycleRepeatMode}
            onSaveQueue={handleSaveAudiusQueue}
            onPlayTrack={handlePlayAudiusTrack}
            onPlayQueue={handlePlayAudiusQueue}
            onAddTracks={handleAddAudiusTracks}
            onRemoveTrack={handleRemoveAudiusTrack}
            onClearQueue={handleClearAudiusQueue}
            onClose={() => setAudiusPanelOpen(false)}
          />
        </Suspense>
      )}

      {coverEditorOpen && (
        <Suspense fallback={<div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 text-xs text-white" role="status">Loading cover editor…</div>}>
          <CoverEditorModal
            record={displayRecord}
            onClose={() => setCoverEditorOpen(false)}
            onSaveRecord={handleSaveEditedRecord}
          />
        </Suspense>
      )}
    </main>
  );
}
