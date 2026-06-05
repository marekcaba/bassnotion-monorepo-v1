#!/usr/bin/env node

/**
 * Copy the prebuilt SoundTouch (@soundtouchjs/audio-worklet) processor into
 * public/worklets/ so the browser can fetch it via audioWorklet.addModule().
 *
 * Unlike timing-processor.js (compiled from our own TS), the SoundTouch
 * processor ships prebuilt + self-contained (core inlined, ~73KB) in the
 * package's .dist, so we only copy it — no compilation. SoundTouch is the
 * WSOLA time-stretch engine used on the DRUM stem (LAUNCH-06): WSOLA keeps
 * percussive transients sharp where a phase-vocoder would smear them.
 *
 * Runs as part of `build:workers` (before next build) and via `predev`
 * (before `next dev`) so local PM2 dev has the file too.
 */

const fs = require('fs');
const path = require('path');

const SOURCE_FILE = path.join(
  __dirname,
  '../node_modules/@soundtouchjs/audio-worklet/.dist/soundtouch-processor.js',
);
const OUTPUT_DIR = path.join(__dirname, '../public/worklets');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'soundtouch-processor.js');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

if (!fs.existsSync(SOURCE_FILE)) {
  // Don't fail the build — the drum stem falls back to un-stretched playback
  // if the worklet is missing (the adapter degrades gracefully).
  console.warn(
    `⚠️  SoundTouch processor not found at ${SOURCE_FILE}; drum time-stretch will be disabled. Run pnpm install.`,
  );
  process.exit(0);
}

fs.copyFileSync(SOURCE_FILE, OUTPUT_FILE);
console.log(`✅ Copied SoundTouch processor → ${OUTPUT_FILE}`);
