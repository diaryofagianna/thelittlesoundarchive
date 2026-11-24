import * as THREE from 'three';
import type { MediaRecord } from '../types/media';
import {
  createCassetteLabelTexture,
  createCassettePlayerDecalTexture,
  createCdFaceTexture,
  createCdLidDecalTexture,
  createCdPlayerFaceplateTexture,
  createLcdScreenTexture,
  createVinylCenterLabelTexture,
  createVinylSleeveTexture,
  type LcdDisplayUpdater,
} from './proceduralTextures';

export function createRoundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const rad = Math.min(r, w / 2, h / 2);

  shape.moveTo(x + rad, y);
  shape.lineTo(x + w - rad, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + rad);
  shape.lineTo(x + w, y + h - rad);
  shape.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  shape.lineTo(x + rad, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - rad);
  shape.lineTo(x, y + rad);
  shape.quadraticCurveTo(x, y, x + rad, y);
  return shape;
}

export interface ShelfMediaHandle {
  recordId: string;
  format: MediaRecord['format'];
  group: THREE.Group;
  hitMesh: THREE.Mesh;
  spinPivot: THREE.Object3D;
  secondarySpinPivot?: THREE.Object3D;
  sleeveGroup?: THREE.Object3D;
  discGroup?: THREE.Object3D;
  updateCover: (record: MediaRecord, customImg?: HTMLImageElement) => void;
  dispose: () => void;
}

export function createCompactDiscMedia(
  record: MediaRecord,
  maxAnisotropy: number,
  isSoftwareGl: boolean
): ShelfMediaHandle {
  const group = new THREE.Group();
  const spinPivot = new THREE.Group();
  group.add(spinPivot);

  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];
  let activeCoverTex = createCdFaceTexture(record, maxAnisotropy);

  // 1. Clear polycarbonate substrate disc
  const subGeo = new THREE.CylinderGeometry(1.06, 1.06, 0.024, 64, 1, false);
  subGeo.rotateX(Math.PI / 2);
  const subMat = new THREE.MeshPhysicalMaterial({
    color: 0xeef3f6,
    roughness: 0.12,
    metalness: 0.05,
    transparent: true,
    opacity: isSoftwareGl ? 0.45 : 0.85,
    transmission: isSoftwareGl ? 0 : 0.72,
    ior: 1.52,
    thickness: 0.12,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const subMesh = new THREE.Mesh(subGeo, subMat);
  subMesh.castShadow = true;
  spinPivot.add(subMesh);
  disposableGeos.push(subGeo);
  disposableMats.push(subMat);

  // 2. Iridescent metallic data ring
  const dataGeo = new THREE.RingGeometry(0.32, 1.03, 64);
  const dataMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9e1e6,
    metalness: 0.9,
    roughness: 0.14,
    iridescence: 0.95,
    iridescenceIOR: 1.35,
    side: THREE.DoubleSide,
  });
  const dataMesh = new THREE.Mesh(dataGeo, dataMat);
  dataMesh.position.z = -0.002;
  spinPivot.add(dataMesh);
  disposableGeos.push(dataGeo);
  disposableMats.push(dataMat);

  // 3. Printed front graphic label (mapped cleanly in 0..1 UVs)
  const artGeo = new THREE.RingGeometry(0.3, 1.045, 64);
  // Remap RingGeometry UVs to full planar square 0..1 so circular artwork aligns 1:1
  const posAttr = artGeo.attributes.position;
  const uvAttr = artGeo.attributes.uv;
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vy = posAttr.getY(i);
    uvAttr.setXY(i, (vx / 2.13) + 0.5, (vy / 2.13) + 0.5);
  }
  uvAttr.needsUpdate = true;

  const artMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: activeCoverTex,
    transparent: true,
    roughness: 0.24,
    metalness: 0.1,
    clearcoat: 0.85,
    clearcoatRoughness: 0.1,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const artMesh = new THREE.Mesh(artGeo, artMat);
  artMesh.position.z = 0.015;
  artMesh.castShadow = true;
  spinPivot.add(artMesh);
  disposableGeos.push(artGeo);
  disposableMats.push(artMat);

  // 4. Center clamp hub & inner translucent ring
  const hubGeo = new THREE.TorusGeometry(0.165, 0.016, 12, 48);
  const hubMat = new THREE.MeshStandardMaterial({
    color: 0xd8dce0,
    roughness: 0.2,
    metalness: 0.35,
  });
  const hubMesh = new THREE.Mesh(hubGeo, hubMat);
  hubMesh.position.z = 0.012;
  spinPivot.add(hubMesh);
  disposableGeos.push(hubGeo);
  disposableMats.push(hubMat);

  // 5. Inner frosted stacking ridge
  const ridgeGeo = new THREE.TorusGeometry(0.305, 0.008, 8, 48);
  const ridgeMesh = new THREE.Mesh(ridgeGeo, hubMat);
  ridgeMesh.position.z = 0.014;
  spinPivot.add(ridgeMesh);
  disposableGeos.push(ridgeGeo);

  // Invisible hit proxy for smooth raycasting
  const hitGeo = new THREE.CylinderGeometry(1.12, 1.12, 0.25, 24);
  hitGeo.rotateX(Math.PI / 2);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.layers.enable(1);
  hitMesh.userData.recordId = record.id;
  group.add(hitMesh);
  disposableGeos.push(hitGeo);
  disposableMats.push(hitMat);

  return {
    recordId: record.id,
    format: 'cd',
    group,
    hitMesh,
    spinPivot,
    discGroup: spinPivot,
    updateCover: (nextRec, customImg) => {
      const nextTex = createCdFaceTexture(nextRec, maxAnisotropy, customImg);
      activeCoverTex.dispose();
      activeCoverTex = nextTex;
      artMat.map = nextTex;
      artMat.needsUpdate = true;
    },
    dispose: () => {
      activeCoverTex.dispose();
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
    },
  };
}

