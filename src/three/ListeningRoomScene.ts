import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type {
  AppMode,
  MediaFormat,
  MediaRecord,
  PlayerSection,
  PlayerStatusSnapshot,
} from '../types/media';
import {
  clampShelfScroll,
  computeShelfTransform,
  getCameraPoseForState,
  nearestShelfIndex,
} from '../utils/shelfMath';
import {
  createCassetteMedia,
  createCassettePlayerRig,
  createCdPlayerRig,
  createCompactDiscMedia,
  createTurntableRig,
  createVinylMedia,
  type CassettePlayerRigHandle,
  type CdPlayerRigHandle,
  type ShelfMediaHandle,
  type TurntableRigHandle,
} from './hardwareModels';
import {
  createContactShadowTexture,
  createVinylGrooveBumpTexture,
} from './proceduralTextures';

export interface SceneCallbacks {
  onFocusIndexChange: (index: number) => void;
  onSelectRecordForPlayer: (record: MediaRecord) => void;
  onHardwareAction: (
    action: 'stop' | 'togglePlay' | 'next' | 'prev' | 'side' | 'speed' | 'volume'
  ) => void;
  onHoverMediaChange: (hovered: boolean, label: string | null) => void;
  onWebGlContextLost: (lost: boolean) => void;
}

const _vec3A = new THREE.Vector3();
const _vec3B = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

export class ListeningRoomScene {
  private container: HTMLElement;
  private callbacks: SceneCallbacks;
  private isSoftwareGl: boolean;

  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private maxAnisotropy: number;
  private activePixelRatio = 1;
  private environmentTarget: THREE.WebGLRenderTarget;
  private resizeObserver: ResizeObserver | null = null;
  private isDocumentHidden = document.hidden;
  private contextLost = false;
  private prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

  private shelfGroup = new THREE.Group();
  private playerStageGroup = new THREE.Group();
  private shadowPlanes: THREE.Mesh[] = [];
  private shelfShadowGeometry: THREE.PlaneGeometry;
  private shelfShadowMaterial: THREE.MeshBasicMaterial;
  private shelfHitMeshes: THREE.Mesh[] = [];
  private playerControlTargets: THREE.Object3D[] = [];

  private performanceHud: HTMLDivElement;
  private showPerformanceHud = false;
  private performanceWindowStart = 0;
  private performanceFrameCount = 0;
  private lastHudUpdate = 0;

  private grooveBumpTex: THREE.Texture;
  private contactShadowTex: THREE.Texture;

  private shelfHandles: ShelfMediaHandle[] = [];
  private visibleRecords: MediaRecord[] = [];
  private customImages = new Map<string, HTMLImageElement>();

  private cdRig: CdPlayerRigHandle;
  private cassetteRig: CassettePlayerRigHandle;
  private turntableRig: TurntableRigHandle;

  private activePlayerMedia: ShelfMediaHandle | null = null;
  private activePlayerRecordId: string | null = null;

  // Dynamic state
  private appMode: AppMode = 'loader';
  private activeSection: PlayerSection = 'overview';
  private activeRecord: MediaRecord | null = null;
  private playerStatus: PlayerStatusSnapshot = {
    isPlaying: false,
    elapsedSec: 0,
    durationSec: 180,
    volume: 0.72,
    side: 'A',
    antiSkip: true,
    rpmMode: 33,
    level: 0,
  };

  // Scroll & kinematics
  private targetScroll = 0;
  private currentScroll = 0;
  private activeSpinAngle = 0;
  private activeSpinVelocity = 0;
  private mediaSpinAngle = 0;
  private vinylSlideProgress = 0;
  private tonearmAngle = 0;
  private lidAngle = 0;
  private pointerParallax = { x: 0, y: 0 };

  private cameraTargetPos = new THREE.Vector3(0, 0.35, 7.6);
  private cameraTargetLook = new THREE.Vector3(0, 0.02, 0);
  private currentLook = new THREE.Vector3(0, 0.02, 0);

  // Pointer & raycast state
  private raycaster = new THREE.Raycaster();
  private ndcPointer = new THREE.Vector2();
  private dragMode: 'none' | 'spin' | 'scrub' = 'none';
  private dragMoved = false;
  private lastPointer = { x: 0, y: 0 };
  private lastHoverCheck = 0;

  // Render loop scheduling
  private frameId = 0;
  private loopActive = false;
  private lastTickTime = performance.now();
  private disposed = false;

