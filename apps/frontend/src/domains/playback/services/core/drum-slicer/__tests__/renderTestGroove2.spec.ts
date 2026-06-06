/**
 * OFFLINE A/B HARNESS — run the REAL DrumBeatsPlayer render on the ACTUAL test-groove-2
 * drum stem (Drums.ogg, decoded to test-groove-2-drums.wav) at 89/109, and write:
 *   - docs/dev-tools/audio-audit/ours-tg2-89.wav   (our engine's output)
 *   - docs/dev-tools/audio-audit/ours-tg2-89.behavior.json (what the engine did per slice)
 *
 * This is NOT a pass/fail test — it's a render tool that runs under the working TS/vitest
 * toolchain (the engine is TS-ESM). Run with:
 *   AUDIT_RENDER=1 npx vitest run .../renderTestGroove2.spec.ts
 * It no-ops unless AUDIT_RENDER=1 and the decoded stem file exists, so normal test runs
 * skip it. Compare ours-tg2-89.wav to the Ableton render of the SAME stem (ableton-89.wav).
 */
import { describe, it } from 'vitest';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DrumBeatsPlayer } from '../DrumBeatsPlayer.js';

const REPO = resolve(__dirname, '../../../../../../../../..');
const AUDIT = resolve(REPO, 'docs/dev-tools/audio-audit');
const STEM_WAV = resolve(AUDIT, 'test-groove-2-drums.wav');
const OUT_WAV = resolve(AUDIT, 'ours-tg2-89.wav');
const OUT_JSON = resolve(AUDIT, 'ours-tg2-89.behavior.json');

// 8 bars @ 109 BPM = the file length; the stem IS one full loop.
const ORIGINAL_BPM = 109;
const TARGET_BPM = 89;

/** Parse a float32 / int16 PCM WAV into per-channel Float32Arrays. */
function parseWavMultich(buf: Buffer): { sr: number; channels: Float32Array[] } {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let off = 12;
  let fmt = 1;
  let ch = 1;
  let sr = 48000;
  let bits = 16;
  let dataOff = -1;
  let dataLen = 0;
  while (off + 8 <= buf.length) {
    const id = String.fromCharCode(buf[off]!, buf[off + 1]!, buf[off + 2]!, buf[off + 3]!);
    const sz = dv.getUint32(off + 4, true);
    if (id === 'fmt ') {
      fmt = dv.getUint16(off + 8, true);
      ch = dv.getUint16(off + 10, true);
      sr = dv.getUint32(off + 12, true);
      bits = dv.getUint16(off + 22, true);
    } else if (id === 'data') {
      dataOff = off + 8;
      dataLen = sz;
    }
    off += 8 + sz + (sz & 1);
  }
  const bytesPer = bits / 8;
  const frames = Math.floor(dataLen / (bytesPer * ch));
  const out: Float32Array[] = [];
  for (let c = 0; c < ch; c++) out.push(new Float32Array(frames));
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      const p = dataOff + (i * ch + c) * bytesPer;
      out[c]![i] =
        fmt === 3 ? dv.getFloat32(p, true) : dv.getInt16(p, true) / 32768;
    }
  }
  return { sr, channels: out };
}

function writeWavFloat(path: string, channels: Float32Array[], sr: number): void {
  const ch = channels.length;
  const frames = channels[0]!.length;
  const buf = Buffer.alloc(44 + frames * ch * 4);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + frames * ch * 4, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(3, 20); // float
  buf.writeUInt16LE(ch, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * ch * 4, 28);
  buf.writeUInt16LE(ch * 4, 32);
  buf.writeUInt16LE(32, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(frames * ch * 4, 40);
  let o = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < ch; c++) {
      buf.writeFloatLE(channels[c]![i]!, o);
      o += 4;
    }
  }
  writeFileSync(path, buf);
}

function makeBuffer(channels: Float32Array[], sr: number): AudioBuffer {
  return {
    numberOfChannels: channels.length,
    length: channels[0]!.length,
    sampleRate: sr,
    duration: channels[0]!.length / sr,
    getChannelData: (c: number) => channels[c]!,
    copyToChannel: (src: Float32Array, c: number) => channels[c]!.set(src.subarray(0, channels[c]!.length)),
  } as unknown as AudioBuffer;
}

function makeCtx(sr: number): AudioContext {
  return {
    currentTime: 0,
    sampleRate: sr,
    createBuffer: (numCh: number, len: number, rate: number) => {
      const chans: Float32Array[] = [];
      for (let c = 0; c < numCh; c++) chans.push(new Float32Array(len));
      return makeBuffer(chans, rate);
    },
  } as unknown as AudioContext;
}

describe('render test-groove-2 @ 89 BPM (offline A/B)', () => {
  it('renders our engine output + behavior JSON', () => {
    if (process.env.AUDIT_RENDER !== '1' || !existsSync(STEM_WAV)) {
      return; // opt-in render only
    }
    const { sr, channels } = parseWavMultich(readFileSync(STEM_WAV));
    const loopDur = channels[0]!.length / sr; // the file is one 8-bar loop
    const player = new DrumBeatsPlayer(makeCtx(sr), makeBuffer(channels, sr), {} as AudioNode, {
      loopDurationSeconds: loopDur,
    });
    const p = player as unknown as {
      renderLoopBuffer: (r: number) => AudioBuffer;
      getEngineBehavior: (r: number) => unknown;
    };
    const ratio = TARGET_BPM / ORIGINAL_BPM;
    const out = p.renderLoopBuffer(ratio);
    const outCh: Float32Array[] = [];
    for (let c = 0; c < out.numberOfChannels; c++) outCh.push(out.getChannelData(c));
    writeWavFloat(OUT_WAV, outCh, sr);
    writeFileSync(OUT_JSON, JSON.stringify(p.getEngineBehavior(ratio), null, 2));
    // eslint-disable-next-line no-console
    console.log(
      `[render] wrote ${OUT_WAV} (${(outCh[0]!.length / sr).toFixed(2)}s) + behavior JSON`,
    );
  });
});