export function createCassetteMedia(
  record: MediaRecord,
  maxAnisotropy: number,
  isSoftwareGl: boolean
): ShelfMediaHandle {
  const group = new THREE.Group();
  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];

  let activeLabelTex = createCassetteLabelTexture(record, maxAnisotropy);

  // 1. Beveled main cassette shell
  const shellShape = createRoundedRectShape(2.14, 1.36, 0.07);
  const shellGeo = new THREE.ExtrudeGeometry(shellShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 3,
  });
  shellGeo.center();
  const shellMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(record.shellColor),
    roughness: 0.48,
    metalness: 0.08,
  });
  const shellMesh = new THREE.Mesh(shellGeo, shellMat);
  shellMesh.castShadow = true;
  shellMesh.receiveShadow = true;
  group.add(shellMesh);
  disposableGeos.push(shellGeo);
  disposableMats.push(shellMat);

  // 2. Printed paper label on front
  const labelGeo = new THREE.PlaneGeometry(1.88, 1.02);
  const labelMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: activeLabelTex,
    roughness: 0.62,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const labelMesh = new THREE.Mesh(labelGeo, labelMat);
  labelMesh.position.set(0, 0.07, 0.138);
  group.add(labelMesh);
  disposableGeos.push(labelGeo);
  disposableMats.push(labelMat);

  // 3. Recessed dark tape window chamber
  const bayGeo = new THREE.BoxGeometry(1.06, 0.36, 0.06);
  const bayMat = new THREE.MeshStandardMaterial({
    color: 0x151618,
    roughness: 0.7,
    metalness: 0.1,
  });
  const bayMesh = new THREE.Mesh(bayGeo, bayMat);
  bayMesh.position.set(0, 0.07, 0.116);
  group.add(bayMesh);
  disposableGeos.push(bayGeo);
  disposableMats.push(bayMat);

  // 4. Dual rotating reels (left + right tape hubs with teeth)
  const reelMat = new THREE.MeshStandardMaterial({
    color: 0xf1efe9,
    roughness: 0.3,
    metalness: 0.05,
  });
  const tapeMat = new THREE.MeshStandardMaterial({
    color: 0x2a1e18,
    roughness: 0.38,
    metalness: 0.2,
  });
  const reelGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.05, 20);
  reelGeo.rotateX(Math.PI / 2);
  const tapeRingGeo = new THREE.TorusGeometry(0.165, 0.042, 8, 28);
  const toothGeo = new THREE.BoxGeometry(0.024, 0.055, 0.056);

  const buildReel = (xPos: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(xPos, 0.07, 0.13);

    const hub = new THREE.Mesh(reelGeo, reelMat);
    pivot.add(hub);

    const spool = new THREE.Mesh(tapeRingGeo, tapeMat);
    spool.position.z = -0.015;
    pivot.add(spool);

    // One instanced draw call replaces six identical reel-tooth meshes.
    const teeth = new THREE.InstancedMesh(toothGeo, reelMat, 6);
    const toothTransform = new THREE.Object3D();
    for (let t = 0; t < 6; t++) {
      const ang = (t / 6) * Math.PI * 2;
      toothTransform.position.set(
        Math.cos(ang) * 0.075,
        Math.sin(ang) * 0.075,
        0.005
      );
      toothTransform.rotation.set(0, 0, ang);
      toothTransform.updateMatrix();
      teeth.setMatrixAt(t, toothTransform.matrix);
    }
    teeth.instanceMatrix.needsUpdate = true;
    teeth.computeBoundingSphere();
    pivot.add(teeth);
    group.add(pivot);
    return pivot;
  };

  const leftReel = buildReel(-0.37);
  const rightReel = buildReel(0.37);
  disposableGeos.push(reelGeo, tapeRingGeo, toothGeo);
  disposableMats.push(reelMat, tapeMat);

  // 5. Clear acrylic window plate over reels
  const winGeo = new THREE.PlaneGeometry(1.02, 0.32);
  const winMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.08,
    metalness: 0.0,
    transparent: true,
    opacity: isSoftwareGl ? 0.25 : 0.32,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const winMesh = new THREE.Mesh(winGeo, winMat);
  winMesh.position.set(0, 0.07, 0.15);
  winMesh.renderOrder = 3;
  group.add(winMesh);
  disposableGeos.push(winGeo);
  disposableMats.push(winMat);

  // 6. Bottom raised magnetic head bridge & micro-screws
  const bridgeGeo = new THREE.BoxGeometry(1.38, 0.26, 0.06);
  const bridgeMesh = new THREE.Mesh(bridgeGeo, shellMat);
  bridgeMesh.position.set(0, -0.54, 0.132);
  group.add(bridgeMesh);
  disposableGeos.push(bridgeGeo);

  const screwGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.02, 12);
  screwGeo.rotateX(Math.PI / 2);
  const screwMat = new THREE.MeshStandardMaterial({
    color: 0xbec2c6,
    metalness: 0.85,
    roughness: 0.25,
  });
  const screwCoords = [
    [-0.96, 0.56],
    [0.96, 0.56],
    [-0.96, -0.56],
    [0.96, -0.56],
  ];
  // The four casing screws share one instanced draw call.
  const screws = new THREE.InstancedMesh(screwGeo, screwMat, screwCoords.length);
  const screwTransform = new THREE.Object3D();
  screwCoords.forEach(([sx, sy], index) => {
    screwTransform.position.set(sx, sy, 0.136);
    screwTransform.rotation.set(0, 0, 0);
    screwTransform.updateMatrix();
    screws.setMatrixAt(index, screwTransform.matrix);
  });
  screws.instanceMatrix.needsUpdate = true;
  screws.computeBoundingSphere();
  group.add(screws);
  disposableGeos.push(screwGeo);
  disposableMats.push(screwMat);

  // Hit proxy
  const hitGeo = new THREE.BoxGeometry(2.3, 1.5, 0.4);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.layers.enable(1);
  hitMesh.userData.recordId = record.id;
  group.add(hitMesh);
  disposableGeos.push(hitGeo);
  disposableMats.push(hitMat);

  return {
    recordId: record.id,
    format: 'cassette',
    group,
    hitMesh,
    spinPivot: leftReel,
    secondarySpinPivot: rightReel,
    updateCover: (nextRec, customImg) => {
      const nextTex = createCassetteLabelTexture(nextRec, maxAnisotropy, customImg);
      activeLabelTex.dispose();
      activeLabelTex = nextTex;
      labelMat.map = nextTex;
      labelMat.needsUpdate = true;
    },
    dispose: () => {
      activeLabelTex.dispose();
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
    },
  };
}

