import type { MediaRecord, MediaSide } from '../types/media';
import { computeFrequencyBands } from '../utils/visualizerMath';

export class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private analyserData: Uint8Array<ArrayBuffer> | null = null;
  private stepTimer: number | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;

  private audioEl: HTMLAudioElement | null = null;
  private mediaElSource: MediaElementAudioSourceNode | null = null;

  private isPlaying = false;
  private volume = 0.72;
  private activeRecord: MediaRecord | null = null;
  private activeSide: MediaSide = 'A';
  private rpmMode: 33 | 45 = 33;

  private elapsedOffset = 0;
  private playStartPerf = 0;
  private stepIndex = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = this.volume;

        this.analyser = this.ctx.createAnalyser();
        this.analyser.fftSize = 128;
        this.analyser.smoothingTimeConstant = 0.72;
        this.analyserData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));

        this.masterGain.connect(this.analyser);
        this.analyser.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  public setVolume(next: number) {
    this.volume = Math.max(0, Math.min(1, next));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.03);
    }
    if (this.audioEl) {
      this.audioEl.volume = this.volume;
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public setRpmMode(rpm: 33 | 45) {
    this.rpmMode = rpm;
    if (this.audioEl && this.activeRecord?.format === 'vinyl') {
      this.audioEl.playbackRate = rpm === 45 ? 1.35 : 1.0;
    }
  }

  public getIsPlaying(): boolean {
    return this.isPlaying;
  }

  public getElapsedSec(): number {
    if (this.activeRecord?.customAudioUrl && this.audioEl) {
      return this.audioEl.currentTime || 0;
    }
    if (!this.isPlaying) {
      return this.elapsedOffset;
    }
    const speed =
      this.activeRecord?.format === 'vinyl' && this.rpmMode === 45 ? 1.35 : 1.0;
    const raw = this.elapsedOffset + ((performance.now() - this.playStartPerf) / 1000) * speed;
    const track = this.getActiveTrack();
    if (!track) return raw;
    return raw % track.durationSec;
  }

  public getLevel(): number {
    if (!this.isPlaying) return 0;
    if (this.analyser && this.analyserData) {
      this.analyser.getByteFrequencyData(this.analyserData);
      let sum = 0;
      for (let i = 0; i < this.analyserData.length; i++) {
        sum += this.analyserData[i];
      }
      const normalized = sum / (this.analyserData.length * 255);
      if (normalized > 0.01) {
        return Math.min(1, normalized * 2.2);
      }
    }
    // Fallback rhythmic pulse if audio output is muted by headless browser
    const t = this.getElapsedSec();
    return 0.25 + 0.45 * Math.abs(Math.sin(t * 4.2));
  }

  public getFrequencyBands(bandCount = 24): number[] {
    let rawBins: Uint8Array | null = null;
    if (this.isPlaying && this.analyser && this.analyserData) {
      this.analyser.getByteFrequencyData(this.analyserData);
      rawBins = this.analyserData;
    }
    const seed = this.activeRecord ? this.activeRecord.title.length * 0.73 : 1;
    return computeFrequencyBands({
      rawBins,
      bandCount,
      isPlaying: this.isPlaying,
      elapsedSec: this.getElapsedSec(),
      volume: this.volume,
      level: this.getLevel(),
      accentSeed: seed,
    });
  }

  private getActiveTrack() {
    if (!this.activeRecord) return null;
    return this.activeSide === 'A' ? this.activeRecord.sideA : this.activeRecord.sideB;
  }

  public loadRecord(record: MediaRecord, side: MediaSide, autoPlay = false) {
    const changed =
      this.activeRecord?.id !== record.id || this.activeSide !== side;
    this.activeRecord = record;
    this.activeSide = side;

    if (changed) {
      this.stopNoise();
      this.clearSequencer();
      this.teardownAudioElement();
      this.elapsedOffset = 0;
      this.stepIndex = 0;
    }

    if (autoPlay) {
      this.play();
    }
  }

  public play() {
    if (!this.activeRecord) return;
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.playStartPerf = performance.now();

    if (this.activeRecord.customAudioUrl) {
      this.playCustomAudio(this.activeRecord.customAudioUrl);
      return;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    this.startSurfaceAmbience(ctx);
    this.startSequencer();
  }

  public pause() {
    if (!this.isPlaying) return;
    this.elapsedOffset = this.getElapsedSec();
    this.isPlaying = false;
    this.clearSequencer();
    this.stopNoise();
    if (this.audioEl) {
      this.audioEl.pause();
    }
  }

  public stop() {
    this.isPlaying = false;
    this.elapsedOffset = 0;
    this.stepIndex = 0;
    this.clearSequencer();
    this.stopNoise();
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    }
  }

  private playCustomAudio(url: string) {
    const ctx = this.ensureContext();
    if (!this.audioEl || this.audioEl.src !== url) {
      this.teardownAudioElement();
      const el = new Audio(url);
      el.crossOrigin = 'anonymous';
      el.loop = true;
      el.volume = this.volume;
      if (this.activeRecord?.format === 'vinyl' && this.rpmMode === 45) {
        el.playbackRate = 1.35;
      }
      this.audioEl = el;
      if (ctx && this.masterGain) {
        try {
          this.mediaElSource = ctx.createMediaElementSource(el);
          this.mediaElSource.connect(this.masterGain);
        } catch {
          // Fallback to native audio output
        }
      }
    }
    this.audioEl.play().catch(() => undefined);
  }

  private teardownAudioElement() {
    if (this.mediaElSource) {
      try {
        this.mediaElSource.disconnect();
      } catch {
        // ignore
      }
      this.mediaElSource = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.src = '';
      this.audioEl = null;
    }
  }

  private startSurfaceAmbience(ctx: AudioContext) {
    this.stopNoise();
    if (!this.masterGain || !this.activeRecord) return;
    const format = this.activeRecord.format;
    if (format === 'cd') return; // CDs have pristine digital noise floor

    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (format === 'cassette') {
      // Soft pink tape hiss
      let b0 = 0,
        b1 = 0,
        b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + white * 0.029;
        b1 = 0.985 * b1 + white * 0.032;
        b2 = 0.95 * b2 + white * 0.048;
        data[i] = (b0 + b1 + b2 + white * 0.015) * 0.04;
      }
    } else {
      // Subtle vinyl crackle + warmth
      for (let i = 0; i < bufferSize; i++) {
        const dust = Math.random() > 0.9988 ? (Math.random() * 2 - 1) * 0.35 : 0;
        const rumble = Math.sin((i / ctx.sampleRate) * Math.PI * 2 * 48) * 0.004;
        data[i] = dust + rumble + (Math.random() * 2 - 1) * 0.006;
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = format === 'cassette' ? 'bandpass' : 'lowpass';
    filter.frequency.value = format === 'cassette' ? 2400 : 3200;

    const gain = ctx.createGain();
    gain.gain.value = format === 'cassette' ? 0.16 : 0.22;

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    source.start();

    this.noiseSource = source;
    this.noiseGain = gain;
  }

  private stopNoise() {
    if (this.noiseSource) {
      try {
        this.noiseSource.stop();
        this.noiseSource.disconnect();
      } catch {
        // ignore
      }
      this.noiseSource = null;
    }
    if (this.noiseGain) {
      try {
        this.noiseGain.disconnect();
      } catch {
        // ignore
      }
      this.noiseGain = null;
    }
  }

  private clearSequencer() {
    if (this.stepTimer !== null) {
      window.clearInterval(this.stepTimer);
      this.stepTimer = null;
    }
  }

  private startSequencer() {
    this.clearSequencer();
    const track = this.getActiveTrack();
    if (!track || !this.activeRecord) return;

    const speed =
      this.activeRecord.format === 'vinyl' && this.rpmMode === 45 ? 1.35 : 1.0;
    const eighthMs = Math.max(110, (60000 / (track.bpm * speed)) / 2);

    this.triggerStep();
    this.stepTimer = window.setInterval(() => {
      if (!this.isPlaying) return;
      this.triggerStep();
    }, eighthMs);
  }

  private triggerStep() {
    const ctx = this.ctx;
    const track = this.getActiveTrack();
    const record = this.activeRecord;
    if (!ctx || !this.masterGain || !track || !record) return;

    const now = ctx.currentTime;
    const step = this.stepIndex++;
    const intervals = track.scaleIntervals;
    const pitchMult =
      record.format === 'vinyl' && this.rpmMode === 45 ? 1.25 : 1.0;

    // 1. Chord / Warm Pad on bar downbeats
    if (step % 8 === 0) {
      const chordRootIdx = (Math.floor(step / 8) % 4) === 3 ? 2 : (Math.floor(step / 8) % 3);
      const chordSemis = [
        intervals[chordRootIdx % intervals.length],
        intervals[(chordRootIdx + 2) % intervals.length],
        intervals[(chordRootIdx + 4) % intervals.length],
      ];
      for (const semi of chordSemis) {
        const freq = track.rootHz * Math.pow(2, semi / 12) * pitchMult;
        this.playVoice(ctx, now, freq, 1.35, 0.065, record.format === 'cd' ? 'triangle' : 'sine', record.format === 'cassette');
      }
    }

    // 2. Melodic arp / Rhodes pluck
    const pattern = [0, 2, 4, 1, 3, 5, 2, 4];
    if (step % 2 === 0 || (step % 7 === 0)) {
      const noteIdx = pattern[step % pattern.length] % intervals.length;
      const semi = intervals[noteIdx] + (step % 16 >= 12 ? 12 : 0);
      const freq = track.rootHz * Math.pow(2, semi / 12) * pitchMult * 2;
      this.playVoice(
        ctx,
        now,
        freq,
        0.42,
        0.055,
        track.waveform,
        record.format === 'cassette'
      );
    }

    // 3. Soft bass pulse
    if (step % 4 === 0) {
      const bassSemi = intervals[(Math.floor(step / 8) % 3)] - 12;
      const freq = track.rootHz * Math.pow(2, bassSemi / 12) * pitchMult;
      this.playVoice(ctx, now, freq, 0.48, 0.11, 'sine', false);
    }

    // 4. Subtle crisp pulse on CD/Cassette
    if (step % 4 === 2 && record.format !== 'vinyl') {
      this.playClickPerc(ctx, now, record.format === 'cd' ? 0.045 : 0.025);
    }
  }

  private playVoice(
    ctx: AudioContext,
    startTime: number,
    freq: number,
    duration: number,
    peakGain: number,
    type: OscillatorType,
    wobble: boolean
  ) {
    if (!this.masterGain) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    if (wobble) {
      // Subtle cassette tape pitch flutter
      osc.detune.setValueAtTime((Math.sin(startTime * 5.5) * 9), startTime);
    }

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(type === 'sawtooth' ? 1400 : 2800, startTime);
    filter.frequency.exponentialRampToValueAtTime(750, startTime + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, startTime);
    env.gain.linearRampToValueAtTime(peakGain, startTime + 0.025);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(filter);
    filter.connect(env);
    env.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + duration + 0.04);
  }

  private playClickPerc(ctx: AudioContext, startTime: number, level: number) {
    if (!this.masterGain) return;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1600, startTime);
    osc.frequency.exponentialRampToValueAtTime(240, startTime + 0.045);

    const env = ctx.createGain();
    env.gain.setValueAtTime(level, startTime);
    env.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.045);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(startTime);
    osc.stop(startTime + 0.05);
  }

  public dispose() {
    this.stop();
    this.teardownAudioElement();
    if (this.ctx) {
      this.ctx.close().catch(() => undefined);
      this.ctx = null;
    }
  }
}
