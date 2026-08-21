import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { EV63_KEY_ROWS, type Ev63KeyDefinition } from "../device/ev63";

export type Ev63SceneState = "idle" | "connecting" | "connected" | "disconnected";
export type Ev63ScenePhase = "waiting" | "handshake" | "materialize" | "inspect" | "explode" | "ready" | "offline";

export interface Ev63SceneOptions {
  readonly onPhaseChange?: (phase: Ev63ScenePhase) => void;
}

export interface Ev63SceneController {
  setState(state: Ev63SceneState): void;
  setExploded(exploded: boolean): void;
  pulseInput(): void;
  dispose(): void;
}

interface KeyPosition {
  readonly definition: Ev63KeyDefinition;
  readonly x: number;
  readonly z: number;
  readonly width: number;
}

interface LayerRecord {
  readonly object: THREE.Object3D;
  readonly baseY: number;
  readonly explodedY: number;
}

type FadeMaterial = THREE.MeshStandardMaterial
  | THREE.MeshPhysicalMaterial
  | THREE.MeshBasicMaterial
  | THREE.PointsMaterial;

const BOARD_WIDTH = 12.1;
const BOARD_DEPTH = 5.05;
const UNIT = 0.74;
const KEY_GAP = 0.055;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeInOutCubic(value: number): number {
  const progress = clamp01(value);
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - ((-2 * progress + 2) ** 3) / 2;
}

function createRoundedShape(width: number, depth: number, radius: number): THREE.Shape {
  const x = -width / 2;
  const y = -depth / 2;
  const shape = new THREE.Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + depth - radius);
  shape.quadraticCurveTo(x + width, y + depth, x + width - radius, y + depth);
  shape.lineTo(x + radius, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  return shape;
}

function createKeyPositions(): readonly KeyPosition[] {
  const positions: KeyPosition[] = [];
  EV63_KEY_ROWS.forEach((row, rowIndex) => {
    const totalUnits = row.reduce((total, key) => total + (key.units ?? 1), 0);
    let cursor = -(totalUnits * UNIT) / 2;
    row.forEach((definition) => {
      const units = definition.units ?? 1;
      const slotWidth = units * UNIT;
      positions.push({
        definition,
        x: cursor + slotWidth / 2,
        z: -1.48 + rowIndex * 0.77,
        width: slotWidth - KEY_GAP,
      });
      cursor += slotWidth;
    });
  });
  return positions;
}

function addLayer(
  layers: LayerRecord[],
  keyboard: THREE.Group,
  object: THREE.Object3D,
  baseY: number,
  explodedY: number,
): void {
  object.position.y = baseY;
  keyboard.add(object);
  layers.push({ object, baseY, explodedY });
}

