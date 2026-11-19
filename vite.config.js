import { defineConfig } from 'vite';

// CORRECTION vs Gemini's process: Gemini did not set `base`.
// Project Pages serves at https://tritruongarch.github.io/tristan/
// so assets must resolve under /tristan/ — without this, the built
// page 404s on every asset.
export default defineConfig({
  base: '/tristan/',
  build: {
    outDir: 'dist',
  },
});
