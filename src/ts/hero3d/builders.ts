/**
 * Procedural geometry for the Jemawe Digital Ecosystem.
 * Shapes are deliberately simple (low segment counts, shared materials, a few
 * InstancedMeshes) to keep draw calls and memory low.
 */
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  CylinderGeometry,
  ExtrudeGeometry,
  Float32BufferAttribute,
  Group,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  Shape,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Texture,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import * as T from "./textures";

export type ServiceId = "digital" | "it" | "hardware";

export interface FrameContext {
  dt: number;
  t: number;
  pointerX: number; // -1..1, smoothed
  pointerY: number;
  motion: boolean; // false under prefers-reduced-motion
}

export interface ServiceModule {
  id: ServiceId;
  group: Group; // placed in the scene
  inner: Group; // receives hover scale / idle float
  basePos: Vector3;
  baseRot: Vector3;
  enterFrom: Vector3;
  labelAnchor: Object3D;
  /** Which side of its anchor the DOM label sits on, so labels never cover the core. */
  labelSide: "above" | "left" | "right";
  scale: number;
  glow: Sprite;
  hover: number;
  phase: number;
  update(ctx: FrameContext): void;
}

export interface Palette {
  metal: MeshStandardMaterial;
  darkMetal: MeshStandardMaterial;
  aluminum: MeshStandardMaterial;
  glass: MeshStandardMaterial;
  accent: MeshStandardMaterial;
  glowTex: Texture;
}

const damp = (current: number, target: number, rate: number, dt: number) => current + (target - current) * (1 - Math.exp(-rate * dt));

export function createPalette(): Palette {
  return {
    metal: new MeshStandardMaterial({ color: 0x1b2b4f, metalness: 0.75, roughness: 0.32 }),
    darkMetal: new MeshStandardMaterial({ color: 0x0f1a33, metalness: 0.65, roughness: 0.4 }),
    aluminum: new MeshStandardMaterial({ color: 0x9db0d4, metalness: 0.88, roughness: 0.3 }),
    // Glass look from environment reflections on a transparent standard material
    // (avoids the extra, slower-to-compile physical shader).
    glass: new MeshStandardMaterial({ color: 0xa9c4ff, metalness: 0.15, roughness: 0.05, envMapIntensity: 1.6, transparent: true, opacity: 0.3, depthWrite: false }),
    accent: new MeshStandardMaterial({ color: 0x2563eb, metalness: 0.4, roughness: 0.3, emissive: new Color(0x1d4ed8), emissiveIntensity: 0.6 }),
    glowTex: T.glowTexture(),
  };
}

function glowSprite(p: Palette, color: number, scale: number, opacity: number): Sprite {
  const s = new Sprite(new SpriteMaterial({ map: p.glowTex, color, transparent: true, opacity, blending: AdditiveBlending, depthWrite: false }));
  s.scale.setScalar(scale);
  return s;
}

function roundedRect(w: number, h: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Reflections without HDR files: a tiny generated studio, prefiltered once. */
export function createEnvironment(renderer: WebGLRenderer): Texture {
  const env = new Scene();
  const room = new Mesh(new BoxGeometry(20, 20, 20), new MeshBasicMaterial({ color: 0x0a1631, side: BackSide }));
  env.add(room);
  const panel = (color: number, w: number, h: number, pos: [number, number, number], rotY = 0, rotX = 0) => {
    const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color }));
    m.position.set(...pos);
    m.rotation.set(rotX, rotY, 0);
    env.add(m);
  };
  panel(0xffffff, 10, 3, [0, 9.5, 0], 0, Math.PI / 2);
  panel(0x6f9cff, 4, 12, [-9.5, 0, 0], Math.PI / 2);
  panel(0x7dd3fc, 3, 8, [9.5, 2, -2], -Math.PI / 2);
  panel(0x2563eb, 14, 2, [0, -3, -9.5]);
  const pmrem = new PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  env.traverse((o) => {
    const m = o as Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) (m.material as Material).dispose();
  });
  return tex;
}