  constructor(
    container: HTMLElement,
    initialRecords: MediaRecord[],
    callbacks: SceneCallbacks
  ) {
    this.container = container;
    this.callbacks = callbacks;
    this.isSoftwareGl = detectSoftwareWebGL();

    const width = Math.max(1, container.clientWidth);
    const height = Math.max(1, container.clientHeight);

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.applyRenderResolution(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.setAttribute('data-testid', 'listening-room-canvas');

    container.appendChild(this.renderer.domElement);
    this.performanceHud = document.createElement('div');
    this.performanceHud.setAttribute('aria-hidden', 'true');
    this.performanceHud.style.cssText = [
      'position:absolute', 'right:14px', 'bottom:14px', 'z-index:20',
      'display:none', 'pointer-events:none', 'white-space:pre',
      'padding:9px 11px', 'border:1px solid rgba(23,23,23,.16)',
      'background:rgba(250,249,246,.88)', 'color:#33332f',
      'font:10px/1.55 ui-monospace,SFMono-Regular,Menlo,monospace',
      'letter-spacing:.02em', 'backdrop-filter:blur(8px)',
    ].join(';');
    container.appendChild(this.performanceHud);

    this.maxAnisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xededea);
    this.scene.fog = new THREE.Fog(0xededea, 12, 28);

    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 60);
    this.camera.position.copy(this.cameraTargetPos);
    this.camera.lookAt(this.currentLook);

