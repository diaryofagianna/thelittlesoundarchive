export interface SpotifyConnectDevice {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted: boolean;
  supports_volume: boolean;
  volume_percent: number | null;
}

export interface SpotifyPlaybackState {
  is_playing: boolean;
  device?: SpotifyConnectDevice;
}

interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

interface StoredSpotifyToken extends SpotifyTokenResponse {
  expires_at: number;
}

export interface SpotifyInitializationResult {
  connected: boolean;
  callbackHandled: boolean;
  error?: string;
}

const API_BASE = 'https://api.spotify.com/v1';
const TOKEN_URL = 'https://accounts.spotify.com/api/token';
const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize';
const TOKEN_KEY = 'little-sound-archive.spotify.token.v1';
const VERIFIER_KEY = 'little-sound-archive.spotify.pkce-verifier';
const STATE_KEY = 'little-sound-archive.spotify.oauth-state';
const SCOPES = ['user-read-playback-state', 'user-modify-playback-state'];
const CLIENT_ID = (import.meta.env.VITE_SPOTIFY_CLIENT_ID || '').trim();
const CONFIGURED_REDIRECT_URI = (import.meta.env.VITE_SPOTIFY_REDIRECT_URI || '').trim();

export class SpotifyConnectError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = 'SpotifyConnectError';
  }
}

function getRedirectUri(): string {
  const configured = CONFIGURED_REDIRECT_URI || (typeof window !== 'undefined' ? `${window.location.origin}${window.location.pathname}` : '');
  return configured ? new URL(configured).toString() : '';
}

function randomUrlSafeString(length = 64): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'[byte % 66]).join('');
}

async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const bytes = new Uint8Array(digest);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function readToken(): StoredSpotifyToken | null {
  try {
    const raw = sessionStorage.getItem(TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSpotifyToken;
    return parsed.access_token && parsed.expires_at ? parsed : null;
  } catch {
    return null;
  }
}

function saveToken(token: SpotifyTokenResponse, previous?: StoredSpotifyToken | null): StoredSpotifyToken {
  const stored: StoredSpotifyToken = {
    ...token,
    refresh_token: token.refresh_token || previous?.refresh_token,
    expires_at: Date.now() + Math.max(0, token.expires_in - 30) * 1000,
  };
  sessionStorage.setItem(TOKEN_KEY, JSON.stringify(stored));
  return stored;
}

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string | { message?: string }; error_description?: string; message?: string };
    if (typeof body.error === 'object' && body.error?.message) return body.error.message;
    return body.error_description || body.message || (typeof body.error === 'string' ? body.error : '') || response.statusText;
  } catch {
    return response.statusText || 'Unknown Spotify error';
  }
}

export class SpotifyConnectClient {
  private token: StoredSpotifyToken | null = null;
  private refreshPromise: Promise<StoredSpotifyToken> | null = null;
  private targetDeviceId: string | null = null;

  public get isConfigured(): boolean {
    return Boolean(CLIENT_ID);
  }

  public get redirectUri(): string {
    return getRedirectUri();
  }