/* ------------------------------------------------------------------ core */
export function buildCore(p: Palette): { group: Group; rings: Group; update: (ctx: FrameContext) => void } {
  const group = new Group();
  const tileMat = new MeshStandardMaterial({ color: 0x2563eb, metalness: 0.5, roughness: 0.16, envMapIntensity: 1.3, emissive: new Color(0x0b2a7a), emissiveIntensity: 0.55 });
  const tileGeo = new ExtrudeGeometry(roundedRect(1.1, 1.1, 0.26), { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3, curveSegments: 8 });
  tileGeo.center();
  const tile = new Mesh(tileGeo, tileMat);
  group.add(tile);

  const white = new MeshStandardMaterial({ color: 0xffffff, emissive: new Color(0xffffff), emissiveIntensity: 0.75, roughness: 0.35 });
  const jCurve = new CatmullRomCurve3([
    new Vector3(0.14, 0.34, 0.16), new Vector3(0.14, 0.06, 0.16), new Vector3(0.12, -0.13, 0.16),
    new Vector3(0.0, -0.25, 0.16), new Vector3(-0.16, -0.27, 0.16), new Vector3(-0.27, -0.18, 0.16),
  ]);
  group.add(new Mesh(new TubeGeometry(jCurve, 40, 0.055, 10), white));
  const nodeGeo = new SphereGeometry(0.085, 18, 12);
  const ringGeo = new TorusGeometry(0.085, 0.02, 8, 24);
  const navy = new MeshStandardMaterial({ color: 0x071226, roughness: 0.4 });
  for (const v of [new Vector3(0.14, 0.36, 0.17), new Vector3(-0.28, -0.17, 0.17)]) {
    const n = new Mesh(nodeGeo, navy);
    n.position.copy(v);
    const r = new Mesh(ringGeo, white);
    r.position.copy(v).add(new Vector3(0, 0, 0.03));
    group.add(n, r);
  }

  const rings = new Group();
  const outer = new Mesh(new TorusGeometry(1.0, 0.028, 12, 96), p.glass);
  const inner = new Mesh(new TorusGeometry(0.86, 0.012, 8, 96), new MeshBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 0.55 }));
  inner.rotation.x = Math.PI / 2.4;
  outer.rotation.y = Math.PI / 5;
  rings.add(outer, inner);
  group.add(rings);

  const halo = glowSprite(p, 0x3b82f6, 3.4, 0.5);
  halo.position.z = -0.4;
  group.add(halo);

  return {
    group,
    rings,
    update(ctx) {
      if (!ctx.motion) return;
      group.rotation.y = Math.sin(ctx.t * 0.35) * 0.28 + ctx.pointerX * 0.25;
      group.rotation.x = Math.sin(ctx.t * 0.27) * 0.08 - ctx.pointerY * 0.12;
      outer.rotation.x += ctx.dt * 0.25;
      inner.rotation.z += ctx.dt * 0.4;
      group.position.y = 0.05 + Math.sin(ctx.t * 0.8) * 0.05;
      (halo.material as SpriteMaterial).opacity = 0.42 + Math.sin(ctx.t * 1.2) * 0.08;
    },
  };
}

function makeModule(id: ServiceId, basePos: Vector3, baseRot: Vector3, enterFrom: Vector3, phase: number): Omit<ServiceModule, "glow" | "update" | "labelSide" | "scale"> {
  const group = new Group();
  const inner = new Group();
  group.add(inner);
  group.position.copy(basePos);
  group.rotation.set(baseRot.x, baseRot.y, baseRot.z);
  const labelAnchor = new Object3D();
  inner.add(labelAnchor);
  return { id, group, inner, basePos, baseRot, enterFrom, labelAnchor, hover: 0, phase };
}

