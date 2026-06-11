'use client';

/**
 * BasslineVariantsEditor — manage a groove's premium alternate basslines
 * ("Lines & Fills"). A repeating list of { id, title, url } rows on the library
 * groove editor. Each row uploads a full-length OGG to the PRIVATE
 * premium-basslines bucket (PR4 admin endpoint) and stores the returned
 * storage-ref URL.
 *
 * Same-length GUARD: every variant MUST match the default bass's sample length
 * (the engine swaps PCM in place at the loop seam — a different length desyncs
 * the band). We enforce it HERE by decoding the picked file client-side and
 * comparing its sample count to the decoded default bass before uploading.
 */

import { useCallback, useRef, useState } from 'react';
import { Trash2, UploadCloud } from 'lucide-react';
import type { BasslineVariant } from '@bassnotion/contracts';
import { supabase } from '@/infrastructure/supabase/client';

interface BasslineVariantsEditorProps {
  /** Current variants (from stems.bassVariants). */
  variants: BasslineVariant[];
  /** The default bass URL — used to fetch+decode the reference length. */
  defaultBassUrl: string;
  /** Groove length in bars — defines the musical grid the variant must match. */
  lengthBars: number;
  /** Groove default BPM — defines the musical grid. */
  bpm: number;
  /** Groove slug (storage path) for the upload. */
  slug: string;
  onChange: (variants: BasslineVariant[]) => void;
}

const MAX_BYTES = 8 * 1024 * 1024;
/** Beats per bar (the engine only supports 4/4). */
const BEATS_PER_BAR = 4;

/** Decode an audio source to { frames, sampleRate } (per-channel frame count). */
async function decodeAudio(
  source: ArrayBuffer,
): Promise<{ frames: number; sampleRate: number }> {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(source.slice(0));
    return { frames: buf.length, sampleRate: buf.sampleRate };
  } finally {
    void ctx.close();
  }
}

/**
 * The MUSICAL length of a decoded buffer, in bars — `frames / framesPerBar`.
 * "Same length" means same number of BARS, not bit-exact frames: OGG decode
 * padding shifts the raw frame count by a few hundred samples (sub-frame),
 * which must NOT count as a mismatch, while a real error (a whole bar off) moves
 * this by ≥1.0. Compared against the groove's grid so a variant that's musically
 * correct always passes regardless of encoder padding.
 */
function lengthInBars(frames: number, sampleRate: number, bpm: number): number {
  const framesPerBar = (BEATS_PER_BAR * 60 * sampleRate) / bpm;
  return frames / framesPerBar;
}