  public async initialize(): Promise<SpotifyInitializationResult> {
    if (typeof window === 'undefined') return { connected: false, callbackHandled: false };

    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const oauthError = url.searchParams.get('error');
    const callbackHandled = Boolean(code || oauthError);

    if (callbackHandled) {
      try {
        const returnedState = url.searchParams.get('state');
        const expectedState = sessionStorage.getItem(STATE_KEY);
        const verifier = sessionStorage.getItem(VERIFIER_KEY);
        if (!returnedState || !expectedState || returnedState !== expectedState) {
          throw new SpotifyConnectError('Spotify sign-in could not be verified. Please connect again.');
        }
        if (oauthError) {
          throw new SpotifyConnectError(oauthError === 'access_denied' ? 'Spotify access was declined.' : `Spotify authorization failed: ${oauthError}`);
        }
        if (!code || !verifier) {
          throw new SpotifyConnectError('The Spotify sign-in response was incomplete. Please connect again.');
        }
        await this.exchangeAuthorizationCode(code, verifier);
        this.targetDeviceId = null;
        return { connected: true, callbackHandled: true };
      } catch (error) {
        this.clearSession();
        return {
          connected: false,
          callbackHandled: true,
          error: error instanceof Error ? error.message : 'Spotify sign-in failed.',
        };
      } finally {
        sessionStorage.removeItem(VERIFIER_KEY);
        sessionStorage.removeItem(STATE_KEY);
        url.searchParams.delete('code');
        url.searchParams.delete('state');
        url.searchParams.delete('error');
        url.searchParams.delete('error_description');
        window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
      }
    }

    this.token = readToken();
    if (!this.token) return { connected: false, callbackHandled: false };
    try {
      await this.getAccessToken();
      return { connected: true, callbackHandled: false };
    } catch {
      this.clearSession();
      return { connected: false, callbackHandled: false };
    }
  }

  public async startAuthorization(): Promise<void> {
    if (!CLIENT_ID) {
      throw new SpotifyConnectError('Add VITE_SPOTIFY_CLIENT_ID to .env before connecting Spotify.');
    }
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      throw new SpotifyConnectError('Spotify sign-in requires HTTPS on the published website.');
    }

    const redirectUri = new URL(getRedirectUri());
    if (redirectUri.origin !== window.location.origin) {
      throw new SpotifyConnectError('The Spotify redirect URI must use the same origin as this app so the PKCE session can be verified.');
    }

    const verifier = randomUrlSafeString(96);
    const state = randomUrlSafeString(32);
    const challenge = await createCodeChallenge(verifier);
    sessionStorage.setItem(VERIFIER_KEY, verifier);
    sessionStorage.setItem(STATE_KEY, state);

