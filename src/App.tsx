import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ProceduralAudioEngine } from './audio/synthEngine';
import { BottomControlDock } from './components/BottomControlDock';
import { CoverEditorModal } from './components/CoverEditorModal';
import { FrequencyVisualizerOverlay } from './components/FrequencyVisualizerOverlay';
import { LoaderScreen } from './components/LoaderScreen';
import { TopMetadataBar } from './components/TopMetadataBar';
import { SpotifyPanel } from './components/SpotifyPanel';
import { SpotifyConnectClient } from './utils/spotifyConnect';
import { INITIAL_CATALOG } from './data/catalog';
import { ListeningRoomScene } from './three/ListeningRoomScene';
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

export default function App() {
  const autostart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);
  const spotifyOAuthCallback = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const params = new URLSearchParams(window.location.search);
    return params.has('code') || params.has('error');
  }, []);

  const [mode, setMode] = useState<AppMode>(autostart || spotifyOAuthCallback ? 'shelf' : 'loader');
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
  const [spotifyPanelOpen, setSpotifyPanelOpen] = useState(spotifyOAuthCallback);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [spotifyControlActive, setSpotifyControlActive] = useState(false);
  const [spotifyConnectionMessage, setSpotifyConnectionMessage] = useState('');

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
  const spotifyClientRef = useRef<SpotifyConnectClient | null>(null);
  if (!spotifyClientRef.current) spotifyClientRef.current = new SpotifyConnectClient();
  const spotifyClient = spotifyClientRef.current;
  const volumeCommandTimerRef = useRef<number | null>(null);
  const pendingSpotifyVolumeRef = useRef(status.volume);

  // Refs for stable event callbacks inside WebGL mount
  const handleSelectForPlayerRef = useRef<(rec: MediaRecord) => void>(() => {});
  const handleHardwareActionRef = useRef<
    (action: 'stop' | 'togglePlay' | 'next' | 'prev' | 'side' | 'speed' | 'volume') => void
  >(() => {});

  const runSpotifyCommand = useCallback(async (command: 'toggle' | 'pause' | 'next' | 'previous' | 'volume', volume?: number): Promise<boolean> => {
    try {
      switch (command) {
        case 'toggle': await spotifyClient.togglePlayback(); break;
        case 'pause': await spotifyClient.pausePlayback(); break;
        case 'next': await spotifyClient.skipNext(); break;
        case 'previous': await spotifyClient.skipPrevious(); break;
        case 'volume': await spotifyClient.setVolume(volume ?? status.volume); break;
      }
      const labels = { toggle: 'Play / Pause', pause: 'Pause', next: 'Next track', previous: 'Previous track', volume: 'Volume' };
      setSpotifyConnectionMessage(`${labels[command]} command sent to Spotify Connect.`);
      return true;
    } catch (error) {
      setSpotifyConnectionMessage(error instanceof Error ? error.message : 'Spotify command failed.');
      return false;
    }
  }, [spotifyClient, status.volume]);

  const loadAndPlayInPlayer = useCallback(
    (rec: MediaRecord, autoPlay = true) => {
      setPlayerRecordId(rec.id);
      setSection('overview');
      setMode('player');
      setHoverHint(null);

      const audio = audioRef.current;
      if (spotifyControlActive) {
        // Spotify playback is external. Keep the 3D deck static rather than synchronizing visuals to recordings.
        audio?.stop();
        setStatus((prev) => ({ ...prev, isPlaying: false, elapsedSec: 0, level: 0, durationSec: (status.side === 'A' ? rec.sideA : rec.sideB).durationSec }));
        return;
      }
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
    [status.side, spotifyControlActive]
  );

  const handleTogglePlay = useCallback(() => {
    if (spotifyControlActive) {
      void runSpotifyCommand('toggle');
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
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
  }, [activePlayerRecord, status.isPlaying, status.side, spotifyControlActive, runSpotifyCommand]);

  const handleStop = useCallback(() => {
    if (spotifyControlActive) {
      void runSpotifyCommand('pause');
      return;
    }
    const audio = audioRef.current;
    if (audio) audio.stop();
    setStatus((prev) => ({
      ...prev,
      isPlaying: false,
      elapsedSec: 0,
      level: 0,
    }));
  }, [spotifyControlActive, runSpotifyCommand]);

  const handleStepTrackInPlayer = useCallback(
    (delta: number) => {
      if (spotifyControlActive) {
        void runSpotifyCommand(delta > 0 ? 'next' : 'previous');
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
    [records, activePlayerRecord.id, loadAndPlayInPlayer, spotifyControlActive, runSpotifyCommand]
  );

  const handleToggleSide = useCallback(
    (side: MediaSide) => {
      if (spotifyControlActive) {
        setSpotifyConnectionMessage('Side A/B is a cassette feature and does not change Spotify playback.');
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
    [mode, activePlayerRecord, focusedShelfRecord, status.isPlaying, spotifyControlActive]
  );

  const handleChangeVolume = useCallback((vol: number) => {
    if (spotifyControlActive) {
      const clamped = Math.max(0, Math.min(1, vol));
      pendingSpotifyVolumeRef.current = clamped;
      setStatus((prev) => ({ ...prev, volume: clamped }));
      if (volumeCommandTimerRef.current !== null) window.clearTimeout(volumeCommandTimerRef.current);
      // Debounce slider/knob input so rapid movement does not flood Spotify's player endpoint.
      volumeCommandTimerRef.current = window.setTimeout(() => {
        volumeCommandTimerRef.current = null;
        void runSpotifyCommand('volume', pendingSpotifyVolumeRef.current);
      }, 180);
      return;
    }
    const clamped = Math.max(0, Math.min(1, vol));
    audioRef.current?.setVolume(clamped);
    setStatus((prev) => ({ ...prev, volume: clamped }));
  }, [spotifyControlActive, runSpotifyCommand]);

  useEffect(() => () => {
    if (volumeCommandTimerRef.current !== null) window.clearTimeout(volumeCommandTimerRef.current);
  }, []);

  const handleToggleAntiSkip = useCallback(() => {
    setStatus((prev) => ({ ...prev, antiSkip: !prev.antiSkip }));
  }, []);

  const handleToggleRpm = useCallback(() => {
    if (spotifyControlActive) {
      setSpotifyConnectionMessage('Turntable RPM is a local visual-player setting; Spotify playback speed is not changed.');
      return;
    }
    setStatus((prev) => {
      const nextRpm = prev.rpmMode === 33 ? 45 : 33;
      audioRef.current?.setRpmMode(nextRpm);
      return { ...prev, rpmMode: nextRpm };
    });
  }, [spotifyControlActive]);

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

  const handleSpotifyConnectionChange = useCallback((connected: boolean) => {
    setSpotifyConnected(connected);
    if (!connected) setSpotifyControlActive(false);
    if (connected) {
      audioRef.current?.stop();
      setStatus((prev) => ({ ...prev, isPlaying: false, elapsedSec: 0, level: 0 }));
      setSpotifyConnectionMessage('Spotify account connected. Choose an available device to continue.');
    }
  }, []);

  const handleSpotifyControlModeChange = useCallback((active: boolean) => {
    if (active && !spotifyConnected) {
      setSpotifyConnectionMessage('Connect Spotify before enabling remote hardware controls.');
      return;
    }
    if (active) {
      audioRef.current?.stop();
      setStatus((prev) => ({ ...prev, isPlaying: false, elapsedSec: 0, level: 0 }));
      setSpotifyConnectionMessage('Spotify remote controls are active. The 3D player remains static while Spotify plays.');
    } else {
      setSpotifyConnectionMessage('Built-in demo player controls restored.');
    }
    setSpotifyControlActive(active);
  }, [spotifyConnected]);

  // Restore the tab-scoped Spotify session and finish a PKCE callback when returning from Spotify.
  useEffect(() => {
    let cancelled = false;
    void spotifyClient.initialize().then((result) => {
      if (cancelled) return;
      setSpotifyConnected(result.connected);
      if (result.callbackHandled) setSpotifyPanelOpen(true);
      if (result.error) setSpotifyConnectionMessage(result.error);
      else if (result.connected) setSpotifyConnectionMessage('Spotify account connected. Refresh devices to choose a playback target.');
    });
    return () => { cancelled = true; };
  }, [spotifyClient]);

  // Mount Three.js scene and Web Audio engine once
  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    const audio = new ProceduralAudioEngine();
    audioRef.current = audio;

    const scene = new ListeningRoomScene(mount, INITIAL_CATALOG, {
      onFocusIndexChange: (idx) => setFocusedIndex(idx),
      onSelectRecordForPlayer: (rec) => handleSelectForPlayerRef.current(rec),
      onHardwareAction: (action) => handleHardwareActionRef.current(action),
      onHoverMediaChange: (hovered, label) => setHoverHint(hovered ? label : null),
      onWebGlContextLost: (lost) => setWebglLost(lost),
    });
    sceneRef.current = scene;

    return () => {
      scene.dispose();
      sceneRef.current = null;
      audio.dispose();
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
          if (!spotifyControlActive) handleStop();
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
    spotifyControlActive,
  ]);

  const handleSaveEditedRecord = useCallback(
    (updated: MediaRecord) => {
      setRecords((prev) =>
        prev.map((r) => (r.id === updated.id ? updated : r))
      );
      sceneRef.current?.updateRecordMetadata(updated);
      if (mode === 'player' && activePlayerRecord.id === updated.id && !spotifyControlActive) {
        audioRef.current?.loadRecord(updated, status.side, status.isPlaying);
      }
    },
    [mode, activePlayerRecord.id, status.side, status.isPlaying, spotifyControlActive]
  );

  const handleBackToShelf = useCallback(() => {
    // Leaving the 3D room should not pause playback on an external Spotify Connect device.
    if (!spotifyControlActive) handleStop();
    setMode('shelf');
    const shelfIdx = filteredRecords.findIndex((r) => r.id === activePlayerRecord.id);
    if (shelfIdx >= 0) {
      setFocusedIndex(shelfIdx);
      sceneRef.current?.scrollToShelfIndex(shelfIdx);
    }
  }, [handleStop, spotifyControlActive, filteredRecords, activePlayerRecord.id]);

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
            onOpenSpotify={() => setSpotifyPanelOpen(true)}
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
            spotifyControlActive={spotifyControlActive}
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

      {spotifyControlActive && mode === 'player' && (
        <div className="fixed right-5 top-36 z-20 max-w-[min(340px,88vw)] border border-[#1DB954]/30 bg-[#F5F5F2]/95 px-3 py-2 shadow-sm" role="status">
          <p className="text-[10px] font-mono-tech font-semibold tracking-wide text-[#24643A]">SPOTIFY CONNECT REMOTE</p>
          <p className="mt-1 text-[10px] leading-relaxed text-[#5C5C58]">{spotifyConnectionMessage || 'Hardware controls send commands to your selected Spotify device.'}</p>
          <button type="button" onClick={() => setSpotifyPanelOpen(true)} className="mt-1 text-[10px] text-[#24643A] underline underline-offset-2">Manage device</button>
        </div>
      )}

      {spotifyPanelOpen && (
        <SpotifyPanel
          client={spotifyClient}
          connected={spotifyConnected}
          controlActive={spotifyControlActive}
          connectionMessage={spotifyConnectionMessage}
          onConnectionChange={handleSpotifyConnectionChange}
          onControlModeChange={handleSpotifyControlModeChange}
          onClose={() => setSpotifyPanelOpen(false)}
          onStartSpotify={() => {
            // Embed fallback is an independent Spotify player, not the Connect remote target.
            setSpotifyControlActive(false);
            audioRef.current?.stop();
            setStatus((prev) => ({ ...prev, isPlaying: false, elapsedSec: 0, level: 0 }));
          }}
        />
      )}

      {coverEditorOpen && (
        <CoverEditorModal
          record={displayRecord}
          onClose={() => setCoverEditorOpen(false)}
          onSaveRecord={handleSaveEditedRecord}
        />
      )}
    </main>
  );
}