    // Pre-bake the studio environment once, then release the temporary scene.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnvironment = new RoomEnvironment();
    this.environmentTarget = pmrem.fromScene(roomEnvironment, 0.04);
    this.scene.environment = this.environmentTarget.texture;
    roomEnvironment.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose?.();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material?.dispose?.();
      }
    });
    pmrem.dispose();

    this.setupLighting();

    this.grooveBumpTex = createVinylGrooveBumpTexture(this.maxAnisotropy);
    this.contactShadowTex = createContactShadowTexture();
    this.shelfShadowGeometry = new THREE.PlaneGeometry(2.6, 0.9);
    this.shelfShadowMaterial = new THREE.MeshBasicMaterial({
      map: this.contactShadowTex,
      transparent: true,
      opacity: 0.36,
      depthWrite: false,
    });

    this.scene.add(this.shelfGroup);
    this.scene.add(this.playerStageGroup);
    this.playerStageGroup.visible = false;

    // Build all 3 hardware player rigs once
    this.cdRig = createCdPlayerRig(this.maxAnisotropy, this.isSoftwareGl);
    this.cassetteRig = createCassettePlayerRig(this.maxAnisotropy, this.isSoftwareGl);
    this.turntableRig = createTurntableRig();

    this.playerStageGroup.add(this.cdRig.group);
    this.playerStageGroup.add(this.cassetteRig.group);
    this.playerStageGroup.add(this.turntableRig.group);
    this.playerControlTargets = [
      this.cdRig.stopButton,
      this.cdRig.playButton,
      this.cdRig.nextButton,
      this.cdRig.volumeWheel,
      ...this.cassetteRig.keys,
      this.cassetteRig.volumeWheel,
      this.turntableRig.cueButton,
      this.turntableRig.speedKnob,
    ];

    // Add studio grounding contact shadow beneath player rig
    const playerShadowGeo = new THREE.PlaneGeometry(6.8, 3.2);
    const playerShadowMat = new THREE.MeshBasicMaterial({
      map: this.contactShadowTex,
      transparent: true,
      opacity: 0.42,
      depthWrite: false,
    });
    const playerShadow = new THREE.Mesh(playerShadowGeo, playerShadowMat);
    playerShadow.rotation.x = -Math.PI / 2;
    playerShadow.position.set(0, -1.75, 0);
    this.playerStageGroup.add(playerShadow);
    this.shadowPlanes.push(playerShadow);

    this.raycaster.layers.set(1);

    this.setVisibleRecords(initialRecords);
    this.bindEvents();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    this.kickRenderLoop();
  }

  private applyRenderResolution(width: number, height: number) {
    const viewportPixels = Math.max(1, width * height);
    const maxRatio = this.isSoftwareGl ? 0.9 : width < 640 ? 1.25 : 1.5;
    const pixelBudgetRatio = Math.sqrt(3_000_000 / viewportPixels);
    const deviceRatio = Math.max(1, window.devicePixelRatio || 1);
    const ratio = Math.max(0.75, Math.min(deviceRatio, maxRatio, pixelBudgetRatio));

    if (Math.abs(ratio - this.activePixelRatio) > 0.01) {
      this.activePixelRatio = ratio;
      this.renderer.setPixelRatio(ratio);
    }
    this.renderer.setSize(width, height, false);
  }

  private setupLighting() {
    // Cool sky / warm ground Hemisphere fill
    const hemi = new THREE.HemisphereLight(0xf4f7fb, 0xdad4ca, 0.88);
    this.scene.add(hemi);

    // Warm directional Key Light
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.55);
    keyLight.position.set(4.5, 7.5, 6.2);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.camera.left = -6;
    keyLight.shadow.camera.right = 6;
    keyLight.shadow.camera.top = 5;
    keyLight.shadow.camera.bottom = -5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    // Cool Rim Light from top-back-left
    const rimLight = new THREE.DirectionalLight(0xdbe8ff, 0.72);
    rimLight.position.set(-5.5, 3.5, -4.0);
    this.scene.add(rimLight);

    if (!this.isSoftwareGl) {
      RectAreaLightUniformsLib.init();
      const softbox = new THREE.RectAreaLight(0xffffff, 1.35, 8, 4);
      softbox.position.set(0, 4.2, 4.5);
      softbox.lookAt(0, 0, 0);
      this.scene.add(softbox);
    }
  }

  private createMediaHandleForRecord(record: MediaRecord): ShelfMediaHandle {
    let handle: ShelfMediaHandle;
    if (record.format === 'cd') {
      handle = createCompactDiscMedia(record, this.maxAnisotropy, this.isSoftwareGl);
    } else if (record.format === 'cassette') {
      handle = createCassetteMedia(record, this.maxAnisotropy, this.isSoftwareGl);
    } else {
      handle = createVinylMedia(record, this.grooveBumpTex, this.maxAnisotropy);
    }

    const customImg = this.customImages.get(record.id);
    if (customImg) {
      handle.updateCover(record, customImg);
    }
    return handle;
  }

  public setVisibleRecords(records: MediaRecord[]) {
    // Dispose previous shelf meshes cleanly
    for (const h of this.shelfHandles) {
      this.shelfGroup.remove(h.group);
      h.dispose();
    }
    this.shelfHandles = [];
    this.visibleRecords = records;

    for (let i = 0; i < records.length; i++) {
      const rec = records[i];
      const handle = this.createMediaHandleForRecord(rec);

      // Share shadow geometry/material across shelf items to avoid repeated GPU allocations.
      const shadowMesh = new THREE.Mesh(this.shelfShadowGeometry, this.shelfShadowMaterial);
      shadowMesh.rotation.x = -Math.PI / 2;
      shadowMesh.position.set(0, -1.28, 0);
      handle.group.add(shadowMesh);

      this.shelfGroup.add(handle.group);
      this.shelfHandles.push(handle);
    }
    this.shelfHitMeshes = this.shelfHandles.map((handle) => handle.hitMesh);

    this.targetScroll = clampShelfScroll(this.targetScroll, records.length);
    this.currentScroll = this.targetScroll;
    this.layoutShelfImmediate();
    this.kickRenderLoop();
  }

  private layoutShelfImmediate() {
    for (let i = 0; i < this.shelfHandles.length; i++) {
      const handle = this.shelfHandles[i];
      const tr = computeShelfTransform(i, this.currentScroll);
      handle.group.position.set(tr.x, tr.y, tr.z);
      handle.group.rotation.y = tr.rotY;
      handle.group.scale.setScalar(tr.scale);
    }
  }

  public updateRecordMetadata(record: MediaRecord) {
    if (record.customCoverDataUrl) {
      const coverSource = record.customCoverDataUrl;
      const img = new Image();
      img.onload = () => {
        const latestRecord =
          this.visibleRecords.find((item) => item.id === record.id) ??
          (this.activeRecord?.id === record.id ? this.activeRecord : null);
        // Ignore stale image loads when a cover is changed again before decoding completes.
        if (latestRecord?.customCoverDataUrl !== coverSource || this.disposed) return;
        this.customImages.set(record.id, img);
        this.applyCoverToHandles(record, img);
      };
      img.src = coverSource;
    } else {
      this.customImages.delete(record.id);
      this.applyCoverToHandles(record, undefined);
    }

    // Update visible records copy
    this.visibleRecords = this.visibleRecords.map((r) =>
      r.id === record.id ? record : r
    );
    if (this.activeRecord?.id === record.id) {
      this.activeRecord = record;
    }
    this.kickRenderLoop();
  }

  private applyCoverToHandles(record: MediaRecord, img?: HTMLImageElement) {
    const shelfMatch = this.shelfHandles.find((h) => h.recordId === record.id);
    if (shelfMatch) {
      shelfMatch.updateCover(record, img);
    }
    if (this.activePlayerMedia && this.activePlayerRecordId === record.id) {
      this.activePlayerMedia.updateCover(record, img);
    }
    this.kickRenderLoop();
  }

  public setAppState(params: {
    mode: AppMode;
    activeRecord: MediaRecord | null;
    section: PlayerSection;
    status: PlayerStatusSnapshot;
  }) {
    const prevMode = this.appMode;
    const prevRecordId = this.activePlayerRecordId;

    this.appMode = params.mode;
    this.activeSection = params.section;
    this.activeRecord = params.activeRecord;
    this.playerStatus = params.status;

    const isPlayer = params.mode === 'player' && params.activeRecord !== null;
    this.shelfGroup.visible = !isPlayer;
    this.playerStageGroup.visible = isPlayer;

    if (isPlayer && params.activeRecord) {
      const format = params.activeRecord.format;
      this.cdRig.group.visible = format === 'cd';
      this.cassetteRig.group.visible = format === 'cassette';
      this.turntableRig.group.visible = format === 'vinyl';

      if (prevRecordId !== params.activeRecord.id || prevMode !== 'player') {
        this.mountRecordIntoPlayer(params.activeRecord);
      }

      const pose = getCameraPoseForState('player', format, params.section);
      this.cameraTargetPos.set(...pose.position);
      this.cameraTargetLook.set(...pose.target);
    } else {
      const pose = getCameraPoseForState('shelf', 'cd', 'overview');
      this.cameraTargetPos.set(...pose.position);
      this.cameraTargetLook.set(...pose.target);
    }

    this.updateLcdFromStatus();
    this.kickRenderLoop();
  }

  private mountRecordIntoPlayer(record: MediaRecord) {
    if (this.activePlayerMedia) {
      this.activePlayerMedia.group.parent?.remove(this.activePlayerMedia.group);
      this.activePlayerMedia.dispose();
      this.activePlayerMedia = null;
    }

    const media = this.createMediaHandleForRecord(record);
    this.activePlayerMedia = media;
    this.activePlayerRecordId = record.id;
    this.mediaSpinAngle = 0;

    if (record.format === 'cd') {
      // Scale disc to fit SA-1 recessed bay neatly beneath circular lid
      media.group.scale.setScalar(0.93);
      this.cdRig.discMount.add(media.group);
      this.lidAngle = -0.35; // Slight open lid entrance animation -> closes smoothly
    } else if (record.format === 'cassette') {
      media.group.scale.setScalar(0.97);
      media.group.position.set(0, 0, -0.02);
      this.cassetteRig.tapeMount.add(media.group);
      this.lidAngle = -0.25;
    } else {
      // Vinyl slides out of sleeve onto turntable platter; sleeve sits on display stand
      if (media.sleeveGroup && media.discGroup) {
        media.discGroup.position.set(0, 0, 0);
        this.turntableRig.discMount.add(media.discGroup);

        media.sleeveGroup.position.set(0, 0, 0);
        media.sleeveGroup.scale.setScalar(0.86);
        this.turntableRig.sleeveStandMount.add(media.sleeveGroup);
      }
      this.turntableRig.group.add(media.group);
      media.group.visible = false; // Child disc & sleeve are mounted in rig slots
    }
  }

  public scrollToShelfIndex(index: number) {
    this.targetScroll = clampShelfScroll(index, this.visibleRecords.length);
    this.callbacks.onFocusIndexChange(nearestShelfIndex(this.targetScroll, this.visibleRecords.length));
    this.kickRenderLoop();
  }

  public stepShelf(delta: number) {
    const currentIdx = nearestShelfIndex(this.targetScroll, this.visibleRecords.length);
    this.scrollToShelfIndex(currentIdx + delta);
  }

  private updateLcdFromStatus() {
    if (!this.activeRecord || this.activeRecord.format !== 'cd') return;
    const track =
      this.playerStatus.side === 'A'
        ? this.activeRecord.sideA
        : this.activeRecord.sideB;
    this.cdRig.lcdUpdater.update({
      trackTitle: track.title,
      indexNumber: this.activeRecord.indexNumber,
      elapsedSec: this.playerStatus.elapsedSec,
      isPlaying: this.playerStatus.isPlaying,
      side: this.playerStatus.side,
      antiSkip: this.playerStatus.antiSkip,
      volume: this.playerStatus.volume,
      level: this.playerStatus.level,
    });
  }

  public updatePlaybackTick(status: PlayerStatusSnapshot) {
    this.playerStatus = status;
    this.updateLcdFromStatus();
    if (status.isPlaying && !this.loopActive) {
      this.kickRenderLoop();
    }
  }

  private bindEvents() {
    const dom = this.renderer.domElement;

    dom.addEventListener('wheel', this.onWheel, { passive: false });
    dom.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(this.onObservedResize);
      this.resizeObserver.observe(this.container);
    } else {
      window.addEventListener('resize', this.onResize);
    }
    dom.addEventListener('webglcontextlost', this.onContextLost);
    dom.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  private unbindEvents() {
    const dom = this.renderer.domElement;
    dom.removeEventListener('wheel', this.onWheel);
    dom.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    window.removeEventListener('resize', this.onResize);
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    dom.removeEventListener('webglcontextlost', this.onContextLost);
    dom.removeEventListener('webglcontextrestored', this.onContextRestored);
  }

  private onContextLost = (e: Event) => {
    e.preventDefault();
    this.contextLost = true;
    this.loopActive = false;
    this.cancelScheduledFrame();
    this.callbacks.onWebGlContextLost(true);
  };

  private onContextRestored = () => {
    this.contextLost = false;
    this.callbacks.onWebGlContextLost(false);
    this.kickRenderLoop();
  };

  private onVisibilityChange = () => {
    this.isDocumentHidden = document.hidden;
    if (this.isDocumentHidden) {
      this.loopActive = false;
      this.cancelScheduledFrame();
    } else {
      this.kickRenderLoop();
    }
  };

  private onObservedResize = () => this.onResize();

  private onResize = () => {
    if (this.disposed) return;
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.applyRenderResolution(width, height);
    this.kickRenderLoop();
  };

  private onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')) return;
    if (event.key.toLowerCase() !== 'g' || event.metaKey || event.ctrlKey || event.altKey) return;

    this.showPerformanceHud = !this.showPerformanceHud;
    this.performanceHud.style.display = this.showPerformanceHud ? 'block' : 'none';
    this.performanceHud.setAttribute('aria-hidden', String(!this.showPerformanceHud));
    this.performanceWindowStart = performance.now();
    this.performanceFrameCount = 0;
    if (this.showPerformanceHud) this.kickRenderLoop();
  };

  private cancelScheduledFrame() {
    if (!this.frameId) return;
    cancelAnimationFrame(this.frameId);
    window.clearTimeout(this.frameId);
    this.frameId = 0;
  }

  private updatePerformanceHud(now: number) {
    if (!this.showPerformanceHud) return;
    this.performanceFrameCount += 1;
    if (now - this.lastHudUpdate < 500) return;

    const elapsed = Math.max(1, now - this.performanceWindowStart);
    const fps = Math.round((this.performanceFrameCount * 1000) / elapsed);
    const info = this.renderer.info;
    this.performanceHud.textContent = [
      `SCENE · ${fps} FPS · DPR ${this.activePixelRatio.toFixed(2)}`,
      `${info.render.calls} draw calls · ${info.render.triangles.toLocaleString()} triangles`,
      `${info.memory.geometries} geometries · ${info.memory.textures} textures`,
      'G · hide performance panel',
    ].join('\n');
    this.performanceWindowStart = now;
    this.performanceFrameCount = 0;
    this.lastHudUpdate = now;
  };

  private onWheel = (e: WheelEvent) => {
    if (this.appMode !== 'shelf') return;
    e.preventDefault();
    const delta = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * 0.0028;
    const prevIdx = nearestShelfIndex(this.targetScroll, this.visibleRecords.length);
    this.targetScroll = clampShelfScroll(
      this.targetScroll + delta,
      this.visibleRecords.length
    );
    const nextIdx = nearestShelfIndex(this.targetScroll, this.visibleRecords.length);
    if (nextIdx !== prevIdx) {
      this.callbacks.onFocusIndexChange(nextIdx);
    }
    this.kickRenderLoop();
  };

  private updateNdc(clientX: number, clientY: number) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.ndcPointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.ndcPointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private onPointerDown = (e: PointerEvent) => {
    this.updateNdc(e.clientX, e.clientY);
    this.lastPointer = { x: e.clientX, y: e.clientY };
    this.dragMoved = false;

    if (this.appMode === 'shelf') {
      this.raycaster.setFromCamera(this.ndcPointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.shelfHitMeshes, false);

      if (hits.length > 0) {
        const hitId = hits[0].object.userData.recordId as string;
        const idx = this.visibleRecords.findIndex((r) => r.id === hitId);
        const focusedIdx = nearestShelfIndex(this.targetScroll, this.visibleRecords.length);
        if (idx === focusedIdx) {
          this.dragMode = 'spin';
          return;
        }
      }
      this.dragMode = 'scrub';
      return;
    }

    if (this.appMode === 'player') {
      this.raycaster.setFromCamera(this.ndcPointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.playerControlTargets, false);
      if (hits.length > 0) {
        const action = hits[0].object.userData.hardwareAction as
          | 'stop'
          | 'togglePlay'
          | 'next'
          | 'prev'
          | 'side'
          | 'speed'
          | 'volume'
          | undefined;
        if (action) {
          this.callbacks.onHardwareAction(action);
        }
      }
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = ((e.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
    const ny = -((e.clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1;
    this.pointerParallax.x = Math.max(-1, Math.min(1, nx));
    this.pointerParallax.y = Math.max(-1, Math.min(1, ny));

    const dx = e.clientX - this.lastPointer.x;
    const dy = e.clientY - this.lastPointer.y;
    if (Math.hypot(dx, dy) > 4) {
      this.dragMoved = true;
    }

    if (this.dragMode === 'spin') {
      this.activeSpinVelocity += dx * 0.018;
      this.activeSpinAngle += dx * 0.02;
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.kickRenderLoop();
      return;
    }

    if (this.dragMode === 'scrub' && this.appMode === 'shelf') {
      const prevIdx = nearestShelfIndex(this.targetScroll, this.visibleRecords.length);
      this.targetScroll = clampShelfScroll(
        this.targetScroll - dx * 0.0085,
        this.visibleRecords.length
      );
      const nextIdx = nearestShelfIndex(this.targetScroll, this.visibleRecords.length);
      if (nextIdx !== prevIdx) {
        this.callbacks.onFocusIndexChange(nextIdx);
      }
      this.lastPointer = { x: e.clientX, y: e.clientY };
      this.kickRenderLoop();
      return;
    }

    // Throttled hover raycast
    const now = performance.now();
    if (now - this.lastHoverCheck > 60) {
      this.lastHoverCheck = now;
      this.updateNdc(e.clientX, e.clientY);
      this.raycaster.setFromCamera(this.ndcPointer, this.camera);

      if (this.appMode === 'shelf') {
        const hits = this.raycaster.intersectObjects(this.shelfHitMeshes, false);
        if (hits.length > 0) {
          const hitId = hits[0].object.userData.recordId as string;
          const idx = this.visibleRecords.findIndex((r) => r.id === hitId);
          const focusedIdx = nearestShelfIndex(this.targetScroll, this.visibleRecords.length);
          this.renderer.domElement.style.cursor = 'pointer';
          this.callbacks.onHoverMediaChange(
            true,
            idx === focusedIdx
              ? 'DRAG TO SPIN · CLICK TO LOAD'
              : `CENTER ${this.visibleRecords[idx]?.title || ''}`
          );
        } else {
          this.renderer.domElement.style.cursor = 'grab';
          this.callbacks.onHoverMediaChange(false, null);
        }
      } else {
        this.renderer.domElement.style.cursor = 'default';
      }
    }

    this.kickRenderLoop();
  };

  private onPointerUp = (e: PointerEvent) => {
    const wasSpinOrScrub = this.dragMode !== 'none';
    const moved = this.dragMoved;
    this.dragMode = 'none';

    if (wasSpinOrScrub && !moved && this.appMode === 'shelf') {
      this.updateNdc(e.clientX, e.clientY);
      this.raycaster.setFromCamera(this.ndcPointer, this.camera);
      const hits = this.raycaster.intersectObjects(this.shelfHitMeshes, false);

      if (hits.length > 0) {
        const hitId = hits[0].object.userData.recordId as string;
        const idx = this.visibleRecords.findIndex((r) => r.id === hitId);
        const focusedIdx = nearestShelfIndex(this.targetScroll, this.visibleRecords.length);
        if (idx === focusedIdx && this.visibleRecords[idx]) {
          this.callbacks.onSelectRecordForPlayer(this.visibleRecords[idx]);
        } else if (idx >= 0) {
          this.scrollToShelfIndex(idx);
        }
      } else {
        // Snap cleanly to nearest index on release
        const snapped = nearestShelfIndex(this.targetScroll, this.visibleRecords.length);
        this.targetScroll = snapped;
        this.callbacks.onFocusIndexChange(snapped);
      }
    } else if (wasSpinOrScrub && this.appMode === 'shelf') {
      // Snap cleanly after drag scrub
      const snapped = nearestShelfIndex(this.targetScroll, this.visibleRecords.length);
      this.targetScroll = snapped;
      this.callbacks.onFocusIndexChange(snapped);
    }

    this.kickRenderLoop();
  };

  private kickRenderLoop() {
    if (this.disposed || this.contextLost || this.isDocumentHidden || this.loopActive) return;
    this.loopActive = true;
    this.lastTickTime = performance.now();
    this.scheduleNextFrame();
  }

  private scheduleNextFrame() {
    if (this.disposed || this.contextLost || this.isDocumentHidden || !this.loopActive) return;
    const callback = () => {
      this.frameId = 0;
      if (!this.disposed && !this.contextLost && !this.isDocumentHidden && this.loopActive) {
        this.tick();
      }
    };
    if (this.isSoftwareGl) {
      // Cap software-rendered WebGL to ~12 FPS without polling GPU sync objects.
      this.frameId = window.setTimeout(callback, 80);
    } else {
      this.frameId = requestAnimationFrame(callback);
    }
  }

  private tick = () => {
    if (this.disposed) return;

    const now = performance.now();
    const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTickTime) / 1000));
    this.lastTickTime = now;

    let needsMoreFrames = false;

    // 1. Camera smooth damping + gentle pointer parallax
    const parallaxScale = this.prefersReducedMotion ? 0 : this.appMode === 'player' ? 0.16 : 0.28;
    _vec3A.set(
      this.cameraTargetPos.x + this.pointerParallax.x * parallaxScale,
      this.cameraTargetPos.y + this.pointerParallax.y * parallaxScale * 0.6,
      this.cameraTargetPos.z
    );
    this.camera.position.x = THREE.MathUtils.damp(this.camera.position.x, _vec3A.x, 7, dt);
    this.camera.position.y = THREE.MathUtils.damp(this.camera.position.y, _vec3A.y, 7, dt);
    this.camera.position.z = THREE.MathUtils.damp(this.camera.position.z, _vec3A.z, 7, dt);

    this.currentLook.x = THREE.MathUtils.damp(this.currentLook.x, this.cameraTargetLook.x, 7, dt);
    this.currentLook.y = THREE.MathUtils.damp(this.currentLook.y, this.cameraTargetLook.y, 7, dt);
    this.currentLook.z = THREE.MathUtils.damp(this.currentLook.z, this.cameraTargetLook.z, 7, dt);
    this.camera.lookAt(this.currentLook);

    if (
      this.camera.position.distanceTo(_vec3A) > 0.004 ||
      this.currentLook.distanceTo(this.cameraTargetLook) > 0.004
    ) {
      needsMoreFrames = true;
    }

    // 2. Shelf Mode animations
    if (this.appMode === 'shelf') {
      this.currentScroll = THREE.MathUtils.damp(
        this.currentScroll,
        this.targetScroll,
        9.5,
        dt
      );
      if (Math.abs(this.currentScroll - this.targetScroll) > 0.002) {
        needsMoreFrames = true;
      }

      if (Math.abs(this.activeSpinVelocity) > 0.001) {
        this.activeSpinAngle += this.activeSpinVelocity * dt * 6;
        this.activeSpinVelocity *= Math.exp(-3.2 * dt);
        needsMoreFrames = true;
      }

      const focusedIdx = nearestShelfIndex(this.currentScroll, this.visibleRecords.length);
      this.vinylSlideProgress = THREE.MathUtils.damp(
        this.vinylSlideProgress,
        this.visibleRecords[focusedIdx]?.format === 'vinyl' ? 1 : 0,
        6,
        dt
      );

      for (let i = 0; i < this.shelfHandles.length; i++) {
        const handle = this.shelfHandles[i];
        const tr = computeShelfTransform(i, this.currentScroll);
        handle.group.position.set(tr.x, tr.y, tr.z);
        handle.group.rotation.y =
          tr.rotY + (i === focusedIdx ? this.pointerParallax.x * 0.08 : 0);
        handle.group.scale.setScalar(tr.scale);

        if (i === focusedIdx) {
          if (handle.format === 'cd') {
            handle.spinPivot.rotation.z = this.activeSpinAngle;
          } else if (handle.format === 'cassette') {
            handle.spinPivot.rotation.z = this.activeSpinAngle * 1.4;
            if (handle.secondarySpinPivot) {
              handle.secondarySpinPivot.rotation.z = this.activeSpinAngle * 1.4;
            }
          } else if (handle.format === 'vinyl') {
            handle.spinPivot.rotation.z = this.activeSpinAngle;
            if (handle.discGroup && handle.sleeveGroup) {
              handle.discGroup.position.x = 0.28 + this.vinylSlideProgress * 0.34;
              handle.sleeveGroup.position.x = -0.22 - this.vinylSlideProgress * 0.14;
            }
          }
        }
      }
    }

    // 3. Player Mode animations
    if (this.appMode === 'player' && this.activeRecord) {
      const format = this.activeRecord.format;
      const playing = this.playerStatus.isPlaying;

      // Close lid smoothly
      this.lidAngle = THREE.MathUtils.damp(this.lidAngle, 0, 6, dt);
      if (Math.abs(this.lidAngle) > 0.004) needsMoreFrames = true;

      if (format === 'cd') {
        this.cdRig.lidPivot.rotation.y = this.lidAngle;
        this.cdRig.volumeWheel.rotation.z = -this.playerStatus.volume * 2.4;
        this.cdRig.playButton.position.z = playing ? 0.172 : 0.195;

        if (playing && this.activePlayerMedia) {
          this.mediaSpinAngle -= dt * 5.2;
          this.activePlayerMedia.spinPivot.rotation.z = this.mediaSpinAngle;
          needsMoreFrames = true;
        }
      } else if (format === 'cassette') {
        this.cassetteRig.doorPivot.rotation.x = -this.lidAngle;
        this.cassetteRig.volumeWheel.rotation.z = -this.playerStatus.volume * 2.4;
        // Depress Play key (index 2) when playing
        this.cassetteRig.keys[2].position.y = playing ? 1.11 : 1.15;

        if (playing && this.activePlayerMedia) {
          this.mediaSpinAngle -= dt * 2.2;
          this.activePlayerMedia.spinPivot.rotation.z = this.mediaSpinAngle;
          if (this.activePlayerMedia.secondarySpinPivot) {
            this.activePlayerMedia.secondarySpinPivot.rotation.z = this.mediaSpinAngle;
          }
          needsMoreFrames = true;
        }
      } else if (format === 'vinyl') {
        const targetArm = playing ? -0.42 : 0.0;
        this.tonearmAngle = THREE.MathUtils.damp(this.tonearmAngle, targetArm, 5.5, dt);
        this.turntableRig.tonearmPivot.rotation.y = this.tonearmAngle;
        this.turntableRig.speedKnob.rotation.y =
          this.playerStatus.rpmMode === 45 ? 0.85 : 0.0;
        if (Math.abs(this.tonearmAngle - targetArm) > 0.004) {
          needsMoreFrames = true;
        }

        if (playing && this.activePlayerMedia) {
          const speed = this.playerStatus.rpmMode === 45 ? 2.8 : 2.1;
          this.mediaSpinAngle -= dt * speed;
          this.activePlayerMedia.spinPivot.rotation.z = this.mediaSpinAngle;
          needsMoreFrames = true;
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
    this.updatePerformanceHud(now);
    if (this.showPerformanceHud) needsMoreFrames = true;

    if (needsMoreFrames && !this.isDocumentHidden && !this.contextLost) {
      this.scheduleNextFrame();
    } else {
      this.loopActive = false;
    }
  };

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.loopActive = false;
    this.cancelScheduledFrame();
    this.unbindEvents();

    for (const handle of this.shelfHandles) handle.dispose();
    this.shelfHandles = [];
    this.shelfHitMeshes = [];
    if (this.activePlayerMedia) {
      this.activePlayerMedia.dispose();
      this.activePlayerMedia = null;
    }

    this.cdRig.dispose();
    this.cassetteRig.dispose();
    this.turntableRig.dispose();
    this.grooveBumpTex.dispose();
    this.contactShadowTex.dispose();
    this.shelfShadowGeometry.dispose();
    this.shelfShadowMaterial.dispose();
    this.environmentTarget.dispose();
    this.scene.environment = null;
    this.customImages.clear();

    for (const mesh of this.shadowPlanes) {
      mesh.geometry.dispose();
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((material) => material.dispose());
      } else {
        mesh.material.dispose();
      }
    }
    this.shadowPlanes = [];

    this.performanceHud.remove();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
