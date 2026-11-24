import * as THREE from 'three';
import type { CoverStyleId, MediaRecord, MediaSide } from '../types/media';
import { formatLcdTime } from '../utils/shelfMath';

function drawArtworkToCtx(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  style: CoverStyleId,
  record: MediaRecord,
  customImg?: HTMLImageElement
) {
  if (customImg && customImg.complete && customImg.naturalWidth > 0) {
    // Cover-fit user image
    const imgRatio = customImg.naturalWidth / customImg.naturalHeight;
    const canvasRatio = w / h;
    let sx = 0,
      sy = 0,
      sw = customImg.naturalWidth,
      sh = customImg.naturalHeight;
    if (imgRatio > canvasRatio) {
      sw = sh * canvasRatio;
      sx = (customImg.naturalWidth - sw) / 2;
    } else {
      sh = sw / canvasRatio;
      sy = (customImg.naturalHeight - sh) / 2;
    }
    ctx.drawImage(customImg, sx, sy, sw, sh, 0, 0, w, h);
    return;
  }

  switch (style) {
    case 'meadow-sky': {
      // Soft Machines iconic meadow + red poppies + blue sky & soft clouds
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#2F8FE2');
      grad.addColorStop(0.42, '#92CEFA');
      grad.addColorStop(0.56, '#76C952');
      grad.addColorStop(1, '#2D7B2B');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Soft organic green hillside & clouds
      ctx.save();
      ctx.filter = 'blur(20px)';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.beginPath();
      ctx.ellipse(w * 0.68, h * 0.24, w * 0.25, h * 0.13, -0.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#48A938';
      ctx.beginPath();
      ctx.ellipse(w * 0.28, h * 0.66, w * 0.42, h * 0.34, 0.2, 0, Math.PI * 2);
      ctx.fill();

      // Warm red poppy glows
      ctx.fillStyle = '#DF2E1B';
      ctx.beginPath();
      ctx.arc(w * 0.24, h * 0.72, w * 0.11, 0, Math.PI * 2);
      ctx.arc(w * 0.36, h * 0.42, w * 0.075, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#F6C927';
      ctx.beginPath();
      ctx.arc(w * 0.2, h * 0.56, w * 0.055, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Crisp yellow & red wildflower petals
      const flowers = [
        [0.18, 0.45, '#F6D93D', 12],
        [0.29, 0.36, '#E2331C', 18],
        [0.14, 0.66, '#E2331C', 20],
        [0.25, 0.78, '#F6D93D', 13],
        [0.42, 0.76, '#F6D93D', 12],
        [0.52, 0.84, '#E2331C', 16],
        [0.37, 0.24, '#F6D93D', 10],
      ] as const;
      for (const [fx, fy, col, r] of flowers) {
        ctx.fillStyle = col;
        for (let p = 0; p < 5; p++) {
          const ang = (p / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(
            w * fx + Math.cos(ang) * r * 0.55,
            h * fy + Math.sin(ang) * r * 0.55,
            r * 0.52,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
        ctx.fillStyle = '#191916';
        ctx.beginPath();
        ctx.arc(w * fx, h * fy, r * 0.28, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    }

    case 'night-bus': {
      // High-contrast monochrome transit photography style
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#131416');
      bg.addColorStop(0.55, '#25272B');
      bg.addColorStop(1, '#0F1012');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Streetlamp bokeh & bus window reflections
      ctx.save();
      ctx.filter = 'blur(10px)';
      ctx.fillStyle = 'rgba(245, 245, 240, 0.55)';
      for (let i = 0; i < 8; i++) {
        ctx.beginPath();
        ctx.arc(w * (0.1 + i * 0.12), h * (0.3 + (i % 3) * 0.14), 12 + (i % 3) * 8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Grain streaks
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 2;
      for (let i = 0; i < 16; i++) {
        ctx.beginPath();
        ctx.moveTo(0, h * (0.2 + i * 0.045));
        ctx.lineTo(w, h * (0.18 + i * 0.045));
        ctx.stroke();
      }
      break;
    }

    case 'heatwave-static': {
      // Monochrome stark graphic halftone & radial waves
      ctx.fillStyle = '#F2F1EC';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#161616';
      for (let y = 0; y < h; y += 22) {
        for (let x = 0; x < w; x += 22) {
          const dx = x / w - 0.5;
          const dy = y / h - 0.5;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const wave = Math.sin(dist * 24) * 0.5 + 0.5;
          const rad = 2 + wave * 8.5;
          ctx.beginPath();
          ctx.arc(x, y, rad, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }

    case 'glass-harbor': {
      const grad = ctx.createRadialGradient(w * 0.35, h * 0.35, 20, w * 0.5, h * 0.5, w * 0.65);
      grad.addColorStop(0, '#F7F9FA');
      grad.addColorStop(0.35, '#59BBE8');
      grad.addColorStop(0.7, '#2A67B3');
      grad.addColorStop(1, '#F16A4C');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255,255,255,0.45)';
      ctx.lineWidth = 3;
      for (let r = 80; r < w * 0.55; r += 44) {
        ctx.beginPath();
        ctx.arc(w * 0.5, h * 0.5, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }

    case 'sunday-club': {
      ctx.fillStyle = '#EFE7D8';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#E66B2B';
      ctx.fillRect(w * 0.08, h * 0.14, w * 0.84, h * 0.28);
      ctx.fillStyle = '#1D1D1B';
      ctx.fillRect(w * 0.08, h * 0.72, w * 0.84, h * 0.06);
      break;
    }

    case 'copper-silence': {
      ctx.fillStyle = '#202224';
      ctx.fillRect(0, 0, w, h);
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#C8603C');
      grad.addColorStop(0.6, '#8B3A22');
      grad.addColorStop(1, '#1A1C1E');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.48, w * 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#EAE6DC';
      ctx.lineWidth = 3;
      ctx.strokeRect(w * 0.08, h * 0.08, w * 0.84, h * 0.84);
      break;
    }

    case 'daylight-loop': {
      ctx.fillStyle = '#F5F6F2';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#2454D8';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.5, w * 0.39, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#C9EC4A';
      ctx.beginPath();
      ctx.arc(w * 0.64, h * 0.36, w * 0.18, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    case 'suburban-echo': {
      ctx.fillStyle = '#2A2C30';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#DF9E28';
      ctx.fillRect(0, h * 0.18, w, h * 0.14);
      ctx.fillStyle = '#EDEDEA';
      ctx.fillRect(0, h * 0.34, w, h * 0.04);
      break;
    }

    case 'winter-concourse': {
      ctx.fillStyle = '#E8E7E0';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#214A3D';
      ctx.fillRect(w * 0.12, h * 0.12, w * 0.76, h * 0.56);
      ctx.fillStyle = '#E8E7E0';
      ctx.beginPath();
      ctx.arc(w * 0.5, h * 0.4, w * 0.15, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }

  // Subtle corner catalog stamp if not custom
  ctx.fillStyle =
    style === 'heatwave-static' || style === 'sunday-club' || style === 'winter-concourse'
      ? 'rgba(20,20,20,0.65)'
      : 'rgba(255,255,255,0.75)';
  ctx.font = '600 18px "IBM Plex Mono", monospace';
  ctx.fillText(record.catalogCode, w * 0.08, h * 0.92);
}

export function createCdFaceTexture(
  record: MediaRecord,
  maxAnisotropy: number,
  customImg?: HTMLImageElement
): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.clearRect(0, 0, size, size);

  // Clip to outer disc printable circle, leaving clear inner polycarbonate hub ring
  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.488, 0, Math.PI * 2);
  ctx.arc(size / 2, size / 2, size * 0.142, 0, Math.PI * 2, true);
  ctx.clip();

  drawArtworkToCtx(ctx, size, size, record.coverStyle, record, customImg);

  // Subtle metallic sheen gradient overlay
  const sheen = ctx.createLinearGradient(0, 0, size, size);
  sheen.addColorStop(0, 'rgba(255,255,255,0.14)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,0.0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.08)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);

  ctx.restore();

  // Crisp inner ring typography
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.155, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = '600 20px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${record.catalogCode} · ${record.title}`, size / 2, size * 0.84);
  ctx.font = '500 15px "IBM Plex Mono", monospace';
  ctx.fillText(`COMPACT DISC DIGITAL AUDIO · ${record.year}`, size / 2, size * 0.875);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createCassetteLabelTexture(
  record: MediaRecord,
  maxAnisotropy: number,
  customImg?: HTMLImageElement
): THREE.CanvasTexture {
  const w = 1024;
  const h = 640;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  drawArtworkToCtx(ctx, w, h, record.coverStyle, record, customImg);

  // Classic cassette paper label header strip
  ctx.fillStyle = 'rgba(246, 245, 240, 0.92)';
  ctx.fillRect(48, 36, w - 96, 128);

  ctx.fillStyle = '#181818';
  ctx.font = '700 42px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(record.title, 76, 98);

  ctx.font = '500 22px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#52524E';
  ctx.fillText(`${record.artist}  ·  ${record.catalogCode}  ·  CrO2 60 MIN`, 78, 138);

  // Side A badge block
  ctx.fillStyle = record.accentColor;
  ctx.fillRect(w - 148, 56, 72, 72);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '700 44px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('A', w - 112, 108);
  ctx.textAlign = 'left';

  // Center cutout border frame (matches 3D cassette tape window)
  ctx.fillStyle = 'rgba(20,20,22,0.88)';
  ctx.fillRect(232, 232, 560, 176);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createVinylSleeveTexture(
  record: MediaRecord,
  maxAnisotropy: number,
  customImg?: HTMLImageElement
): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  drawArtworkToCtx(ctx, size, size, record.coverStyle, record, customImg);

  // Crisp editorial typography lockup at top-left of jacket
  const isLightBg =
    record.coverStyle === 'heatwave-static' ||
    record.coverStyle === 'sunday-club' ||
    record.coverStyle === 'winter-concourse';

  ctx.fillStyle = isLightBg && !customImg ? '#141414' : '#F8F8F5';
  if (customImg) {
    ctx.fillStyle = 'rgba(18,18,18,0.68)';
    ctx.fillRect(0, 0, size, 170);
    ctx.fillStyle = '#FFFFFF';
  }

  ctx.font = '700 54px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(record.title, 58, 92);
  ctx.font = '500 24px "IBM Plex Mono", monospace';
  ctx.fillText(`${record.artist}  ·  ${record.catalogCode}`, 60, 134);

  // Subtle cardboard edge wear highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, size - 6, size - 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createVinylCenterLabelTexture(
  record: MediaRecord,
  maxAnisotropy: number,
  customImg?: HTMLImageElement
): THREE.CanvasTexture {
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.save();
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.49, 0, Math.PI * 2);
  ctx.clip();

  drawArtworkToCtx(ctx, size, size, record.coverStyle, record, customImg);

  ctx.fillStyle = 'rgba(244, 243, 238, 0.88)';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#181818';
  ctx.textAlign = 'center';
  ctx.font = '700 22px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(record.title, size / 2, size * 0.36);
  ctx.font = '500 15px "IBM Plex Mono", monospace';
  ctx.fillText(`${record.catalogCode} · 33⅓ RPM`, size / 2, size * 0.66);
  ctx.fillText('SIDE A', size / 2, size * 0.72);
  ctx.restore();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createVinylGrooveBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;
  for (let r = 175; r < 495; r += 3.5) {
    const shade = 105 + Math.floor(Math.sin(r * 0.7) * 40 + (r % 28 === 0 ? -45 : 0));
    ctx.strokeStyle = `rgb(${shade},${shade},${shade})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createCdPlayerFaceplateTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Brushed anodized aluminum faceplate
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#D4D6D0');
  grad.addColorStop(0.5, '#C5C8C1');
  grad.addColorStop(1, '#B8BBB4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle horizontal brushed micro-lines
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let y = 0; y < h; y += 3) {
    ctx.fillRect(0, y, w, 1);
  }

  // Top-left Micro Print & SA-1 badge
  ctx.fillStyle = '#181917';
  ctx.font = '600 20px "IBM Plex Mono", monospace';
  ctx.fillText('MICRO PRINT', 54, 70);

  ctx.font = '700 72px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#111210';
  ctx.fillText('SA-1', 54, 148);

  ctx.font = '600 17px "IBM Plex Mono", monospace';
  ctx.fillStyle = '#2B2C29';
  ctx.fillText('PORTABLE COMPACT DISC PLAYER', 54, 188);
  ctx.fillText('THE LITTLE SOUND ARCHIVE · 44.1 kHz', 54, 212);

  // Technical screw & alignment crosshairs
  ctx.strokeStyle = 'rgba(20,20,19,0.36)';
  ctx.lineWidth = 2;
  ctx.strokeRect(42, 38, w - 84, h - 76);

  // Button legend labels at bottom
  ctx.fillStyle = '#1B1C1A';
  ctx.font = '600 19px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('STOP', 238, 1230);
  ctx.fillText('PLAY / PAUSE', 512, 1230);
  ctx.fillText('PREV / NEXT', 778, 1230);

  ctx.textAlign = 'right';
  ctx.fillText('VOL', 950, 870);
  ctx.fillText('HOLD', 950, 420);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createCdLidDecalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const cx = size / 2;
  const cy = size / 2;

  // Outer transparent-lid structural ring & specular markings
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.475, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(30,30,28,0.32)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.34, 0, Math.PI * 2);
  ctx.stroke();

  // Curved text around inner arc: ANTI-SKIP / DO NOT OPEN WHILE SPINNING
  const drawArcText = (text: string, radius: number, startAngle: number, step: number) => {
    ctx.save();
    ctx.fillStyle = 'rgba(26,26,24,0.72)';
    ctx.font = '600 21px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < text.length; i++) {
      const a = startAngle + i * step;
      ctx.save();
      ctx.translate(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
      ctx.rotate(a + Math.PI / 2);
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
    ctx.restore();
  };

  drawArcText('ANTI-SKIP', size * 0.365, -Math.PI * 0.68, 0.055);
  drawArcText('DO NOT OPEN WHILE SPINNING', size * 0.365, -Math.PI * 0.25, 0.052);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export interface LcdDisplayUpdater {
  texture: THREE.CanvasTexture;
  update: (params: {
    trackTitle: string;
    indexNumber: string;
    elapsedSec: number;
    isPlaying: boolean;
    side: MediaSide;
    antiSkip: boolean;
    volume: number;
    level: number;
  }) => void;
}

export function createLcdScreenTexture(maxAnisotropy: number): LcdDisplayUpdater {
  const w = 640;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;

  let lastKey = '';

  const update: LcdDisplayUpdater['update'] = (params) => {
    const timeStr = formatLcdTime(params.elapsedSec);
    const key = `${params.trackTitle}|${params.indexNumber}|${timeStr}|${params.isPlaying}|${params.side}|${params.antiSkip}|${Math.round(params.volume * 20)}|${Math.round(params.level * 10)}`;
    if (key === lastKey) return;
    lastKey = key;

    // Classic grey-olive backlit LCD panel
    ctx.fillStyle = '#C9CEC3';
    ctx.fillRect(0, 0, w, h);

    // Inner bezel shadow
    ctx.strokeStyle = '#8F9588';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);

    ctx.fillStyle = '#1B1E1A';
    ctx.font = '600 22px "IBM Plex Mono", monospace';
    ctx.fillText('DISPLAY', 26, 40);
    ctx.fillText(params.isPlaying ? 'DISC SPINNING' : 'STANDBY', 280, 40);

    // Main track title
    ctx.font = '700 44px "IBM Plex Mono", monospace';
    const shortTitle = params.trackTitle.slice(0, 14);
    ctx.fillText(`:${shortTitle}`, 24, 114);

    // Track number box on right
    ctx.fillStyle = '#1B1E1A';
    ctx.fillRect(514, 70, 96, 62);
    ctx.fillStyle = '#C9CEC3';
    ctx.font = '700 40px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(params.indexNumber, 562, 115);
    ctx.textAlign = 'left';

    // Elapsed time readout
    ctx.fillStyle = '#1B1E1A';
    ctx.font = '600 42px "IBM Plex Mono", monospace';
    ctx.fillText(timeStr, 26, 184);

    // Bottom indicators: SIDE A/B, ANTI-SKIP, VU segments
    ctx.font = '600 19px "IBM Plex Mono", monospace';
    ctx.fillText(`SIDE ${params.side}`, 26, 228);
    if (params.antiSkip) {
      ctx.fillText('ESP ON', 142, 228);
    }
    ctx.fillText(`VOL ${Math.round(params.volume * 100)}%`, 250, 228);

    // VU meter bars
    const bars = 10;
    const activeBars = params.isPlaying ? Math.max(1, Math.round(params.level * bars)) : 0;
    for (let i = 0; i < bars; i++) {
      ctx.fillStyle = i < activeBars ? '#1B1E1A' : 'rgba(27,30,26,0.16)';
      ctx.fillRect(410 + i * 20, 206, 14, 24);
    }

    texture.needsUpdate = true;
  };

  update({
    trackTitle: 'HT LOW',
    indexNumber: '01',
    elapsedSec: 1.7,
    isPlaying: false,
    side: 'A',
    antiSkip: true,
    volume: 0.72,
    level: 0,
  });

  return { texture, update };
}

export function createCassettePlayerDecalTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 680;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // Burnt orange molded faceplate
  ctx.fillStyle = '#EA6A28';
  ctx.fillRect(0, 0, w, h);

  // Cream right side panel
  ctx.fillStyle = '#EFECE3';
  ctx.fillRect(w * 0.76, 0, w * 0.24, h);

  // Vertical seam line
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.fillRect(w * 0.76 - 2, 0, 4, h);

  // Speaker grille holes on cream panel
  ctx.fillStyle = '#2B2B29';
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      ctx.beginPath();
      ctx.arc(w * 0.83 + col * 24, 108 + row * 24, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Brand vertical text on cream panel
  ctx.save();
  ctx.translate(w * 0.88, h * 0.72);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#1D1D1B';
  ctx.font = '700 48px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('ohneis', 0, 0);
  ctx.restore();

  // Model stamp bottom left
  ctx.fillStyle = '#1B1B19';
  ctx.font = '700 32px "IBM Plex Mono", monospace';
  ctx.fillText('TR-852', 52, h - 54);
  ctx.font = '500 18px "IBM Plex Mono", monospace';
  ctx.fillText('STEREO CASSETTE PLAYER', 52, h - 26);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

export function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.48
  );
  grad.addColorStop(0, 'rgba(18, 18, 16, 0.34)');
  grad.addColorStop(0.55, 'rgba(18, 18, 16, 0.14)');
  grad.addColorStop(1, 'rgba(18, 18, 16, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
