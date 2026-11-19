import * as THREE from 'three';

// The v7 clip lives on Trí's GitHub as a Release asset (tag `v7`):
// the 28.5 MB mp4 is binary, so it cannot travel through the text-only
// snapshot push — it is uploaded to the Release instead, and the page
// streams it from there. Local dev (npm run dev) uses the copy in public/.
export const RELEASE_VIDEO_URL =
  'https://github.com/tritruongarch/tristan/releases/download/v7/earth-vortex-drone-20s-4k-v7-9x16-60fps.mp4';
export const LOCAL_VIDEO_URL = '/earth-vortex-drone-20s-4k-v7-9x16-60fps.mp4';

export function createVideoMode(scene) {
  const video = document.createElement('video');
  video.src = import.meta.env.DEV ? LOCAL_VIDEO_URL : RELEASE_VIDEO_URL;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;

  // Full-screen 9:16 plane — the clip itself, unaltered (FIDELITY LOCK:
  // video mode plays the exact v7 file, no re-render, no recolour).
  // Plane size = exactly the camera frustum at z=0 (fov 45, camera z=10),
  // plus 1% overscan so no sub-pixel edge shows.
  const dist = 10;
  const h = 2 * Math.tan(THREE.MathUtils.degToRad(22.5)) * dist * 1.01;
  const w = h * (9 / 16);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  mesh.visible = false;
  scene.add(mesh);

  return {
    mesh,
    play() {
      video.play().catch(() => {
        // Autoplay blocked until first tap — the mode button counts as one.
      });
    },
    pause() {
      video.pause();
    },
  };
}