/* --------------------------------------------- A: digital solutions laptop */
export function buildDigital(p: Palette, lite: boolean): ServiceModule {
  const m = makeModule("digital", new Vector3(-2.45, 0.8, 0), new Vector3(0.22, 0.5, 0), new Vector3(-1.4, 0.4, -1.2), 0.3);
  const laptop = new Group();
  m.inner.add(laptop);

  const base = new Mesh(new BoxGeometry(1.9, 0.07, 1.3), p.aluminum);
  laptop.add(base);
  const deck = new Mesh(new PlaneGeometry(1.62, 0.62), new MeshBasicMaterial({ map: T.keyboardTexture() }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.set(0, 0.036, -0.2);
  const pad = new Mesh(new PlaneGeometry(0.52, 0.3), new MeshStandardMaterial({ color: 0x8396bd, metalness: 0.6, roughness: 0.25 }));
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(0, 0.037, 0.36);
  laptop.add(deck, pad);

  const hinge = new Group();
  hinge.position.set(0, 0.035, -0.64);
  hinge.rotation.x = -0.22;
  const lid = new Mesh(new BoxGeometry(1.9, 1.24, 0.045), p.aluminum);
  lid.position.y = 0.62;
  const screenMat = new MeshBasicMaterial({ map: T.websiteTexture(), color: new Color(0.74, 0.74, 0.78) });
  const screen = new Mesh(new PlaneGeometry(1.78, 1.12), screenMat);
  screen.position.set(0, 0.62, 0.024);
  hinge.add(lid, screen);
  laptop.add(hinge);

  const glow = glowSprite(p, 0x3b82f6, 2.6, 0.18);
  glow.position.set(0, 0.7, -0.5);
  m.inner.add(glow);

  const cards: Mesh[] = [];
  if (!lite) {
    for (let i = 0; i < 2; i++) {
      const card = new Mesh(new PlaneGeometry(0.56, 0.37), new MeshBasicMaterial({ map: T.cardTexture(i), transparent: true, opacity: 0.92, depthWrite: false }));
      card.position.set(i === 0 ? -1.15 : 1.08, i === 0 ? 1.15 : 0.55, 0.15);
      card.rotation.y = i === 0 ? 0.25 : -0.2;
      cards.push(card);
      m.inner.add(card);
    }
  }

  m.labelAnchor.position.set(0, 1.55, 0);
  const baseYaw = m.baseRot.y;
  return {
    ...m,
    labelSide: "above",
    scale: 1,
    glow,
    update(ctx) {
      const h = this.hover;
      const lift = 0.74 + h * 0.26;
      screenMat.color.setRGB(lift, lift, Math.min(1, lift + 0.04));
      (glow.material as SpriteMaterial).opacity = 0.18 + h * 0.45;
      if (ctx.motion) {
        this.group.rotation.y = baseYaw + ctx.pointerX * (0.12 + h * 0.18);
        this.group.rotation.x = this.baseRot.x - ctx.pointerY * 0.08;
        cards.forEach((c, i) => (c.position.y += Math.sin(ctx.t * 0.9 + i * 2) * 0.0009));
      }
    },
  };
}

/* ------------------------------------------- B: IT services workstation */
export function buildIt(p: Palette, lite: boolean): ServiceModule {
  const m = makeModule("it", new Vector3(2.45, 0.8, 0), new Vector3(0.12, -0.5, 0), new Vector3(1.4, 0.4, -1.2), 1.7);
  const bezel = new Mesh(new BoxGeometry(1.76, 1.08, 0.07), p.darkMetal);
  const screenMat = new MeshBasicMaterial({ map: T.remoteTexture(), color: new Color(0.74, 0.74, 0.78) });
  const screen = new Mesh(new PlaneGeometry(1.66, 0.98), screenMat);
  screen.position.z = 0.036;
  const neck = new Mesh(new BoxGeometry(0.1, 0.5, 0.08), p.metal);
  neck.position.set(0, -0.72, -0.08);
  const foot = new Mesh(new CylinderGeometry(0.42, 0.46, 0.04, 32), p.metal);
  foot.position.set(0, -0.98, -0.05);
  m.inner.add(bezel, screen, neck, foot);

  // Network: hub at the top of the monitor, nodes around it.
  const hub = new Vector3(0, 0.56, 0);
  const nodes = (lite
    ? [[-0.8, 1.2, -0.3], [0.45, 1.4, -0.45], [1.3, 0.75, -0.25], [1.2, -0.55, -0.3]]
    : [[-0.95, 1.15, -0.3], [0.1, 1.45, -0.5], [1.1, 1.15, -0.25], [1.45, 0.25, -0.45], [1.2, -0.7, -0.3], [-0.2, -1.3, -0.4]]
  ).map(([x, y, z]) => new Vector3(x, y, z));
  const edges: [Vector3, Vector3][] = [];
  nodes.forEach((n, i) => {
    edges.push([hub, n]);
    if (i > 0) edges.push([nodes[i - 1], n]);
  });
  const pts: number[] = [];
  edges.forEach(([a, b]) => pts.push(a.x, a.y, a.z, b.x, b.y, b.z));
  const lineGeo = new BufferGeometry();
  lineGeo.setAttribute("position", new Float32BufferAttribute(pts, 3));
  const lineMat = new LineBasicMaterial({ color: 0x93b4fd, transparent: true, opacity: 0.3, depthWrite: false });
  m.inner.add(new LineSegments(lineGeo, lineMat));

  const nodeMat = new MeshBasicMaterial({ color: 0x60a5fa });
  const nodeMesh = new InstancedMesh(new IcosahedronGeometry(0.07, 1), nodeMat, nodes.length);
  const tmp = new Object3D();
  nodes.forEach((n, i) => {
    tmp.position.copy(n);
    tmp.updateMatrix();
    nodeMesh.setMatrixAt(i, tmp.matrix);
  });
  m.inner.add(nodeMesh);

  const pulseMesh = new InstancedMesh(new SphereGeometry(0.035, 10, 8), new MeshBasicMaterial({ color: 0xcfeaff }), edges.length);
  const progress = edges.map((_, i) => (i * 0.37) % 1);
  m.inner.add(pulseMesh);

  const glow = glowSprite(p, 0x60a5fa, 2.4, 0.16);
  glow.position.set(0, 0.1, -0.5);
  m.inner.add(glow);
  m.labelAnchor.position.set(0, 1.45, 0);

  const placePulses = () => {
    edges.forEach(([a, b], i) => {
      tmp.position.lerpVectors(a, b, progress[i]);
      const s = Math.sin(progress[i] * Math.PI);
      tmp.scale.setScalar(0.4 + s * 0.8);
      tmp.updateMatrix();
      pulseMesh.setMatrixAt(i, tmp.matrix);
    });
    pulseMesh.instanceMatrix.needsUpdate = true;
  };
  placePulses();

  const baseYaw = m.baseRot.y;
  return {
    ...m,
    labelSide: "above",
    scale: 1,
    glow,
    update(ctx) {
      const h = this.hover;
      const lift = 0.74 + h * 0.26;
      screenMat.color.setRGB(lift, lift, Math.min(1, lift + 0.04));
      lineMat.opacity = 0.28 + h * 0.5;
      (glow.material as SpriteMaterial).opacity = 0.16 + h * 0.4;
      if (ctx.motion) {
        const speed = 0.32 + h * 0.75;
        for (let i = 0; i < progress.length; i++) progress[i] = (progress[i] + ctx.dt * speed * (0.8 + (i % 3) * 0.15)) % 1;
        placePulses();
        this.group.rotation.y = baseYaw + ctx.pointerX * (0.12 + h * 0.18);
        this.group.rotation.x = this.baseRot.x - ctx.pointerY * 0.08;
      }
    },
  };
}

/* ------------------------------------- C: hardware, exploded computer view */
export function buildHardware(p: Palette, lite: boolean): ServiceModule {
  const m = makeModule("hardware", new Vector3(0, -1.85, 0.35), new Vector3(0.62, 0.32, 0), new Vector3(0, -1.2, -1.2), 3.1);

  const pcbTex = T.pcbTexture();
  const pcbTop = new MeshStandardMaterial({ map: pcbTex, metalness: 0.3, roughness: 0.55 });
  const board = new Mesh(new BoxGeometry(2.1, 0.05, 1.45), [p.darkMetal, p.darkMetal, pcbTop, p.darkMetal, p.darkMetal, p.darkMetal]);
  m.inner.add(board);

  const highlight = new MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.5, roughness: 0.35, emissive: new Color(0x3b82f6), emissiveIntensity: 0 });
  const ramFace = new MeshStandardMaterial({ map: T.chipTexture(4), metalness: 0.3, roughness: 0.5, emissive: new Color(0x3b82f6), emissiveIntensity: 0 });
  const ssdTop = new MeshStandardMaterial({ map: T.chipTexture(3, 256, 96), metalness: 0.3, roughness: 0.5, emissive: new Color(0x3b82f6), emissiveIntensity: 0 });

  type Part = { obj: Object3D; base: Vector3; dir: Vector3; dist: number };
  const parts: Part[] = [];
  const addPart = (obj: Object3D, base: [number, number, number], dir: [number, number, number], dist: number) => {
    obj.position.set(...base);
    m.inner.add(obj);
    parts.push({ obj, base: new Vector3(...base), dir: new Vector3(...dir).normalize(), dist });
  };

  // CPU cooler: heatsink fins + fan
  const cooler = new Group();
  const plate = new Mesh(new BoxGeometry(0.5, 0.04, 0.5), p.aluminum);
  const finCount = lite ? 6 : 9;
  const fins = new InstancedMesh(new BoxGeometry(0.03, 0.3, 0.48), p.aluminum, finCount);
  const tmp = new Object3D();
  for (let i = 0; i < finCount; i++) {
    tmp.position.set(-0.22 + (i * 0.44) / (finCount - 1), 0.17, 0);
    tmp.updateMatrix();
    fins.setMatrixAt(i, tmp.matrix);
  }
  const fan = new Group();
  fan.position.set(0, 0.17, 0.27);
  const ring = new Mesh(new TorusGeometry(0.19, 0.022, 8, 32), p.metal);
  const hubMesh = new Mesh(new CylinderGeometry(0.06, 0.06, 0.04, 16), p.darkMetal);
  hubMesh.rotation.x = Math.PI / 2;
  const blades = new InstancedMesh(new BoxGeometry(0.06, 0.15, 0.01), new MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.2, roughness: 0.4, transparent: true, opacity: 0.85 }), 7);
  for (let i = 0; i < 7; i++) {
    tmp.position.set(Math.cos((i / 7) * Math.PI * 2) * 0.1, Math.sin((i / 7) * Math.PI * 2) * 0.1, 0);
    tmp.rotation.set(0, 0.35, (i / 7) * Math.PI * 2 + Math.PI / 2);
    tmp.updateMatrix();
    blades.setMatrixAt(i, tmp.matrix);
  }
  tmp.rotation.set(0, 0, 0);
  fan.add(ring, hubMesh, blades);
  cooler.add(plate, fins, fan);
  addPart(cooler, [-0.42, 0.045, -0.05], [-0.15, 1, 0], 0.55);

  // RAM: two sticks standing in their slots
  for (let i = 0; i < 2; i++) {
    const stick = new Mesh(new BoxGeometry(0.025, 0.22, 0.92), [ramFace, ramFace, highlight, highlight, highlight, highlight]);
    addPart(stick, [0.26 + i * 0.1, 0.135, -0.1], [0.75, 1, 0.2], 0.42 + i * 0.1);
  }

  // M.2 SSD
  const ssd = new Mesh(new BoxGeometry(0.56, 0.02, 0.17), [highlight, highlight, ssdTop, highlight, highlight, highlight]);
  addPart(ssd, [0.05, 0.04, 0.5], [0, 1, 0.55], 0.6);

  // Power supply
  const grille = new MeshStandardMaterial({ map: T.grilleTexture(), metalness: 0.6, roughness: 0.4 });
  const psu = new Mesh(new BoxGeometry(0.62, 0.36, 0.52), [p.metal, p.metal, grille, p.metal, p.metal, p.metal]);
  addPart(psu, [1.42, 0.2, 0.25], [1, 0.45, 0], 0.5);

  const glow = glowSprite(p, 0x3b82f6, 2.6, 0.14);
  glow.position.set(0, 0.3, -0.3);
  m.inner.add(glow);
  m.labelAnchor.position.set(-1.15, 0.2, 0.2);

  let explode = 0.22;
  const glowParts = [ramFace, ssdTop, highlight];
  return {
    ...m,
    labelSide: "left",
    scale: 1.2,
    glow,
    update(ctx) {
      const h = this.hover;
      explode = ctx.motion ? damp(explode, 0.22 + h * 0.78, 6, ctx.dt) : 0.22 + h * 0.78;
      for (const part of parts) part.obj.position.copy(part.base).addScaledVector(part.dir, part.dist * explode);
      glowParts.forEach((mat) => (mat.emissiveIntensity = h * 0.85));
      (glow.material as SpriteMaterial).opacity = 0.14 + h * 0.4;
      if (ctx.motion) {
        fan.rotation.z += ctx.dt * (1.2 + h * 5);
        this.group.rotation.y = this.baseRot.y + ctx.pointerX * 0.15;
      }
    },
  };
}

