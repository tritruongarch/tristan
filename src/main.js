import './style.css';
import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { createVideoMode } from './videoV7Player.js';
import { createVortexMode } from './vortexWebGPU.js';

const canvas = document.querySelector('#webgpu-canvas');
const notice = document.querySelector('#notice');
const fpsEl = document.querySelector('#fps');
const btnVideo = document.querySelector('#btn-video');
const btnWebgpu = document.querySelector('#btn-webgpu');
const btnRecord = document.querySelector('#btn-record');

let renderer;
let scene;
let camera;
let videoMode;
let vortexMode;
let clock;
let mode = 'video';
let webgpuOK = false;

let recorder = null;
let recordChunks = [];

async function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  camera = new THREE.PerspectiveCamera(45, 9 / 16, 0.1, 100);
  camera.position.set(0, 0, 10);

  // Gemini's process step 4.2 asks for a WebGPU capability check.
  // Correction: instead of an alert() that blocks the page, we fall back
  // to a plain WebGL renderer so Video mode still works, and the WebGPU
  // button is disabled with a plain-language notice.
  try {
    if (!navigator.gpu) throw new Error('navigator.gpu is undefined');
    renderer = new WebGPURenderer({ canvas, antialias: true });
    await renderer.init();
    webgpuOK = true;
  } catch (err) {
    webgpuOK = false;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  videoMode = createVideoMode(scene);
  vortexMode = webgpuOK ? createVortexMode(scene) : null;

  if (!webgpuOK) {
    notice.textContent =
      'Trình duyệt này chưa hỗ trợ WebGPU nên chỉ phát được Video v7. ' +
      'Mở trang bằng Chrome hoặc Edge mới nhất trên máy có GPU để xem chế độ WebGPU Live.';
    notice.style.display = 'block';
    btnWebgpu.disabled = true;
  }

  btnVideo.addEventListener('click', () => setMode('video'));
  btnWebgpu.addEventListener('click', () => setMode('webgpu'));
  btnRecord.addEventListener('click', toggleRecord);
  window.addEventListener('resize', onResize);

  setMode('video');
  onResize();
  clock = new THREE.Clock();
  renderer.setAnimationLoop(tick);
}

function setMode(next) {
  mode = next;
  const isVideo = next === 'video';
  videoMode.mesh.visible = isVideo;
  if (vortexMode) vortexMode.group.visible = !isVideo;
  if (isVideo) {
    videoMode.play();
  } else {
    videoMode.pause();
  }
  btnVideo.classList.toggle('active', isVideo);
  btnWebgpu.classList.toggle('active', !isVideo);
  if (isVideo) camera.position.z = 10;
}

let fpsFrames = 0;
let fpsTime = 0;

function tick() {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (mode === 'webgpu' && vortexMode) {
    // Slow push-in, 20 s loop, eased like v7: fast opening, slow cruise.
    // (Gemini's draft `z -= 0.003 * deltaTime` moves only ~0.06 in 20 s —
    // corrected here to a real 10 -> 7.8 push-in over the 20 s loop.)
    const cycle = t % 20;
    const eased = 1 - Math.pow(1 - cycle / 20, 2);
    camera.position.z = 10 - 2.2 * eased;
    vortexMode.update(dt, t);
  } else {
    camera.position.z = 10;
  }

  renderer.render(scene, camera);

  fpsFrames += 1;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    fpsEl.textContent = `${Math.round(fpsFrames / fpsTime)} fps · ${mode === 'webgpu' ? 'WebGPU Live' : 'Video v7'}`;
    fpsFrames = 0;
    fpsTime = 0;
  }
}

function onResize() {
  const w = canvas.clientWidth || 1;
  const h = canvas.clientHeight || 1;
  renderer.setSize(w, h, false);
  camera.aspect = 9 / 16;
  camera.updateProjectionMatrix();
}

function toggleRecord() {
  if (recorder) return; // already recording — the 20 s timer stops it
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m));
  if (!mimeType) {
    notice.textContent = 'Trình duyệt này không ghi được video từ canvas (MediaRecorder không hỗ trợ).';
    notice.style.display = 'block';
    return;
  }
  const stream = canvas.captureStream(60);
  recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 20_000_000 });
  recordChunks = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size) recordChunks.push(e.data);
  };
  recorder.onstop = () => {
    const blob = new Blob(recordChunks, { type: 'video/webm' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `earth-vortex-webgpu-20s-${mode}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
    recorder = null;
    btnRecord.textContent = '● Ghi 20s';
    notice.textContent = 'Đã tải file WebM 20 giây. Đổi sang MP4: ffmpeg -i file.webm -c:v libx264 -crf 16 file.mp4';
    notice.style.display = 'block';
  };
  recorder.start();
  btnRecord.textContent = '● Đang ghi… 20s';
  setTimeout(() => {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, 20_000);
}

init();