export function createVinylMedia(
  record: MediaRecord,
  grooveBumpTex: THREE.Texture,
  maxAnisotropy: number
): ShelfMediaHandle {
  const group = new THREE.Group();
  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];

  let activeSleeveTex = createVinylSleeveTexture(record, maxAnisotropy);
  let activeLabelTex = createVinylCenterLabelTexture(record, maxAnisotropy);

  // 1. Cardboard LP Jacket Sleeve (shifted slightly left so vinyl slides right)
  const sleeveGroup = new THREE.Group();
  sleeveGroup.position.set(-0.22, 0, 0.02);
  group.add(sleeveGroup);

  const sleeveShape = createRoundedRectShape(2.14, 2.14, 0.02);
  const sleeveGeo = new THREE.ExtrudeGeometry(sleeveShape, {
    depth: 0.055,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  sleeveGeo.center();
  const cardboardMat = new THREE.MeshStandardMaterial({
    color: 0xe6e4dd,
    roughness: 0.78,
    metalness: 0.02,
  });
  const sleeveBody = new THREE.Mesh(sleeveGeo, cardboardMat);
  sleeveBody.castShadow = true;
  sleeveBody.receiveShadow = true;
  sleeveGroup.add(sleeveBody);
  disposableGeos.push(sleeveGeo);
  disposableMats.push(cardboardMat);

  // Front printed jacket art
  const frontArtGeo = new THREE.PlaneGeometry(2.1, 2.1);
  const frontArtMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: activeSleeveTex,
    roughness: 0.56,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const frontArt = new THREE.Mesh(frontArtGeo, frontArtMat);
  frontArt.position.z = 0.038;
  sleeveGroup.add(frontArt);
  disposableGeos.push(frontArtGeo);
  disposableMats.push(frontArtMat);

  // 2. Sliding 12" Grooved Vinyl Disc
  const discGroup = new THREE.Group();
  discGroup.position.set(0.32, 0, -0.01);
  group.add(discGroup);

  const spinPivot = new THREE.Group();
  discGroup.add(spinPivot);

  const vinylGeo = new THREE.CylinderGeometry(1.01, 1.01, 0.022, 64);
  vinylGeo.rotateX(Math.PI / 2);
  const vinylMat = new THREE.MeshPhysicalMaterial({
    color: 0x161618,
    roughness: 0.24,
    metalness: 0.14,
    clearcoat: 0.92,
    clearcoatRoughness: 0.12,
    bumpMap: grooveBumpTex,
    bumpScale: 0.004,
  });
  const vinylMesh = new THREE.Mesh(vinylGeo, vinylMat);
  vinylMesh.castShadow = true;
  spinPivot.add(vinylMesh);
  disposableGeos.push(vinylGeo);
  disposableMats.push(vinylMat);

  // Center paper label on vinyl
  const centerGeo = new THREE.CircleGeometry(0.34, 48);
  const centerMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: activeLabelTex,
    roughness: 0.65,
    metalness: 0.02,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const centerMesh = new THREE.Mesh(centerGeo, centerMat);
  centerMesh.position.z = 0.013;
  spinPivot.add(centerMesh);
  disposableGeos.push(centerGeo);
  disposableMats.push(centerMat);

  // Center spindle hole dark ring
  const holeGeo = new THREE.CylinderGeometry(0.036, 0.036, 0.03, 20);
  holeGeo.rotateX(Math.PI / 2);
  const holeMat = new THREE.MeshStandardMaterial({ color: 0xd8d8d4, roughness: 0.4 });
  const holeMesh = new THREE.Mesh(holeGeo, holeMat);
  spinPivot.add(holeMesh);
  disposableGeos.push(holeGeo);
  disposableMats.push(holeMat);

  // Hit proxy
  const hitGeo = new THREE.BoxGeometry(2.75, 2.25, 0.28);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const hitMesh = new THREE.Mesh(hitGeo, hitMat);
  hitMesh.layers.enable(1);
  hitMesh.userData.recordId = record.id;
  group.add(hitMesh);
  disposableGeos.push(hitGeo);
  disposableMats.push(hitMat);

  return {
    recordId: record.id,
    format: 'vinyl',
    group,
    hitMesh,
    spinPivot,
    sleeveGroup,
    discGroup,
    updateCover: (nextRec, customImg) => {
      const nextSleeve = createVinylSleeveTexture(nextRec, maxAnisotropy, customImg);
      const nextLabel = createVinylCenterLabelTexture(nextRec, maxAnisotropy, customImg);
      activeSleeveTex.dispose();
      activeLabelTex.dispose();
      activeSleeveTex = nextSleeve;
      activeLabelTex = nextLabel;
      frontArtMat.map = nextSleeve;
      frontArtMat.needsUpdate = true;
      centerMat.map = nextLabel;
      centerMat.needsUpdate = true;
    },
    dispose: () => {
      activeSleeveTex.dispose();
      activeLabelTex.dispose();
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
    },
  };
}

export interface CdPlayerRigHandle {
  group: THREE.Group;
  discMount: THREE.Group;
  lidPivot: THREE.Group;
  lcdUpdater: LcdDisplayUpdater;
  volumeWheel: THREE.Mesh;
  stopButton: THREE.Mesh;
  playButton: THREE.Mesh;
  nextButton: THREE.Mesh;
  dispose: () => void;
}

export function createCdPlayerRig(
  maxAnisotropy: number,
  isSoftwareGl: boolean
): CdPlayerRigHandle {
  const group = new THREE.Group();
  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];

  const playerCluster = new THREE.Group();
  playerCluster.position.set(1.05, 0.24, 0);
  group.add(playerCluster);

  const faceplateTex = createCdPlayerFaceplateTexture(maxAnisotropy);
  const lidDecalTex = createCdLidDecalTexture(maxAnisotropy);
  const lcdUpdater = createLcdScreenTexture(maxAnisotropy);

  // 1. Brushed aluminum SA-1 main body
  const bodyShape = createRoundedRectShape(2.58, 3.34, 0.14);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.3,
    bevelEnabled: true,
    bevelThickness: 0.04,
    bevelSize: 0.04,
    bevelSegments: 4,
  });
  bodyGeo.center();
  const alumMat = new THREE.MeshPhysicalMaterial({
    color: 0xc5c8c2,
    metalness: 0.72,
    roughness: 0.32,
    anisotropy: 0.55,
    clearcoat: 0.2,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, alumMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  playerCluster.add(bodyMesh);
  disposableGeos.push(bodyGeo);
  disposableMats.push(alumMat);

  // Faceplate decal overlay
  const faceGeo = new THREE.PlaneGeometry(2.46, 3.22);
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: faceplateTex,
    roughness: 0.4,
    metalness: 0.25,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.position.z = 0.194;
  playerCluster.add(faceMesh);
  disposableGeos.push(faceGeo);
  disposableMats.push(faceMat);

  // 2. Recessed circular disc bay
  const bayGeo = new THREE.CylinderGeometry(1.04, 1.04, 0.06, 64);
  bayGeo.rotateX(Math.PI / 2);
  const bayMat = new THREE.MeshStandardMaterial({
    color: 0x2b2d30,
    roughness: 0.68,
    metalness: 0.2,
  });
  const bayMesh = new THREE.Mesh(bayGeo, bayMat);
  bayMesh.position.set(0, -0.18, 0.175);
  playerCluster.add(bayMesh);
  disposableGeos.push(bayGeo);
  disposableMats.push(bayMat);

  // Central spindle chuck
  const spindleGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.09, 32);
  spindleGeo.rotateX(Math.PI / 2);
  const spindleMat = new THREE.MeshStandardMaterial({
    color: 0xb7bbc0,
    metalness: 0.85,
    roughness: 0.2,
  });
  const spindleMesh = new THREE.Mesh(spindleGeo, spindleMat);
  spindleMesh.position.set(0, -0.18, 0.2);
  playerCluster.add(spindleMesh);
  disposableGeos.push(spindleGeo);
  disposableMats.push(spindleMat);

  // Disc mount inside bay
  const discMount = new THREE.Group();
  discMount.position.set(0, -0.18, 0.215);
  playerCluster.add(discMount);

  // 3. Hinged transparent circular lid
  const lidPivot = new THREE.Group();
  lidPivot.position.set(-1.05, -0.18, 0.26);
  playerCluster.add(lidPivot);

  const lidDiscGeo = new THREE.CylinderGeometry(1.03, 1.03, 0.026, 64);
  lidDiscGeo.rotateX(Math.PI / 2);
  const lidMat = new THREE.MeshPhysicalMaterial({
    color: 0xf4f7f8,
    roughness: 0.06,
    metalness: 0.0,
    transparent: true,
    opacity: isSoftwareGl ? 0.2 : 0.26,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const lidGlass = new THREE.Mesh(lidDiscGeo, lidMat);
  lidGlass.position.set(1.05, 0, 0);
  lidGlass.renderOrder = 6;
  lidPivot.add(lidGlass);

  const lidDecalGeo = new THREE.PlaneGeometry(2.04, 2.04);
  const lidDecalMat = new THREE.MeshBasicMaterial({
    map: lidDecalTex,
    transparent: true,
    depthWrite: false,
  });
  const lidDecal = new THREE.Mesh(lidDecalGeo, lidDecalMat);
  lidDecal.position.set(1.05, 0, 0.017);
  lidDecal.renderOrder = 7;
  lidPivot.add(lidDecal);
  disposableGeos.push(lidDiscGeo, lidDecalGeo);
  disposableMats.push(lidMat, lidDecalMat);

  // 4. Backlit LCD display screen (top-right, clear above disc lid)
  const lcdBezelGeo = new THREE.BoxGeometry(1.38, 0.56, 0.04);
  const lcdBezelMat = new THREE.MeshStandardMaterial({
    color: 0x1e201e,
    roughness: 0.35,
    metalness: 0.2,
  });
  const lcdBezel = new THREE.Mesh(lcdBezelGeo, lcdBezelMat);
  lcdBezel.position.set(0.42, 1.19, 0.19);
  playerCluster.add(lcdBezel);

  const lcdFaceGeo = new THREE.PlaneGeometry(1.26, 0.46);
  const lcdFaceMat = new THREE.MeshStandardMaterial({
    map: lcdUpdater.texture,
    roughness: 0.25,
    metalness: 0.05,
    emissive: 0x3b4238,
    emissiveMap: lcdUpdater.texture,
    emissiveIntensity: 0.28,
  });
  const lcdFace = new THREE.Mesh(lcdFaceGeo, lcdFaceMat);
  lcdFace.position.set(0.42, 1.19, 0.214);
  playerCluster.add(lcdFace);
  disposableGeos.push(lcdBezelGeo, lcdFaceGeo);
  disposableMats.push(lcdBezelMat, lcdFaceMat);

  // 5. Tactile transport buttons (Red Stop, Silver Play, Silver Skip)
  const keyGeo = new THREE.BoxGeometry(0.46, 0.21, 0.08);
  const stopMat = new THREE.MeshStandardMaterial({
    color: 0xd93829,
    roughness: 0.35,
    metalness: 0.05,
  });
  const keyMat = new THREE.MeshStandardMaterial({
    color: 0xb6bab4,
    roughness: 0.32,
    metalness: 0.65,
  });

  const stopButton = new THREE.Mesh(keyGeo, stopMat);
  stopButton.position.set(-0.66, -1.38, 0.195);
  stopButton.userData.hardwareAction = 'stop';
  stopButton.layers.enable(1);
  playerCluster.add(stopButton);

  const playButton = new THREE.Mesh(keyGeo, keyMat);
  playButton.position.set(0.0, -1.38, 0.195);
  playButton.userData.hardwareAction = 'togglePlay';
  playButton.layers.enable(1);
  playerCluster.add(playButton);

  const nextButton = new THREE.Mesh(keyGeo, keyMat);
  nextButton.position.set(0.66, -1.38, 0.195);
  nextButton.userData.hardwareAction = 'next';
  nextButton.layers.enable(1);
  playerCluster.add(nextButton);

  disposableGeos.push(keyGeo);
  disposableMats.push(stopMat, keyMat);

  // 6. Side Volume Thumbwheel
  const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.12, 24);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x35373a,
    roughness: 0.45,
    metalness: 0.5,
  });
  const volumeWheel = new THREE.Mesh(wheelGeo, wheelMat);
  volumeWheel.position.set(1.31, -0.58, 0.02);
  volumeWheel.userData.hardwareAction = 'volume';
  volumeWheel.layers.enable(1);
  playerCluster.add(volumeWheel);
  disposableGeos.push(wheelGeo);
  disposableMats.push(wheelMat);

  // 7. Retro Lightweight Headphones + Curved Audio Cable
  const headphones = new THREE.Group();
  headphones.position.set(-1.95, 0.42, 0.05);
  group.add(headphones);

  const bandCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.62, -0.05, 0),
    new THREE.Vector3(-0.66, 0.72, 0),
    new THREE.Vector3(0, 1.24, 0),
    new THREE.Vector3(0.66, 0.72, 0),
    new THREE.Vector3(0.62, -0.05, 0),
  ]);
  const bandGeo = new THREE.TubeGeometry(bandCurve, 40, 0.042, 12, false);
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0xcfd3d6,
    metalness: 0.85,
    roughness: 0.22,
  });
  const bandMesh = new THREE.Mesh(bandGeo, bandMat);
  bandMesh.castShadow = true;
  headphones.add(bandMesh);
  disposableGeos.push(bandGeo);
  disposableMats.push(bandMat);

  // Earcup shells + bright orange foam cushions
  const cupShellGeo = new THREE.CylinderGeometry(0.32, 0.34, 0.1, 32);
  cupShellGeo.rotateZ(Math.PI / 2);
  const foamGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.12, 32);
  foamGeo.rotateZ(Math.PI / 2);

  const cupMat = new THREE.MeshStandardMaterial({
    color: 0xd6d8d4,
    metalness: 0.45,
    roughness: 0.32,
  });
  const foamMat = new THREE.MeshStandardMaterial({
    color: 0xeb6a2b,
    roughness: 0.94,
    metalness: 0.0,
  });

  const leftCup = new THREE.Mesh(cupShellGeo, cupMat);
  leftCup.position.set(-0.62, -0.2, 0);
  leftCup.castShadow = true;
  const leftFoam = new THREE.Mesh(foamGeo, foamMat);
  leftFoam.position.set(-0.52, -0.2, 0);
  headphones.add(leftCup, leftFoam);

  const rightCup = new THREE.Mesh(cupShellGeo, cupMat);
  rightCup.position.set(0.62, -0.2, 0);
  rightCup.castShadow = true;
  const rightFoam = new THREE.Mesh(foamGeo, foamMat);
  rightFoam.position.set(0.52, -0.2, 0);
  headphones.add(rightCup, rightFoam);

  disposableGeos.push(cupShellGeo, foamGeo);
  disposableMats.push(cupMat, foamMat);

  // Sweeping black cable from right earcup into SA-1 left headphone jack
  const cordCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-1.33, -0.02, 0.05),
    new THREE.Vector3(-1.45, -1.05, 0.12),
    new THREE.Vector3(-0.65, -1.42, 0.08),
    new THREE.Vector3(-0.34, -0.68, 0.02),
    new THREE.Vector3(-0.28, 1.05, 0.02),
  ]);
  const cordGeo = new THREE.TubeGeometry(cordCurve, 48, 0.022, 8, false);
  const cordMat = new THREE.MeshStandardMaterial({
    color: 0x1c1d1f,
    roughness: 0.55,
    metalness: 0.08,
  });
  const cordMesh = new THREE.Mesh(cordGeo, cordMat);
  cordMesh.castShadow = true;
  group.add(cordMesh);

  // 3.5mm jack plug
  const jackGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.22, 16);
  jackGeo.rotateZ(Math.PI / 2);
  const jackMesh = new THREE.Mesh(jackGeo, cordMat);
  jackMesh.position.set(-0.28, 1.05, 0.02);
  group.add(jackMesh);

  disposableGeos.push(cordGeo, jackGeo);
  disposableMats.push(cordMat);

  return {
    group,
    discMount,
    lidPivot,
    lcdUpdater,
    volumeWheel,
    stopButton,
    playButton,
    nextButton,
    dispose: () => {
      faceplateTex.dispose();
      lidDecalTex.dispose();
      lcdUpdater.texture.dispose();
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
    },
  };
}