/* ------------------------------------------- ambient geometry and floor */
export function buildAmbient(p: Palette, lite: boolean): { group: Group; update: (ctx: FrameContext) => void } {
  const group = new Group();
  const ringMat = new LineBasicMaterial({ color: 0x93b4fd, transparent: true, opacity: 0.16, depthWrite: false });
  for (const r of [2.2, 3.4]) {
    const pts: number[] = [];
    for (let i = 0; i < 96; i++) {
      const a = (i / 96) * Math.PI * 2;
      pts.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pts, 3));
    const loop = new LineLoop(g, ringMat);
    loop.position.y = -0.9;
    loop.rotation.x = 0.42;
    group.add(loop);
  }

  let floaters: InstancedMesh | null = null;
  const seeds: { pos: Vector3; spin: Vector3; phase: number; s: number }[] = [];
  if (!lite) {
    const count = 10;
    floaters = new InstancedMesh(new OctahedronGeometry(0.09, 0), p.accent, count);
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + 0.4;
      const r = 3.4 + (i % 3) * 0.45;
      seeds.push({ pos: new Vector3(Math.cos(a) * r, Math.sin(a) * 2.1 - 0.2, -1.2 - (i % 4) * 0.35), spin: new Vector3(0.3 + (i % 3) * 0.1, 0.5, 0.2), phase: i, s: 0.6 + (i % 4) * 0.2 });
    }
    group.add(floaters);
  }
  const tmp = new Object3D();
  const place = (t: number) => {
    if (!floaters) return;
    seeds.forEach((sd, i) => {
      tmp.position.set(sd.pos.x, sd.pos.y + Math.sin(t * 0.5 + sd.phase) * 0.12, sd.pos.z);
      tmp.rotation.set(t * sd.spin.x, t * sd.spin.y, t * sd.spin.z);
      tmp.scale.setScalar(sd.s);
      tmp.updateMatrix();
      floaters!.setMatrixAt(i, tmp.matrix);
    });
    floaters.instanceMatrix.needsUpdate = true;
  };
  place(0);
  return {
    group,
    update(ctx) {
      if (ctx.motion) place(ctx.t);
    },
  };
}
