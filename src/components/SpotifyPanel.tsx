import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ExternalLink, Music2, RefreshCw, X } from 'lucide-react';
import { parseSpotifyLink, type SpotifyEmbedTarget } from '../utils/spotify';
import {
  SpotifyConnectError,
  type SpotifyConnectDevice,
  type SpotifyConnectClient,
} from '../utils/spotifyConnect';

interface SpotifyPanelProps {
  onClose: () => void;
  onStartSpotify: () => void;
  client: SpotifyConnectClient;
  connected: boolean;
  controlActive: boolean;
  connectionMessage: string;
  onConnectionChange: (connected: boolean) => void;
  onControlModeChange: (active: boolean) => void;
}

export function SpotifyPanel({
  onClose,
  onStartSpotify,
  client,
  connected,
  controlActive,
  connectionMessage,
  onConnectionChange,
  onControlModeChange,
}: SpotifyPanelProps) {
  const [link, setLink] = useState('');
  const [target, setTarget] = useState<SpotifyEmbedTarget | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [devices, setDevices] = useState<SpotifyConnectDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const selectedDeviceRef = useRef('');

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const refreshDevices = useCallback(async () => {
    if (!connected) return;
    setLoadingDevices(true);
    setError('');
    try {
      const found = await client.getAvailableDevices();
      setDevices(found);
      const active = found.find((device) => device.is_active && !device.is_restricted);
      const current = found.find((device) => device.id === selectedDeviceRef.current && !device.is_restricted);
      const chosen = current?.id || active?.id || ''; // Never silently transfer playback to an inactive device.
      selectedDeviceRef.current = chosen;
      setSelectedDeviceId(chosen);
      client.setTargetDevice(chosen || null);
      if (found.length === 0) {
        setMessage('No Spotify Connect devices found. Open Spotify on a phone, computer or speaker, then refresh.');
      } else {
        setMessage('Choose an available device. Start Spotify playback on the target device first; restricted devices cannot receive commands.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load Spotify devices.');
    } finally {
      setLoadingDevices(false);
    }
  }, [client, connected]);

  useEffect(() => {
    if (connected) void refreshDevices();
  }, [connected, refreshDevices]);

  const handleConnect = async () => {
    setError('');
    setMessage('Opening Spotify authorization…');
    try {
      await client.startAuthorization();
    } catch (caught) {
      setError(caught instanceof SpotifyConnectError ? caught.message : 'Could not start Spotify sign-in.');
      setMessage('');
    }
  };

  const handleDisconnect = () => {
    client.disconnect();
    setDevices([]);
    selectedDeviceRef.current = '';
    setSelectedDeviceId('');
    onControlModeChange(false);
    onConnectionChange(false);
    setMessage('Spotify has been disconnected from this browser session.');
    setError('');
  };

  const handleDeviceChange = async (deviceId: string) => {
    const previousDeviceId = selectedDeviceId;
    selectedDeviceRef.current = deviceId;
    setSelectedDeviceId(deviceId);
    setError('');
    const chosen = devices.find((device) => device.id === deviceId);
    if (!chosen || !deviceId) return;
    setBusy(true);
    try {
      if (chosen.is_active) {
        client.setTargetDevice(deviceId);
        setMessage(`Remote controls are targeting ${chosen.name}.`);
      } else {
        await client.transferPlayback(deviceId);
        setMessage(`Playback control transferred to ${chosen.name}.`);
        await refreshDevices();
      }
    } catch (caught) {
      selectedDeviceRef.current = previousDeviceId;
      setSelectedDeviceId(previousDeviceId);
      setError(caught instanceof Error ? caught.message : 'Could not select this device.');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = parseSpotifyLink(link);
    if (!parsed) {
      setError('Paste a valid Spotify track, album, playlist, artist, show or episode link.');
      return;
    }
    setError('');
    setTarget(parsed);
    onStartSpotify();
  };

  const activeDevice = devices.find((device) => device.id === selectedDeviceId);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#171717]/35 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotify-panel-title"
        className="max-h-[92vh] w-full max-w-[620px] overflow-y-auto border border-[#171717]/20 bg-[#F5F5F2] p-4 shadow-2xl sm:p-5"
      >
        <header className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-[10px] font-mono-tech tracking-[0.16em] text-[#648B72]">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#1DB954]" />
              SPOTIFY CONNECT REMOTE
            </div>
            <h2 id="spotify-panel-title" className="text-lg font-semibold tracking-tight text-[#171717]">
              Listen with Spotify
            </h2>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-[#62625D]">
              Use the CD, cassette and vinyl controls as a remote for a Spotify Connect device.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Spotify panel"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-[#171717]/15 bg-white text-[#454542] hover:bg-[#E7E7E2] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <section className="border border-[#171717]/15 bg-white p-3 sm:p-4" aria-label="Spotify Connect account and devices">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-[#171717]">Spotify account</p>
              <p className="mt-0.5 text-[11px] text-[#777770]">
                {connected ? 'Authorized for playback control in this browser session.' : 'Connect your account to control Spotify devices.'}
              </p>
            </div>
            {connected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                className="h-8 border border-[#171717]/20 px-3 text-[11px] font-medium text-[#454542] hover:bg-[#F1F1ED]"
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleConnect()}
                disabled={!client.isConfigured || busy}
                className="inline-flex h-9 items-center gap-2 bg-[#1DB954] px-3 text-xs font-semibold text-[#102015] hover:bg-[#1ed760] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Music2 className="h-4 w-4" aria-hidden="true" />
                Connect Spotify
              </button>
            )}
          </div>

          {!client.isConfigured && (
            <p className="mt-3 border-l-2 border-[#B77B28] bg-[#FAF5E8] px-3 py-2 text-[11px] leading-relaxed text-[#6D4B1C]">
              Setup required: add <code>VITE_SPOTIFY_CLIENT_ID</code> and the matching <code>VITE_SPOTIFY_REDIRECT_URI</code> to your local <code>.env</code> file. Never add a Spotify Client Secret to this frontend.
            </p>
          )}

          {connected && (
            <div className="mt-4 border-t border-[#171717]/10 pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <label htmlFor="spotify-connect-device" className="text-[11px] font-semibold text-[#454542]">
                  Playback device
                </label>
                <button
                  type="button"
                  onClick={() => void refreshDevices()}
                  disabled={loadingDevices || busy}
                  className="inline-flex items-center gap-1 text-[11px] text-[#405E49] underline underline-offset-2 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingDevices ? 'animate-spin' : ''}`} aria-hidden="true" />
                  Refresh devices
                </button>
              </div>
              <select
                id="spotify-connect-device"
                value={selectedDeviceId}
                onChange={(event) => void handleDeviceChange(event.target.value)}
                disabled={loadingDevices || busy || devices.length === 0}
                className="h-10 w-full border border-[#171717]/20 bg-[#F8F8F5] px-3 text-xs text-[#171717] outline-none focus:border-[#1DB954] disabled:opacity-60"
              >
                <option value="">Choose a Spotify Connect device…</option>
                {devices.map((device) => (
                  <option key={device.id} value={device.id || ''} disabled={device.is_restricted || !device.id}>
                    {device.name} · {device.type}{device.is_active ? ' · active' : ''}{device.is_restricted ? ' · unavailable' : ''}
                  </option>
                ))}
              </select>
              {activeDevice && (
                <p className="mt-1 text-[10px] text-[#777770]">
                  {activeDevice.is_active ? 'Currently active device' : 'Selected remote target'} · {activeDevice.supports_volume ? 'Remote volume supported' : 'Remote volume may be unavailable'}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-[#171717]/10 pt-3">
                <div>
                  <p className="text-xs font-semibold text-[#171717]">Hardware control mode</p>
                  <p className="mt-0.5 text-[10px] text-[#777770]">Start Spotify on a device, choose it below, then route the 3D transport buttons to Spotify.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onControlModeChange(!controlActive);
                    setMessage(!controlActive ? 'The CD, cassette and vinyl controls now send commands to Spotify.' : 'Hardware controls returned to the built-in demo player.');
                  }}
                  disabled={!selectedDeviceId || busy}
                  aria-pressed={controlActive}
                  className={`h-9 px-3 text-[11px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${controlActive ? 'bg-[#1DB954] text-[#102015]' : 'border border-[#171717]/20 bg-[#F6F6F3] text-[#171717] hover:bg-[#E7E7E2]'}`}
                >
                  {controlActive ? 'Spotify controls ON' : 'Use Spotify for controls'}
                </button>
              </div>
            </div>
          )}

          {(message || connectionMessage) && (
            <div className="mt-3 space-y-1 text-[10px] leading-relaxed text-[#55725B]" role="status">
              {message && <p>{message}</p>}
              {connectionMessage && <p>{connectionMessage}</p>}
            </div>
          )}
          {error && <p role="alert" className="mt-3 text-[11px] leading-relaxed text-[#B42318]">{error}</p>}
        </section>

        <div className="mt-3 border border-[#171717]/10 bg-[#EFEEE9] px-3 py-2 text-[10px] leading-relaxed text-[#62625D]">
          Spotify Connect controls require Spotify Premium and an available, unrestricted device. “Stop” maps to Pause because Spotify Connect does not provide a stop-and-reset command. Tape side and turntable RPM remain local hardware features.
        </div>

        <div className="my-4 flex items-center gap-3 text-[10px] font-mono-tech tracking-[0.12em] text-[#777770]">
          <span className="h-px flex-1 bg-[#171717]/15" />
          SPOTIFY EMBED FALLBACK
          <span className="h-px flex-1 bg-[#171717]/15" />
        </div>

        <p className="mb-3 max-w-md text-xs leading-relaxed text-[#62625D]">
          Or load Spotify content in its official embedded player. This option does not route the 3D hardware buttons to playback.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="spotify-share-link" className="sr-only">Spotify share link</label>
          <input
            ref={inputRef}
            id="spotify-share-link"
            type="text"
            inputMode="url"
            autoComplete="url"
            placeholder="Paste a Spotify link…"
            value={link}
            onChange={(event) => {
              setLink(event.target.value);
              if (error) setError('');
            }}
            className="h-10 min-w-0 flex-1 border border-[#171717]/20 bg-white px-3 text-xs text-[#171717] outline-none placeholder:text-[#969690] focus:border-[#1DB954] focus:ring-1 focus:ring-[#1DB954]"
          />
          <button
            type="submit"
            className="inline-flex h-10 items-center justify-center gap-2 bg-[#171717] px-4 text-xs font-medium text-white transition-colors hover:bg-[#30302D] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#171717]"
          >
            <Music2 className="h-4 w-4" aria-hidden="true" />
            Load embed
          </button>
        </form>

        {target ? (
          <div className="mt-4 border-t border-[#171717]/10 pt-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="font-mono-tech text-[10px] uppercase tracking-wider text-[#666660]">
                Spotify {target.type}
              </span>
              <a
                href={target.openUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-[#405E49] underline underline-offset-2 hover:text-[#1D3726]"
              >
                Open in Spotify <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </div>
            <iframe
              key={target.embedUrl}
              title={`Spotify ${target.type} player`}
              src={target.embedUrl}
              width="100%"
              height="352"
              loading="lazy"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              className="block w-full border-0"
            />
          </div>
        ) : (
          <div className="mt-3 flex min-h-24 flex-col items-center justify-center border border-dashed border-[#171717]/20 bg-white/60 px-4 text-center">
            <Music2 className="mb-2 h-5 w-5 text-[#84847D]" aria-hidden="true" />
            <p className="text-xs font-medium text-[#454542]">Your Spotify embed will appear here</p>
            <p className="mt-1 text-[11px] text-[#777770]">In Spotify: Share → Copy link to track, album or playlist.</p>
          </div>
        )}

        <p className="mt-3 text-[10px] leading-relaxed text-[#777770]">
          Sign-in uses Spotify Authorization Code with PKCE. The app does not request or store your Spotify password or a Client Secret. Tokens are kept in this browser tab session.
        </p>
      </section>
    </div>
  );
}