    const authUrl = new URL(AUTHORIZE_URL);
    authUrl.search = new URLSearchParams({
      client_id: CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri.toString(),
      code_challenge_method: 'S256',
      code_challenge: challenge,
      state,
      scope: SCOPES.join(' '),
    }).toString();
    window.location.assign(authUrl.toString());
  }

  public disconnect(): void {
    this.clearSession();
    this.targetDeviceId = null;
  }

  public setTargetDevice(deviceId: string | null): void {
    this.targetDeviceId = deviceId;
  }

  public async getAvailableDevices(): Promise<SpotifyConnectDevice[]> {
    const result = await this.api<{ devices?: SpotifyConnectDevice[] }>('/me/player/devices');
    const devices = Array.isArray(result?.devices) ? result.devices : [];
    return devices.filter((device) => Boolean(device.id));
  }

  public async getPlaybackState(): Promise<SpotifyPlaybackState | null> {
    return this.api<SpotifyPlaybackState>('/me/player');
  }

  public async transferPlayback(deviceId: string): Promise<void> {
    await this.api('/me/player', {
      method: 'PUT',
      body: JSON.stringify({ device_ids: [deviceId], play: false }),
    });
    this.targetDeviceId = deviceId;
  }

  public async togglePlayback(): Promise<void> {
    const playback = await this.getPlaybackState();
    if (playback?.is_playing) {
      await this.pausePlayback();
    } else {
      await this.startPlayback();
    }
  }

  public async startPlayback(): Promise<void> {
    const query = this.targetDeviceId ? `?device_id=${encodeURIComponent(this.targetDeviceId)}` : '';
    await this.api(`/me/player/play${query}`, { method: 'PUT' });
  }

  public async pausePlayback(): Promise<void> {
    const query = this.targetDeviceId ? `?device_id=${encodeURIComponent(this.targetDeviceId)}` : '';
    await this.api(`/me/player/pause${query}`, { method: 'PUT' });
  }

  public async skipNext(): Promise<void> {
    const query = this.targetDeviceId ? `?device_id=${encodeURIComponent(this.targetDeviceId)}` : '';
    await this.api(`/me/player/next${query}`, { method: 'POST' });
  }

  public async skipPrevious(): Promise<void> {
    const query = this.targetDeviceId ? `?device_id=${encodeURIComponent(this.targetDeviceId)}` : '';
    await this.api(`/me/player/previous${query}`, { method: 'POST' });
  }

  public async setVolume(volume: number): Promise<void> {
    const devices = await this.getAvailableDevices();
    const deviceId = this.targetDeviceId || devices.find((device) => device.is_active)?.id || null;
    if (!deviceId) throw new SpotifyConnectError('No active Spotify device. Open Spotify on a device and refresh the device list.');
    const device = devices.find((item) => item.id === deviceId);
    if (device && !device.supports_volume) {
      throw new SpotifyConnectError('This Spotify Connect device does not support remote volume control.');
    }
    const params = new URLSearchParams({ volume_percent: String(Math.round(Math.max(0, Math.min(1, volume)) * 100)), device_id: deviceId });
    await this.api(`/me/player/volume?${params.toString()}`, { method: 'PUT' });
  }

  private async exchangeAuthorizationCode(code: string, verifier: string): Promise<void> {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: 'authorization_code',
        code,
        redirect_uri: getRedirectUri(),
        code_verifier: verifier,
      }),
    });
    if (!response.ok) {
      throw new SpotifyConnectError(`Spotify token exchange failed: ${await readError(response)}`, response.status);
    }
    this.token = saveToken(await response.json() as SpotifyTokenResponse);
  }

  private clearSession(): void {
    this.token = null;
    this.refreshPromise = null;
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(VERIFIER_KEY);
    sessionStorage.removeItem(STATE_KEY);
  }

  private async getAccessToken(): Promise<string> {
    this.token ||= readToken();
    if (!this.token) throw new SpotifyConnectError('Connect your Spotify account first.');
    if (Date.now() < this.token.expires_at) return this.token.access_token;
    if (!this.token.refresh_token) {
      this.clearSession();
      throw new SpotifyConnectError('Your Spotify session expired. Please connect again.');
    }

    if (!this.refreshPromise) {
      const previous = this.token;
      if (!previous?.refresh_token) {
        this.clearSession();
        throw new SpotifyConnectError('Your Spotify session expired. Please connect again.');
      }
      const refreshToken = previous.refresh_token;
      this.refreshPromise = (async () => {
        const response = await fetch(TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
          }),
        });
        if (!response.ok) {
          this.clearSession();
          throw new SpotifyConnectError(`Spotify session refresh failed: ${await readError(response)}`, response.status);
        }
        const data = await response.json() as SpotifyTokenResponse;
        return saveToken(data, previous);
      })().finally(() => { this.refreshPromise = null; });
    }
    this.token = await this.refreshPromise;
    return this.token.access_token;
  }

  private async api<T = void>(path: string, init: RequestInit = {}, retried = false): Promise<T> {
    const accessToken = await this.getAccessToken();
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${accessToken}`);
    if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');

    const response = await fetch(`${API_BASE}${path}`, { ...init, headers });
    if (response.status === 401 && !retried && this.token?.refresh_token) {
      this.token.expires_at = 0;
      await this.getAccessToken();
      return this.api<T>(path, init, true);
    }
    if (!response.ok) {
      const detail = await readError(response);
      if (response.status === 403) {
        throw new SpotifyConnectError('Spotify denied this control. Check Premium status, granted playback scopes, Development Mode access and that the selected Connect device is supported and unrestricted.', 403);
      }
      if (response.status === 404) {
        throw new SpotifyConnectError('Spotify could not find an active playback device. Open Spotify on your phone, computer or speaker, then refresh devices.', 404);
      }
      if (response.status === 429) {
        throw new SpotifyConnectError('Spotify is rate-limiting requests. Wait a moment before trying again.', 429);
      }
      throw new SpotifyConnectError(`Spotify request failed: ${detail}`, response.status);
    }
    if (response.status === 204) return null as T;
    const text = await response.text();
    return (text ? JSON.parse(text) : null) as T;
  }
}
