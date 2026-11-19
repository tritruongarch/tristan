import * as THREE from 'three/webgpu';
import {
  time,
  positionLocal,
  attribute,
  float,
  vec3,
  color,
  sin,
  cos,
  pow,
  dot,
  normalize,
  mix,
} from 'three/tsl';
import { makeEarthTexture, makeLeafTexture, makeSparkTexture } from './textures.js';

// Live WebGPU remake of reel v7 (Gemini Colab process, section 3.3).
// TSL runs the spiral + orbit dust + breathing glow on the GPU;
// leaves and embers update on the CPU (120 sprites / 150 points per
// frame is trivial) because per-particle tumble/rotation is not
// expressible in a single shared TSL material.

const VISIBLE_HALF_H = 4.15; // at camera z=10, fov 45 — half-height of the frame
const VISIBLE_HALF_W = VISIBLE_HALF_H * (9 / 16);

function makeSpiralPoints() {
  const COUNT = 2600;
  const ARMS = 3;
  const pos = new Float32Array(COUNT * 3);
  const rad = new Float32Array(COUNT);
  for (let i = 0; i < COUNT; i++) {
    const arm = i % ARMS;
    const t = Math.pow(Math.random(), 0.6); // denser toward the centre
    const r = 0.7 + 4.6 * t;
    const a = t * 5.2 + (arm * Math.PI * 2) / ARMS + (Math.random() - 0.5) * 0.35;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.sin(a) * r;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.5;
    rad[i] = t;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRadius', new THREE.BufferAttribute(rad, 1));

  const mat = new THREE.PointsNodeMaterial({
    size: 0.055,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  // Rotate the whole spiral around Z on the GPU — ~34 degrees per 20 s,
  // the same slow vortex turn as v6/v7.
  const angle = time.mul(0.16);
  const c = cos(angle);
  const s = sin(angle);
  const p = positionLocal;
  mat.positionNode = vec3(
    p.x.mul(c).sub(p.y.mul(s)),
    p.x.mul(s).add(p.y.mul(c)),
    p.z,
  );
  // Cyan near the centre, gold toward the rim — the v7 palette.
  mat.colorNode = mix(color(0x66e0ff), color(0xffc46b), attribute('aRadius'));

  const points = new THREE.Points(geo, mat);
  points.rotation.x = -0.38; // tilt the disc so it reads as a vortex plane
  return points;
}

function makeOrbitDust() {
  const COUNT = 1200;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = 2.2 + Math.random() * 2.6;
    pos[i * 3] = Math.cos(a) * r;
    pos[i * 3 + 1] = Math.sin(a) * r;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsNodeMaterial({
    size: 0.035,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const angle = time.mul(0.1);
  const c = cos(angle);
  const s = sin(angle);
  const p = positionLocal;
  mat.positionNode = vec3(
    p.x.mul(c).sub(p.y.mul(s)),
    p.x.mul(s).add(p.y.mul(c)),
    p.z,
  );
  mat.colorNode = color(0xffffff);
  const points = new THREE.Points(geo, mat);
  points.rotation.x = 0.41; // 23.5 degrees, Gemini's orbit tilt
  return points;
}

function makeStars() {
  const COUNT = 800;
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const r = 14 + Math.random() * 18;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi) - 6;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.06,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  return new THREE.Points(geo, mat);
}

export function createVortexMode(scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);

  // --- Earth (procedural texture, see textures.js) ---
  const earthTex = makeEarthTexture();
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 64, 48),
    new THREE.MeshBasicNodeMaterial({ map: earthTex }),
  );
  group.add(earth);

  // --- Breathing glow shell (Fresnel rim, TSL) ---
  const glowMat = new THREE.MeshBasicNodeMaterial({
    transparent: true,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const breathe = sin(time.mul(0.63)).mul(0.18).add(1.0); // ~10 s breath
  const facing = dot(normalize(normalView), normalize(positionView.mul(-1)));
  const fres = pow(float(1).sub(facing).clamp(0, 1), float(3));
  glowMat.colorNode = color(0xffb84d).mul(fres).mul(breathe);
  glowMat.opacityNode = fres.mul(0.9);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(1.98, 64, 48), glowMat);
  group.add(glow);

  // --- Cosmic vortex spiral + orbit dust (TSL, GPU) ---
  group.add(makeSpiralPoints());
  group.add(makeOrbitDust());
  const stars = makeStars();
  group.add(stars);

  // --- God rays: 12 translucent wedges radiating from Earth ---
  const raysGroup = new THREE.Group();
  const rayMats = [];
  for (let i = 0; i < 12; i++) {
    const m = new THREE.MeshBasicMaterial({
      color: 0xffd27a,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const ray = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 7), m);
    const a = (i / 12) * Math.PI * 2;
    ray.position.set(Math.cos(a) * 2.9, Math.sin(a) * 2.9, -0.4);
    ray.rotation.z = a + Math.PI / 2;
    raysGroup.add(ray);
    rayMats.push(m);
  }
  group.add(raysGroup);

  // --- Embers rising (CPU, 150 points) ---
  const EMBERS = 150;
  const emberPos = new Float32Array(EMBERS * 3);
  const emberBaseX = new Float32Array(EMBERS);
  const emberSpeed = new Float32Array(EMBERS);
  const emberPhase = new Float32Array(EMBERS);
  for (let i = 0; i < EMBERS; i++) {
    emberBaseX[i] = (Math.random() - 0.5) * 2 * VISIBLE_HALF_W;
    emberPos[i * 3] = emberBaseX[i];
    emberPos[i * 3 + 1] = -VISIBLE_HALF_H + Math.random() * 2 * VISIBLE_HALF_H;
    emberPos[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
    emberSpeed[i] = 0.4 + Math.random() * 0.5;
    emberPhase[i] = Math.random() * Math.PI * 2;
  }
  const emberGeo = new THREE.BufferGeometry();
  emberGeo.setAttribute('position', new THREE.BufferAttribute(emberPos, 3));
  const embers = new THREE.Points(
    emberGeo,
    new THREE.PointsMaterial({
      color: 0xffc46b,
      size: 0.07,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  group.add(embers);

  // --- Maple leaves falling, top-right to bottom-left (CPU sprites) ---
  const leafTex = makeLeafTexture();
  const LEAVES = 120;
  const leaves = [];
  for (let i = 0; i < LEAVES; i++) {
    const mat = new THREE.SpriteMaterial({
      map: leafTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.95,
    });
    const sprite = new THREE.Sprite(mat);
    const scale = 0.28 + Math.random() * 0.22;
    sprite.scale.set(scale, scale, 1);
    const leaf = {
      sprite,
      baseX: -1 + Math.random() * 4.5,
      y: -VISIBLE_HALF_H + Math.random() * 2 * VISIBLE_HALF_H,
      z: (Math.random() - 0.5) * 1.2,
      fall: 0.5 + Math.random() * 0.6,
      swayAmp: 0.3 + Math.random() * 0.35,
      swaySpeed: 0.8 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 2.4,
    };
    leaves.push(leaf);
    group.add(sprite);
  }
  void makeSparkTexture; // spark texture reserved for a future ember sprite pass

  function update(dt, t) {
    // Embers rise, wobble, reset below the frame (invisible pop).
    for (let i = 0; i < EMBERS; i++) {
      let y = emberPos[i * 3 + 1] + emberSpeed[i] * dt;
      if (y > VISIBLE_HALF_H + 0.5) {
        y = -VISIBLE_HALF_H - 0.5;
        emberBaseX[i] = (Math.random() - 0.5) * 2 * VISIBLE_HALF_W;
      }
      emberPos[i * 3 + 1] = y;
      emberPos[i * 3] = emberBaseX[i] + Math.sin(t * 1.5 + emberPhase[i]) * 0.3;
    }
    emberGeo.attributes.position.needsUpdate = true;

    // Leaves fall diagonally, sway and tumble.
    for (const leaf of leaves) {
      leaf.y -= leaf.fall * dt;
      if (leaf.y < -VISIBLE_HALF_H - 0.4) {
        leaf.y = VISIBLE_HALF_H + 0.4;
        leaf.baseX = -1 + Math.random() * 4.5;
      }
      const x = leaf.baseX + Math.sin(t * leaf.swaySpeed + leaf.phase) * leaf.swayAmp - t * 0.12;
      leaf.sprite.position.set(x, leaf.y, leaf.z);
      leaf.sprite.material.rotation += leaf.rotSpeed * dt;
    }

    // God rays breathe and drift slowly around Earth.
    for (let i = 0; i < rayMats.length; i++) {
      rayMats[i].opacity = 0.05 + 0.05 * Math.sin(t * 0.5 + i * 0.9);
    }
    raysGroup.rotation.z += dt * 0.02;

    // Starfield twinkle.
    stars.material.opacity = 0.65 + 0.2 * Math.sin(t * 1.3);
  }

  return { group, update };
}
