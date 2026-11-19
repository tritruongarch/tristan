import * as THREE from 'three';

// Procedural canvas textures — NO binary image files in the repo.
// (GitHub snapshot push accepts UTF-8 text only, so earth/leaf/spark
// textures are drawn at runtime instead of shipped as .jpg/.png.)

// Seeded random so the planet looks the same on every load.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeEarthTexture() {
  const W = 1024;
  const H = 512;
  const cv = document.createElement('canvas');
  cv.width = W;
  cv.height = H;
  const ctx = cv.getContext('2d');
  const rnd = mulberry32(20261119);

  // Ocean: deep blue, lighter toward the equator.
  const ocean = ctx.createLinearGradient(0, 0, 0, H);
  ocean.addColorStop(0, '#0a2470');
  ocean.addColorStop(0.5, '#1550b8');
  ocean.addColorStop(1, '#0a2470');
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, W, H);

  // Continents: clustered green/brown blobs, denser mid-latitudes.
  const landColors = ['#2e6b34', '#4a7a2f', '#8a6b3a', '#3d5a2a', '#6b7a35'];
  for (let c = 0; c < 7; c++) {
    const cx = rnd() * W;
    const cy = H * (0.22 + rnd() * 0.56);
    const blobs = 10 + Math.floor(rnd() * 14);
    for (let i = 0; i < blobs; i++) {
      const x = cx + (rnd() - 0.5) * 260;
      const y = cy + (rnd() - 0.5) * 110;
      const r = 18 + rnd() * 55;
      ctx.fillStyle = landColors[Math.floor(rnd() * landColors.length)];
      ctx.globalAlpha = 0.85;
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * (0.45 + rnd() * 0.4), rnd() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // Clouds: soft white arcs.
  for (let i = 0; i < 90; i++) {
    const x = rnd() * W;
    const y = rnd() * H;
    const r = 14 + rnd() * 46;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.55)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * 0.32, (rnd() - 0.5) * 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Polar caps.
  for (const [y0, y1] of [[0, 42], [H - 42, H]]) {
    const g = ctx.createLinearGradient(0, y0, 0, y1);
    if (y0 === 0) {
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
    } else {
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(1, 'rgba(255,255,255,0.95)');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, Math.min(y0, y1), W, 42);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

export function makeLeafTexture() {
  const S = 128;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, S, S);

  // Stylised maple leaf: 5 pointed lobes fanning from the stem base.
  const cx = S / 2;
  const cy = S * 0.52;
  const grad = ctx.createLinearGradient(cx, 20, cx, S);
  grad.addColorStop(0, '#ff7a1a');
  grad.addColorStop(0.55, '#e8442a');
  grad.addColorStop(1, '#a81e12');
  ctx.fillStyle = grad;

  const lobes = [
    { angle: -Math.PI / 2, len: 46, wid: 0.62 }, // top
    { angle: -Math.PI / 2 - 0.72, len: 40, wid: 0.58 },
    { angle: -Math.PI / 2 + 0.72, len: 40, wid: 0.58 },
    { angle: -Math.PI / 2 - 1.35, len: 30, wid: 0.55 },
    { angle: -Math.PI / 2 + 1.35, len: 30, wid: 0.55 },
  ];
  for (const lobe of lobes) {
    const tipX = cx + Math.cos(lobe.angle) * lobe.len;
    const tipY = cy + Math.sin(lobe.angle) * lobe.len;
    const perp = lobe.angle + Math.PI / 2;
    const w = lobe.len * lobe.wid;
    const bx = cx + Math.cos(perp) * w * 0.5;
    const by = cy + Math.sin(perp) * w * 0.5;
    const bx2 = cx - Math.cos(perp) * w * 0.5;
    const by2 = cy - Math.sin(perp) * w * 0.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo(bx, by, tipX, tipY);
    ctx.quadraticCurveTo(bx2, by2, cx, cy);
    ctx.fill();
  }

  // Stem.
  ctx.strokeStyle = '#7a2d12';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy + 6);
  ctx.quadraticCurveTo(cx + 4, S * 0.8, cx + 2, S - 4);
  ctx.stroke();

  // Centre vein.
  ctx.strokeStyle = 'rgba(255,220,150,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, 26);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function makeSparkTexture() {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = S;
  cv.height = S;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,240,200,0.85)');
  g.addColorStop(0.6, 'rgba(255,200,110,0.28)');
  g.addColorStop(1, 'rgba(255,180,80,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