function createCutoutGeometry(keyPositions: readonly KeyPosition[], depth: number): THREE.ExtrudeGeometry {
  const shape = createRoundedShape(BOARD_WIDTH - 0.42, BOARD_DEPTH - 0.48, 0.18);
  keyPositions.forEach(({ x, z }) => {
    const half = 0.27;
    const hole = new THREE.Path();
    hole.moveTo(x - half, z - half);
    hole.lineTo(x + half, z - half);
    hole.lineTo(x + half, z + half);
    hole.lineTo(x - half, z + half);
    hole.closePath();
    shape.holes.push(hole);
  });
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 4 });
  geometry.translate(0, 0, -depth / 2);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function createLabelTexture(label: string): THREE.CanvasTexture | null {
  if (!label) return null;
  const surface = document.createElement("canvas");
  surface.width = 192;
  surface.height = 96;
  const context = surface.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, surface.width, surface.height);
  context.fillStyle = "rgba(245, 244, 248, .92)";
  context.font = `${label.length > 4 ? 600 : 500} ${label.length > 7 ? 17 : label.length > 4 ? 22 : 30}px Inter, Arial, sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(label, surface.width / 2, surface.height / 2);
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createCarbonTexture(): THREE.CanvasTexture {
  const surface = document.createElement("canvas");
  surface.width = 512;
  surface.height = 96;
  const context = surface.getContext("2d");
  if (context) {
    const gradient = context.createLinearGradient(0, 0, 0, surface.height);
    gradient.addColorStop(0, "#17171b");
    gradient.addColorStop(0.5, "#050507");
    gradient.addColorStop(1, "#121216");
    context.fillStyle = gradient;
    context.fillRect(0, 0, surface.width, surface.height);
    let seed = 63;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let index = 0; index < 180; index += 1) {
      const x = random() * surface.width;
      const y = random() * surface.height;
      const width = 4 + random() * 22;
      const alpha = 0.08 + random() * 0.2;
      context.save();
      context.translate(x, y);
      context.rotate((random() - 0.5) * 1.3);
      context.fillStyle = `rgba(${random() > 0.7 ? "170,145,196" : "210,214,222"},${alpha})`;
      context.fillRect(-width / 2, -1.2, width, 2.4);
      context.restore();
    }
  }
  const texture = new THREE.CanvasTexture(surface);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.repeat.set(1.5, 1);
  return texture;
}

function createKeycaps(
  keyPositions: readonly KeyPosition[],
  materials: FadeMaterial[],
  textures: THREE.Texture[],
): THREE.Group {
  const group = new THREE.Group();
  const darkMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x16151a,
    metalness: 0.08,
    roughness: 0.42,
    clearcoat: 0.35,
    clearcoatRoughness: 0.32,
  });
  const accentMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x651b45,
    emissive: 0x200415,
    emissiveIntensity: 0.45,
    metalness: 0.18,
    roughness: 0.3,
    clearcoat: 0.75,
  });
  materials.push(darkMaterial, accentMaterial);

  keyPositions.forEach(({ definition, x, z, width }) => {
    const keycap = new THREE.Mesh(
      new RoundedBoxGeometry(width, 0.31, 0.68, 3, 0.07),
      definition.accent ? accentMaterial : darkMaterial,
    );
    keycap.position.set(x, 0, z);
    keycap.castShadow = true;
    keycap.receiveShadow = true;
    group.add(keycap);

    const texture = createLabelTexture(definition.label);
    if (!texture) return;
    textures.push(texture);
    const labelMaterial = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    });
    materials.push(labelMaterial);
    const label = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(width * 0.74, 0.78), 0.31), labelMaterial);
    label.rotation.x = -Math.PI / 2;
    label.position.set(x, 0.16, z - 0.06);
    group.add(label);
  });
  return group;
}

function createSwitches(keyPositions: readonly KeyPosition[], materials: FadeMaterial[]): THREE.Group {
  const group = new THREE.Group();
  const housingMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xe5e5eb,
    transmission: 0.38,
    transparent: true,
    opacity: 0.86,
    roughness: 0.28,
    metalness: 0,
    thickness: 0.12,
  });
  const stemMaterial = new THREE.MeshStandardMaterial({
    color: 0x7b2d5c,
    emissive: 0x2a061b,
    emissiveIntensity: 0.5,
    roughness: 0.3,
  });
  materials.push(housingMaterial, stemMaterial);
  keyPositions.forEach(({ x, z }) => {
    const housing = new THREE.Mesh(new RoundedBoxGeometry(0.55, 0.3, 0.55, 2, 0.035), housingMaterial);
    housing.position.set(x, 0, z);
    group.add(housing);
    const stem = new THREE.Mesh(new RoundedBoxGeometry(0.2, 0.28, 0.2, 2, 0.025), stemMaterial);
    stem.position.set(x, 0.2, z);
    group.add(stem);
  });
  return group;
}

function createPcb(keyPositions: readonly KeyPosition[], materials: FadeMaterial[]): THREE.Group {
  const group = new THREE.Group();
  const boardMaterial = new THREE.MeshStandardMaterial({ color: 0x101115, metalness: 0.18, roughness: 0.64 });
  const sensorMaterial = new THREE.MeshStandardMaterial({ color: 0x090a0d, metalness: 0.3, roughness: 0.4 });
  const ledMaterial = new THREE.MeshBasicMaterial({ color: 0x7ee8ff, transparent: true, opacity: 0.8, toneMapped: false });
  materials.push(boardMaterial, sensorMaterial, ledMaterial);
  const board = new THREE.Mesh(new RoundedBoxGeometry(BOARD_WIDTH - 0.5, 0.12, BOARD_DEPTH - 0.52, 4, 0.16), boardMaterial);
  board.receiveShadow = true;
  group.add(board);
  keyPositions.forEach(({ x, z }) => {
    const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.055, 0.14), sensorMaterial);
    sensor.position.set(x, 0.085, z);
    group.add(sensor);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.025, 0.055), ledMaterial);
    led.position.set(x, 0.1, z + 0.23);
    group.add(led);
  });
  const controller = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.1, 0.58), sensorMaterial);
  controller.position.set(3.4, 0.12, 1.32);
  group.add(controller);
  return group;
}

function createParticles(materials: FadeMaterial[]): THREE.Points {
  const count = 220;
  const positions = new Float32Array(count * 3);
  let seed = 138;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let index = 0; index < count; index += 1) {
    const offset = index * 3;
    positions[offset] = (random() - 0.5) * 13.5;
    positions[offset + 1] = random() * 3.8;
    positions[offset + 2] = (random() - 0.5) * 6.3;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xb1a3ff,
    size: 0.04,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  materials.push(material);
  return new THREE.Points(geometry, material);
}

export function createEv63Scene(canvas: HTMLCanvasElement, options: Ev63SceneOptions = {}): Ev63SceneController {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.enabled = !reducedMotion && window.innerWidth > 720;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 80);
  camera.position.set(13.2, 9.1, 13.8);
  camera.lookAt(0, 0.8, 0);

  scene.add(new THREE.HemisphereLight(0xe6e9ff, 0x130a21, 1.35));
  const keyLight = new THREE.DirectionalLight(0xffffff, 4.2);
  keyLight.position.set(4, 11, 8);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  scene.add(keyLight);
  const violetLight = new THREE.PointLight(0x8c5cff, 45, 22, 2);
  violetLight.position.set(-7, 4, -4);
  scene.add(violetLight);
  const cyanLight = new THREE.PointLight(0x52d9ff, 28, 18, 2);
  cyanLight.position.set(7, 2, 4);
  scene.add(cyanLight);

  const fadingMaterials: FadeMaterial[] = [];
  const textures: THREE.Texture[] = [];
  const keyPositions = createKeyPositions();
  const keyboard = new THREE.Group();
  keyboard.rotation.set(-0.05, -0.18, -0.025);
  scene.add(keyboard);
  const layers: LayerRecord[] = [];

  const caseMaterial = new THREE.MeshPhysicalMaterial({
    color: 0x15151a,
    metalness: 0.86,
    roughness: 0.23,
    clearcoat: 0.55,
    clearcoatRoughness: 0.18,
  });
  fadingMaterials.push(caseMaterial);
  const bottomCase = new THREE.Group();
  const caseBody = new THREE.Mesh(new RoundedBoxGeometry(BOARD_WIDTH, 0.52, BOARD_DEPTH, 6, 0.2), caseMaterial);
  caseBody.castShadow = true;
  caseBody.receiveShadow = true;
  bottomCase.add(caseBody);
  const upperRail = new THREE.Mesh(new RoundedBoxGeometry(BOARD_WIDTH - 0.2, 0.23, 0.22, 3, 0.06), caseMaterial);
  upperRail.position.set(0, 0.31, -2.34);
  bottomCase.add(upperRail);
  const carbonTexture = createCarbonTexture();
  textures.push(carbonTexture);
  const carbonMaterial = new THREE.MeshPhysicalMaterial({
    map: carbonTexture,
    color: 0xffffff,
    metalness: 0.28,
    roughness: 0.34,
    clearcoat: 0.9,
    clearcoatRoughness: 0.2,
  });
  fadingMaterials.push(carbonMaterial);
  const carbonStrip = new THREE.Mesh(new RoundedBoxGeometry(10.4, 0.31, 0.18, 3, 0.055), carbonMaterial);
  carbonStrip.position.set(0, 0.24, 2.51);
  bottomCase.add(carbonStrip);
  addLayer(layers, keyboard, bottomCase, 0, 0);

  const petBottomMaterial = new THREE.MeshPhysicalMaterial({ color: 0x76707f, transparent: true, opacity: 0.44, roughness: 0.5 });
  const poronBottomMaterial = new THREE.MeshStandardMaterial({ color: 0x222129, roughness: 0.96 });
  const pcbFoamMaterial = new THREE.MeshStandardMaterial({ color: 0x2f2c35, roughness: 0.98 });
  const petSwitchMaterial = new THREE.MeshPhysicalMaterial({ color: 0x9b91aa, transparent: true, opacity: 0.24, roughness: 0.28 });
  const plateMaterial = new THREE.MeshStandardMaterial({ color: 0x777980, metalness: 0.9, roughness: 0.24 });
  fadingMaterials.push(petBottomMaterial, poronBottomMaterial, pcbFoamMaterial, petSwitchMaterial, plateMaterial);

  const petBottom = new THREE.Mesh(new RoundedBoxGeometry(11.45, 0.045, 4.42, 3, 0.12), petBottomMaterial);
  addLayer(layers, keyboard, petBottom, 0.35, 0.58);
  const poronBottom = new THREE.Mesh(new RoundedBoxGeometry(11.5, 0.16, 4.46, 3, 0.12), poronBottomMaterial);
  addLayer(layers, keyboard, poronBottom, 0.43, 0.92);
  const pcb = createPcb(keyPositions, fadingMaterials);
  addLayer(layers, keyboard, pcb, 0.59, 1.34);
  const petSwitch = new THREE.Mesh(createCutoutGeometry(keyPositions, 0.045), petSwitchMaterial);
  addLayer(layers, keyboard, petSwitch, 0.72, 1.78);
  const pcbFoam = new THREE.Mesh(createCutoutGeometry(keyPositions, 0.11), pcbFoamMaterial);
  addLayer(layers, keyboard, pcbFoam, 0.79, 2.15);
  const plate = new THREE.Mesh(createCutoutGeometry(keyPositions, 0.095), plateMaterial);
  plate.castShadow = true;
  addLayer(layers, keyboard, plate, 0.91, 2.6);
  const switches = createSwitches(keyPositions, fadingMaterials);
  addLayer(layers, keyboard, switches, 1.11, 3.25);
  const keycaps = createKeycaps(keyPositions, fadingMaterials, textures);
  addLayer(layers, keyboard, keycaps, 1.53, 4.25);

  const portMaterial = new THREE.MeshStandardMaterial({ color: 0x09090c, metalness: 0.8, roughness: 0.28 });
  const cableMaterial = new THREE.MeshStandardMaterial({
    color: 0x2c2933,
    emissive: 0x10091c,
    emissiveIntensity: 0.6,
    metalness: 0.24,
    roughness: 0.48,
    transparent: true,
  });
  const connectorTipMaterial = new THREE.MeshStandardMaterial({
    color: 0xbabac2,
    emissive: 0x1b122f,
    emissiveIntensity: 0.35,
    metalness: 0.94,
    roughness: 0.18,
    transparent: true,
  });
  fadingMaterials.push(portMaterial);
  const port = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.22, 0.48, 3, 0.06), portMaterial);
  port.position.set(-6.04, 0.45, -1.69);
  keyboard.add(port);

  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(4.8, 5.5, -5.8),
    new THREE.Vector3(4.1, 4.2, -4.2),
    new THREE.Vector3(2.4, 2.35, -2.1),
    new THREE.Vector3(0.35, 1.2, -0.2),
  ]);
  const cable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 72, 0.095, 10, false), cableMaterial);
  cable.castShadow = true;
  scene.add(cable);
  const connector = new THREE.Group();
  const connectorBody = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.33, 0.48, 3, 0.08), cableMaterial);
  connectorBody.rotation.z = Math.PI / 2;
  connector.add(connectorBody);
  const connectorTip = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.18, 0.38, 3, 0.055), connectorTipMaterial);
  connectorTip.position.x = 0.42;
  connector.add(connectorTip);
  connector.position.set(0.35, 1.2, -0.2);
  scene.add(connector);
  const connectorLight = new THREE.PointLight(0xa98bff, 18, 5.5, 2);
  connectorLight.position.set(0.45, 1.2, -0.15);
  scene.add(connectorLight);

  const particles = createParticles(fadingMaterials);
  keyboard.add(particles);
  const scanMaterial = new THREE.MeshBasicMaterial({
    color: 0xc6bdff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
  fadingMaterials.push(scanMaterial);
  const scan = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 6.4), scanMaterial);
  scan.rotation.x = -Math.PI / 2;
  scan.rotation.z = Math.PI / 2;
  scan.position.y = 2.05;
  keyboard.add(scan);

  const grid = new THREE.GridHelper(30, 30, 0x4d4567, 0x24202f);
  grid.position.y = -0.42;
  const gridMaterial = grid.material as THREE.Material & { opacity: number; transparent: boolean };
  gridMaterial.opacity = 0.22;
  gridMaterial.transparent = true;
  scene.add(grid);
  const shadowMaterial = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false });
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(7.8, 64), shadowMaterial);
  shadow.scale.z = 0.38;
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -0.39;
  scene.add(shadow);

  let currentState: Ev63SceneState = "idle";
  let currentPhase: Ev63ScenePhase = "waiting";
  let sequenceStartedAt = 0;
  let sequenceRunning = false;
  let reveal = 0;
  let revealTarget = 0;
  let explode = 0;
  let explodeTarget = 0;
  let connectorProgress = 0;
  let inputPulse = 0;
  let pointerDown = false;
  let pointerX = 0;
  let pointerY = 0;
  let rotationTargetX = keyboard.rotation.x;
  let rotationTargetY = keyboard.rotation.y;
  let frameId = 0;
  let disposed = false;

  const announcePhase = (phase: Ev63ScenePhase) => {
    if (phase === currentPhase) return;
    currentPhase = phase;
    options.onPhaseChange?.(phase);
  };

  const setMaterialReveal = (amount: number) => {
    keyboard.visible = amount > 0.002;
    keyboard.scale.setScalar(0.82 + amount * 0.18);
    fadingMaterials.forEach((material) => {
      const storedOpacity = material.userData.ev63BaseOpacity as number | undefined;
      if (storedOpacity === undefined) material.userData.ev63BaseOpacity = material.opacity;
      material.transparent = true;
      material.opacity = (storedOpacity ?? material.opacity) * amount;
    });
  };

  const resize = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, window.innerWidth < 720 ? 1.35 : 1.8));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  const render = (time: number) => {
    const now = time || performance.now();
    if (sequenceRunning && currentState === "connected") {
      const elapsed = (now - sequenceStartedAt) / 1000;
      connectorProgress = easeInOutCubic(elapsed / 0.8);
      revealTarget = elapsed > 0.34 ? 1 : 0;
      if (elapsed < 0.8) announcePhase("handshake");
      else if (elapsed < 2.35) announcePhase("materialize");
      else if (elapsed < 3.55) announcePhase("inspect");
      else if (elapsed < 6.3) announcePhase("explode");
      else {
        announcePhase("ready");
        sequenceRunning = false;
        explodeTarget = 0;
      }
      if (elapsed >= 3.2 && elapsed < 4.65) explode = easeInOutCubic((elapsed - 3.2) / 1.45);
      else if (elapsed >= 4.65 && elapsed < 5.35) explode = 1;
      else if (elapsed >= 5.35) explode = 1 - easeInOutCubic((elapsed - 5.35) / 0.95);
      scan.position.x = -6.4 + clamp01((elapsed - 0.5) / 1.65) * 12.8;
      scanMaterial.opacity = elapsed > 0.5 && elapsed < 2.25 ? Math.sin(clamp01((elapsed - 0.5) / 1.75) * Math.PI) * 0.8 : 0;
      (particles.material as THREE.PointsMaterial).opacity = elapsed > 0.45 && elapsed < 2.4
        ? Math.sin(clamp01((elapsed - 0.45) / 1.95) * Math.PI) * 0.7
        : 0;
    } else {
      connectorProgress += ((currentState === "connected" ? 1 : 0) - connectorProgress) * 0.08;
      explode += (explodeTarget - explode) * 0.075;
    }

    reveal += (revealTarget - reveal) * (reducedMotion ? 1 : 0.08);
    setMaterialReveal(reveal);
    layers.forEach(({ object, baseY, explodedY }) => {
      object.position.y = THREE.MathUtils.lerp(baseY, explodedY, explode);
    });
    connector.position.x = THREE.MathUtils.lerp(0.35, 0.64, connectorProgress);
    connector.position.y = THREE.MathUtils.lerp(1.2, 1.08, connectorProgress);
    connector.position.z = THREE.MathUtils.lerp(-0.2, -0.16, connectorProgress);
    const cableReveal = 1 - clamp01(reveal * 1.65);
    cableMaterial.opacity = cableReveal;
    connectorTipMaterial.opacity = cableReveal;
    connectorLight.intensity = cableReveal * (14 + Math.sin(now * 0.004) * 4);

    if (!pointerDown && !reducedMotion && currentState === "connected") {
      rotationTargetY += 0.00065;
    }
    keyboard.rotation.x += (rotationTargetX - keyboard.rotation.x) * 0.07;
    keyboard.rotation.y += (rotationTargetY - keyboard.rotation.y) * 0.07;
    keyboard.position.y = reducedMotion ? 0 : Math.sin(now * 0.00075) * 0.06;
    cable.position.y = reducedMotion ? 0 : Math.sin(now * 0.00064) * 0.035;
    particles.rotation.y = now * 0.00012;
    inputPulse *= 0.91;
    cyanLight.intensity = 28 + inputPulse * 90;
    renderer.render(scene, camera);
  };

  const animate = (time: number) => {
    if (disposed) return;
    render(time);
    frameId = window.requestAnimationFrame(animate);
  };

  const handlePointerDown = (event: PointerEvent) => {
    pointerDown = true;
    pointerX = event.clientX;
    pointerY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    canvas.dataset.dragging = "true";
  };
  const handlePointerMove = (event: PointerEvent) => {
    if (!pointerDown) return;
    rotationTargetY += (event.clientX - pointerX) * 0.006;
    rotationTargetX = THREE.MathUtils.clamp(rotationTargetX + (event.clientY - pointerY) * 0.004, -0.42, 0.35);
    pointerX = event.clientX;
    pointerY = event.clientY;
    if (reducedMotion) render(performance.now());
  };
  const handlePointerUp = (event: PointerEvent) => {
    pointerDown = false;
    canvas.releasePointerCapture(event.pointerId);
    delete canvas.dataset.dragging;
  };
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointermove", handlePointerMove);
  canvas.addEventListener("pointerup", handlePointerUp);
  canvas.addEventListener("pointercancel", handlePointerUp);

  setMaterialReveal(0);
  if (!reducedMotion) frameId = window.requestAnimationFrame(animate);
  else render(performance.now());

  return {
    setState(state) {
      currentState = state;
      if (state === "connected") {
        sequenceStartedAt = performance.now();
        sequenceRunning = !reducedMotion;
        revealTarget = 1;
        explodeTarget = 0;
        if (reducedMotion) {
          connectorProgress = 1;
          reveal = 1;
          announcePhase("ready");
        } else {
          announcePhase("handshake");
        }
      } else if (state === "connecting") {
        sequenceRunning = false;
        revealTarget = 0;
        announcePhase("handshake");
      } else {
        sequenceRunning = false;
        revealTarget = 0;
        explodeTarget = 0;
        connectorProgress = 0;
        announcePhase(state === "disconnected" ? "offline" : "waiting");
      }
      if (reducedMotion) render(performance.now());
    },
    setExploded(value) {
      if (currentState !== "connected") return;
      sequenceRunning = false;
      revealTarget = 1;
      explodeTarget = value ? 1 : 0;
      announcePhase(value ? "explode" : "ready");
      if (reducedMotion) {
        explode = explodeTarget;
        render(performance.now());
      }
    },
    pulseInput() {
      inputPulse = 1;
      if (reducedMotion) render(performance.now());
    },
    dispose() {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      canvas.removeEventListener("pointerdown", handlePointerDown);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerup", handlePointerUp);
      canvas.removeEventListener("pointercancel", handlePointerUp);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line) {
          object.geometry.dispose();
        }
      });
      fadingMaterials.forEach((material) => material.dispose());
      cableMaterial.dispose();
      connectorTipMaterial.dispose();
      shadowMaterial.dispose();
      gridMaterial.dispose();
      textures.forEach((texture) => texture.dispose());
      renderer.dispose();
    },
  };
}