export interface CassettePlayerRigHandle {
  group: THREE.Group;
  tapeMount: THREE.Group;
  doorPivot: THREE.Group;
  keys: THREE.Mesh[];
  volumeWheel: THREE.Mesh;
  dispose: () => void;
}

export function createCassettePlayerRig(
  maxAnisotropy: number,
  isSoftwareGl: boolean
): CassettePlayerRigHandle {
  const group = new THREE.Group();
  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];

  const decalTex = createCassettePlayerDecalTexture(maxAnisotropy);

  // 1. TR-852 Orange & Cream Main Chassis
  const bodyShape = createRoundedRectShape(3.26, 2.16, 0.14);
  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: 0.48,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.045,
    bevelSegments: 4,
  });
  bodyGeo.center();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0xe86a29,
    roughness: 0.36,
    metalness: 0.06,
  });
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  group.add(bodyMesh);
  disposableGeos.push(bodyGeo);
  disposableMats.push(bodyMat);

  // Front printed faceplate
  const faceGeo = new THREE.PlaneGeometry(3.16, 2.06);
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: decalTex,
    roughness: 0.42,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const faceMesh = new THREE.Mesh(faceGeo, faceMat);
  faceMesh.position.z = 0.288;
  group.add(faceMesh);
  disposableGeos.push(faceGeo);
  disposableMats.push(faceMat);

  // 2. Cassette bay mount (slightly left to match orange zone)
  const bayGeo = new THREE.BoxGeometry(2.24, 1.44, 0.16);
  const bayMat = new THREE.MeshStandardMaterial({
    color: 0x1e1f22,
    roughness: 0.72,
    metalness: 0.15,
  });
  const bayMesh = new THREE.Mesh(bayGeo, bayMat);
  bayMesh.position.set(-0.36, 0.02, 0.23);
  group.add(bayMesh);
  disposableGeos.push(bayGeo);
  disposableMats.push(bayMat);

  const tapeMount = new THREE.Group();
  tapeMount.position.set(-0.36, 0.02, 0.25);
  group.add(tapeMount);

  // 3. Round transparent cassette door window centered over the spinning reels
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-0.36, -0.68, 0.34);
  group.add(doorPivot);

  const ringFrameGeo = new THREE.TorusGeometry(0.55, 0.026, 12, 48);
  const ringFrameMat = new THREE.MeshStandardMaterial({
    color: 0x262729,
    metalness: 0.5,
    roughness: 0.32,
  });
  const ringFrame = new THREE.Mesh(ringFrameGeo, ringFrameMat);
  ringFrame.position.set(0, 0.64, 0.02);
  doorPivot.add(ringFrame);

  const windowGeo = new THREE.CircleGeometry(0.54, 48);
  const windowMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.06,
    metalness: 0.0,
    transparent: true,
    opacity: isSoftwareGl ? 0.16 : 0.22,
    clearcoat: 1.0,
    depthWrite: false,
  });
  const windowMesh = new THREE.Mesh(windowGeo, windowMat);
  windowMesh.position.set(0, 0.64, 0.022);
  windowMesh.renderOrder = 6;
  doorPivot.add(windowMesh);
  disposableGeos.push(ringFrameGeo, windowGeo);
  disposableMats.push(ringFrameMat, windowMat);

  // 4. Five Top Tactile Transport Keys (4 Matte Black + 1 Yellow)
  const keyGeo = new THREE.BoxGeometry(0.36, 0.18, 0.28);
  const blackKeyMat = new THREE.MeshStandardMaterial({
    color: 0x151618,
    roughness: 0.65,
    metalness: 0.04,
  });
  const yellowKeyMat = new THREE.MeshStandardMaterial({
    color: 0xf4c430,
    roughness: 0.35,
    metalness: 0.05,
  });

  const keys: THREE.Mesh[] = [];
  const keyActions = ['stop', 'prev', 'togglePlay', 'next', 'side'] as const;
  for (let i = 0; i < 5; i++) {
    const isYellow = i === 4;
    const keyMesh = new THREE.Mesh(keyGeo, isYellow ? yellowKeyMat : blackKeyMat);
    keyMesh.position.set(-1.05 + i * 0.44, 1.15, 0.02);
    keyMesh.castShadow = true;
    keyMesh.userData.hardwareAction = keyActions[i];
    keyMesh.layers.enable(1);
    group.add(keyMesh);
    keys.push(keyMesh);
  }
  disposableGeos.push(keyGeo);
  disposableMats.push(blackKeyMat, yellowKeyMat);

  // 5. Side volume thumbwheel
  const wheelGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.14, 24);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x242528,
    roughness: 0.4,
    metalness: 0.35,
  });
  const volumeWheel = new THREE.Mesh(wheelGeo, wheelMat);
  volumeWheel.position.set(1.66, 0.08, 0.02);
  volumeWheel.userData.hardwareAction = 'volume';
  volumeWheel.layers.enable(1);
  group.add(volumeWheel);
  disposableGeos.push(wheelGeo);
  disposableMats.push(wheelMat);

  return {
    group,
    tapeMount,
    doorPivot,
    keys,
    volumeWheel,
    dispose: () => {
      decalTex.dispose();
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
    },
  };
}