export function BasslineVariantsEditor({
  variants,
  defaultBassUrl,
  lengthBars,
  bpm,
  slug,
  onChange,
}: BasslineVariantsEditorProps) {
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cache the default bass musical length (in bars) so we decode it once.
  const defaultBarsRef = useRef<number | null>(null);

  // ── derive Lines + Fill slots from the flat variant list ─────────────────
  // A LINE is authored by its base take (a variant tagged with a lineId and NO
  // fillId). A FILL SLOT is a distinct fillId. The Fills box is the grid of
  // (line × fill) combo cells; each cell is the variant tagged with that pair.
  const lineBases = variants.filter((v) => v.lineId && !v.fillId);
  // Fill slots: one per distinct fillId, label = first cell carrying it.
  const fillSlots = Array.from(
    variants
      .filter((v) => v.fillId)
      .reduce((m, v) => {
        const id = v.fillId as string;
        if (!m.has(id)) m.set(id, v.title);
        return m;
      }, new Map<string, string>()),
  ).map(([fillId, title]) => ({ fillId, title }));

  /** The combo variant for a (lineId|null=default, fillId) pair, if uploaded. */
  const comboFor = useCallback(
    (lineId: string | undefined, fillId: string) =>
      variants.find(
        (v) => (v.lineId ?? undefined) === lineId && v.fillId === fillId,
      ),
    [variants],
  );

  const setVariant = useCallback(
    (id: string, patch: Partial<BasslineVariant>) =>
      onChange(variants.map((v) => (v.id === id ? { ...v, ...patch } : v))),
    [variants, onChange],
  );

  // Add a LINE: a base take tagged with a fresh lineId (label "Line N").
  const addLine = useCallback(() => {
    const n = lineBases.length + 1;
    const lineId = `line-${Date.now().toString(36)}`;
    onChange([
      ...variants,
      { id: `var-${lineId}`, title: `Line ${n}`, url: '', lineId },
    ]);
  }, [variants, onChange, lineBases.length]);

  // Add a FILL SLOT: an empty combo cell on the DEFAULT line (so the slot
  // appears immediately). Other lines get their cell lazily on first upload.
  const addFill = useCallback(() => {
    const n = fillSlots.length + 1;
    const fillId = `fill-${Date.now().toString(36)}`;
    onChange([
      ...variants,
      { id: `var-${fillId}-default`, title: `Fill ${n}`, url: '', fillId },
    ]);
  }, [variants, onChange, fillSlots.length]);

  // Remove a whole LINE (its base + every combo cell on that line).
  const removeLine = useCallback(
    (lineId: string) => onChange(variants.filter((v) => v.lineId !== lineId)),
    [variants, onChange],
  );

  // Remove a whole FILL slot (every combo cell with that fillId, across lines).
  const removeFill = useCallback(
    (fillId: string) => onChange(variants.filter((v) => v.fillId !== fillId)),
    [variants, onChange],
  );

  // Rename a fill slot (its display title is the slot's label — applied to
  // whichever cell carries the slot's "name"). We store the label on every cell
  // of the slot so the player's Fills row reads it; renaming updates them all.
  const renameFill = useCallback(
    (fillId: string, title: string) =>
      onChange(
        variants.map((v) => (v.fillId === fillId ? { ...v, title } : v)),
      ),
    [variants, onChange],
  );

  /** Stable, lazily-created combo variant for an upload cell. Returns the
   *  existing variant or a fresh (unsaved) one with the right (line, fill)
   *  tags + a title derived from the line + fill labels. */
  const comboCellVariant = useCallback(
    (
      line: { lineId?: string; title: string },
      fill: { fillId: string; title: string },
    ): BasslineVariant => {
      const existing = comboFor(line.lineId, fill.fillId);
      if (existing) return existing;
      const lineTag = line.lineId ?? 'default';
      return {
        id: `var-${lineTag}-${fill.fillId}`,
        title: `${line.title} · ${fill.title}`,
        url: '',
        ...(line.lineId ? { lineId: line.lineId } : {}),
        fillId: fill.fillId,
      };
    },
    [comboFor],
  );

  const uploadFor = useCallback(
    async (variant: BasslineVariant, file: File) => {
      setError(null);
      if (file.size > MAX_BYTES) {
        setError(`File too large (max ${MAX_BYTES / 1024 / 1024}MB).`);
        return;
      }
      if (!defaultBassUrl) {
        setError('Upload the default bass stem first (the length reference).');
        return;
      }
      setBusyRow(variant.id);
      try {
        // SAME-LENGTH GUARD — MUSICAL, not bit-exact. A variant must span the
        // same number of BARS as the default bass (the engine loops on the
        // shared bar grid). We compare BAR counts, not raw frames: OGG decode
        // padding shifts the frame count by a few hundred samples (sub-frame ≈
        // 0.005 bars), which must NOT trip the guard — but a real error (a whole
        // bar short/long) moves the bar count by ≥1.0 and IS caught.
        const file_ = await decodeAudio(await file.arrayBuffer());
        const fileBars = lengthInBars(file_.frames, file_.sampleRate, bpm);

        if (defaultBarsRef.current == null) {
          const ref = await fetch(defaultBassUrl);
          const d = await decodeAudio(await ref.arrayBuffer());
          defaultBarsRef.current = lengthInBars(d.frames, d.sampleRate, bpm);
        }
        const refBars = defaultBarsRef.current;

        // Snap tolerance: < 1/8 bar (a sixteenth note). OGG padding jitter is
        // ~0.005 bars; a real bar-count error is ≥ 1 bar. 0.125 sits safely
        // between. We compare the variant to the DEFAULT BASS (the actual loop
        // reference) — NOT the nominal lengthBars, since real stems have natural
        // tails and never decode to an exact integer bar count. lengthBars/bpm
        // only set the grid scale for the bars math + the error copy.
        const BAR_SNAP = 0.125;
        if (Math.abs(fileBars - refBars) >= BAR_SNAP) {
          setError(
            `Length mismatch: variant is ${fileBars.toFixed(2)} bars, ` +
              `default bass is ${refBars.toFixed(2)} bars ` +
              `(groove grid: ${lengthBars} bars @ ${bpm} BPM). ` +
              `Re-render the variant to span exactly ${lengthBars} bars.`,
          );
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setError('Session expired — refresh and sign in again.');
          return;
        }
        const form = new FormData();
        form.append('slug', slug || 'library');
        form.append('variantId', variant.id);
        form.append('file', file);
        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const res = await fetch(
          `${apiUrl}/api/v1/tutorials/bassline-variant/upload`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: form,
          },
        );
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as {
            message?: string;
          };
          setError(body.message ?? `Upload failed (HTTP ${res.status}).`);
          return;
        }
        const { url } = (await res.json()) as { url?: string };
        if (!url) {
          setError('Upload succeeded but no URL returned.');
          return;
        }
        // Upsert: the combo cell may not exist as a variant yet (grid cells are
        // created lazily on first upload). Update in place if present, else add.
        onChange(
          variants.some((v) => v.id === variant.id)
            ? variants.map((v) => (v.id === variant.id ? { ...v, url } : v))
            : [...variants, { ...variant, url }],
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setBusyRow(null);
      }
    },
    [variants, onChange, slug, defaultBassUrl],
  );

  /** A compact upload control for one (combo) cell. Lazily creates the variant
   *  on first upload; shows Replace + ✓ once it has a URL. */
  const UploadCell = ({
    variant,
    compact,
  }: {
    variant: BasslineVariant;
    compact?: boolean;
  }) => {
    const busy = busyRow === variant.id;
    return (
      <label
        className={`flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
          busy
            ? 'cursor-wait border-white/10 bg-white/5 text-white/40'
            : variant.url
              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20'
              : 'border-white/15 bg-white/10 text-white/80 hover:bg-white/15'
        }`}
      >
        <UploadCloud className="h-3.5 w-3.5" />
        {busy
          ? 'Uploading…'
          : variant.url
            ? compact
              ? '✓ Replace'
              : 'Replace'
            : 'Upload'}
        <input
          type="file"
          accept=".ogg,audio/ogg"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void uploadFor(variant, f);
            e.target.value = '';
          }}
        />
      </label>
    );
  };

  return (
    <fieldset className="space-y-3">
      <legend className="text-xs uppercase tracking-wider text-amber-400/70">
        Lines &amp; Fills — premium basslines
      </legend>
      <p className="text-xs text-white/40">
        Author the two pickers the player shows. A{' '}
        <span className="text-white/60">Line</span> is a full alternate bass
        take; a <span className="text-white/60">Fill</span> is rendered{' '}
        <em>per line</em> as a combo take. Every file must be the EXACT same
        length as the default bass (checked on upload) and writes to the private{' '}
        <code className="text-white/50">premium-basslines</code> bucket.
      </p>

      {/* ── LINES box ──────────────────────────────────────────────────── */}
      <div className="space-y-1.5 rounded-md border border-white/10 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            Lines
          </span>
          <button
            type="button"
            onClick={addLine}
            className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-400/20"
          >
            + Add line
          </button>
        </div>
        <p className="text-[11px] text-white/30">
          The built-in bass is always offered as “Default”. Add alternate
          basslines here.
        </p>

        {lineBases.length === 0 && (
          <p className="text-xs text-white/30">No alternate lines yet.</p>
        )}
        {lineBases.map((v) => (
          <div
            key={v.id}
            className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5"
          >
            <input
              value={v.title}
              onChange={(e) => setVariant(v.id, { title: e.target.value })}
              placeholder="Line name (e.g. Walking)"
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white placeholder:text-white/30"
            />
            <UploadCell variant={v} />
            <button
              type="button"
              onClick={() => v.lineId && removeLine(v.lineId)}
              className="shrink-0 text-white/30 transition-colors hover:text-red-400"
              title="Remove line (and its fills)"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* ── FILLS box ──────────────────────────────────────────────────── */}
      <div className="space-y-1.5 rounded-md border border-white/10 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-white/50">
            Fills
          </span>
          <button
            type="button"
            onClick={addFill}
            className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-400/20"
          >
            + Add fill
          </button>
        </div>
        <p className="text-[11px] text-white/30">
          Each fill is rendered for every line. Upload the combo take in each
          cell — e.g. the “{lineBases[0]?.title ?? 'Default'}” column is that
          line playing this fill.
        </p>

        {fillSlots.length === 0 && (
          <p className="text-xs text-white/30">No fills yet.</p>
        )}
        {fillSlots.map((slot) => (
          <div
            key={slot.fillId}
            className="space-y-1.5 rounded-md border border-white/10 bg-white/5 px-2 py-2"
          >
            {/* Slot header: rename + remove the whole fill across all lines */}
            <div className="flex items-center gap-2">
              <input
                value={slot.title}
                onChange={(e) => renameFill(slot.fillId, e.target.value)}
                placeholder="Fill name (e.g. Turnaround)"
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white placeholder:text-white/30"
              />
              <button
                type="button"
                onClick={() => removeFill(slot.fillId)}
                className="shrink-0 text-white/30 transition-colors hover:text-red-400"
                title="Remove fill (across all lines)"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {/* One combo upload cell per line (Default + each alternate line) */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { lineId: undefined as string | undefined, title: 'Default' },
                ...lineBases.map((l) => ({
                  lineId: l.lineId,
                  title: l.title,
                })),
              ].map((line) => {
                const cell = comboCellVariant(line, slot);
                return (
                  <div
                    key={`${line.lineId ?? 'default'}-${slot.fillId}`}
                    className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1"
                  >
                    <span className="text-[10px] text-white/40">
                      {line.title}
                    </span>
                    <UploadCell variant={cell} compact />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </fieldset>
  );
}