export interface TurntableRigHandle {
  group: THREE.Group;
  platterGroup: THREE.Group;
  discMount: THREE.Group;
  sleeveStandMount: THREE.Group;
  tonearmPivot: THREE.Group;
  speedKnob: THREE.Mesh;
  cueButton: THREE.Mesh;
  dispose: () => void;
}

export function createTurntableRig(): TurntableRigHandle {
  const group = new THREE.Group();
  const disposableGeos: THREE.BufferGeometry[] = [];
  const disposableMats: THREE.Material[] = [];

  const turntableCluster = new THREE.Group();
  turntableCluster.position.set(0.55, 0.14, 0);
  // Positive rotation around X tilts the top platter/tonearm/vinyl toward +Z camera!
  turntableCluster.rotation.x = Math.PI * 0.24;
  group.add(turntableCluster);

  // 1. Minimalist architectural plinth + dark bottom chassis trim
  const plinthShape = createRoundedRectShape(3.5, 2.8, 0.08);
  const plinthGeo = new THREE.ExtrudeGeometry(plinthShape, {
    depth: 0.22,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 3,
  });
  plinthGeo.center();
  plinthGeo.rotateX(Math.PI / 2);

  const plinthMat = new THREE.MeshStandardMaterial({
    color: 0xd9d8d2,
    roughness: 0.46,
    metalness: 0.1,
  });
  const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
  plinthMesh.castShadow = true;
  plinthMesh.receiveShadow = true;
  turntableCluster.add(plinthMesh);

  const subTrimGeo = new THREE.BoxGeometry(3.42, 0.07, 2.72);
  const subTrimMat = new THREE.MeshStandardMaterial({
    color: 0x262729,
    roughness: 0.55,
    metalness: 0.2,
  });
  const subTrimMesh = new THREE.Mesh(subTrimGeo, subTrimMat);
  subTrimMesh.position.y = -0.14;
  turntableCluster.add(subTrimMesh);

  disposableGeos.push(plinthGeo, subTrimGeo);
  disposableMats.push(plinthMat, subTrimMat);

  // 2. Machined Aluminum Platter & Slipmat
  const platterGroup = new THREE.Group();
  platterGroup.position.set(-0.22, 0.16, 0);
  turntableCluster.add(platterGroup);

  const platterGeo = new THREE.CylinderGeometry(1.14, 1.16, 0.09, 64);
  const platterMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9cdd1,
    metalness: 0.88,
    roughness: 0.2,
    anisotropy: 0.7,
  });
  const platterMesh = new THREE.Mesh(platterGeo, platterMat);
  platterMesh.castShadow = true;
  platterMesh.receiveShadow = true;
  platterGroup.add(platterMesh);

  const matGeo = new THREE.CylinderGeometry(1.06, 1.06, 0.02, 64);
  const matMat = new THREE.MeshStandardMaterial({
    color: 0x202123,
    roughness: 0.85,
    metalness: 0.02,
  });
  const slipmat = new THREE.Mesh(matGeo, matMat);
  slipmat.position.y = 0.05;
  platterGroup.add(slipmat);

  // Brass spindle
  const spindleGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.14, 20);
  const brassMat = new THREE.MeshStandardMaterial({
    color: 0xd3af5f,
    metalness: 0.9,
    roughness: 0.2,
  });
  const spindleMesh = new THREE.Mesh(spindleGeo, brassMat);
  spindleMesh.position.y = 0.08;
  platterGroup.add(spindleMesh);

  disposableGeos.push(platterGeo, matGeo, spindleGeo);
  disposableMats.push(platterMat, matMat, brassMat);

  // Disc mount lying flat on platter
  const discMount = new THREE.Group();
  discMount.position.y = 0.075;
  discMount.rotation.x = -Math.PI / 2;
  platterGroup.add(discMount);

  // 3. Gimbal Tonearm Assembly
  const tonearmBaseGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.1, 32);
  const darkMetalMat = new THREE.MeshStandardMaterial({
    color: 0x2c2e31,
    metalness: 0.7,
    roughness: 0.3,
  });
  const tonearmBase = new THREE.Mesh(tonearmBaseGeo, darkMetalMat);
  tonearmBase.position.set(1.25, 0.18, -0.82);
  turntableCluster.add(tonearmBase);

  const tonearmPivot = new THREE.Group();
  tonearmPivot.position.set(1.25, 0.26, -0.82);
  turntableCluster.add(tonearmPivot);

  const armCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, -0.25),
    new THREE.Vector3(0, 0, 0.35),
    new THREE.Vector3(-0.08, 0, 0.88),
    new THREE.Vector3(-0.22, -0.02, 1.38),
  ]);
  const armGeo = new THREE.TubeGeometry(armCurve, 32, 0.025, 10, false);
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe0e3e6,
    metalness: 0.92,
    roughness: 0.15,
  });
  const armMesh = new THREE.Mesh(armGeo, chromeMat);
  armMesh.castShadow = true;
  tonearmPivot.add(armMesh);

  const counterGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.18, 20);
  counterGeo.rotateX(Math.PI / 2);
  const counterMesh = new THREE.Mesh(counterGeo, darkMetalMat);
  counterMesh.position.set(0, 0, -0.25);
  tonearmPivot.add(counterMesh);

  const headshellGeo = new THREE.BoxGeometry(0.11, 0.05, 0.22);
  const cartMat = new THREE.MeshStandardMaterial({
    color: 0xd93829,
    roughness: 0.35,
    metalness: 0.2,
  });
  const headshell = new THREE.Mesh(headshellGeo, cartMat);
  headshell.position.set(-0.24, -0.02, 1.44);
  headshell.rotation.y = 0.22;
  tonearmPivot.add(headshell);

  disposableGeos.push(tonearmBaseGeo, armGeo, counterGeo, headshellGeo);
  disposableMats.push(darkMetalMat, chromeMat, cartMat);

  // 4. Front-left Speed Knob (33/45) & Cue Button
  const knobGeo = new THREE.CylinderGeometry(0.13, 0.14, 0.09, 24);
  const speedKnob = new THREE.Mesh(knobGeo, platterMat);
  speedKnob.position.set(-1.35, 0.16, 0.98);
  speedKnob.userData.hardwareAction = 'speed';
  speedKnob.layers.enable(1);
  turntableCluster.add(speedKnob);

  const cueGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.08, 24);
  const cueButton = new THREE.Mesh(cueGeo, cartMat);
  cueButton.position.set(-1.02, 0.16, 1.04);
  cueButton.userData.hardwareAction = 'togglePlay';
  cueButton.layers.enable(1);
  turntableCluster.add(cueButton);
  disposableGeos.push(knobGeo, cueGeo);

  // 5. Upright Sleeve Display Stand on the left of turntable
  const sleeveStandMount = new THREE.Group();
  sleeveStandMount.position.set(-2.3, 0.24, -0.1);
  sleeveStandMount.rotation.y = 0.28;
  group.add(sleeveStandMount);

  return {
    group,
    platterGroup,
    discMount,
    sleeveStandMount,
    tonearmPivot,
    speedKnob,
    cueButton,
    dispose: () => {
      disposableGeos.forEach((g) => g.dispose());
      disposableMats.forEach((m) => m.dispose());
    },
  };
}
