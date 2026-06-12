'use client';

/**
 * BasslineVariantsEditor — author a groove's premium "Lines & Fills".
 *
 * Nested model: each BASSLINE owns its own FILLS (fills belong to one line and
 * never cross). Bass A is the groove's built-in main bass (no upload — it's
 * stems.bass); its fills are variants tagged with a `fillId` but no `lineId`.
 * Each added line (Bass B, C…) is a base take tagged with a `lineId`; its fills
 * carry that `lineId` + their own `fillId`. Every take uploads a full-length OGG
 * to the PRIVATE premium-basslines bucket and stores the returned storage ref.
 *
 * Same-length GUARD: every take MUST match the main bass's musical length (the
 * engine swaps PCM in place at the loop seam — a different length desyncs the
 * band). Enforced HERE by decoding the picked file client-side and comparing its
 * bar count to the decoded main bass before uploading.
 */

import { useCallback, useRef, useState } from 'react';
import { Trash2, UploadCloud, Music4 } from 'lucide-react';
import type {
  BasslineVariant,
  ExerciseNote,
  GrooveCardBlockConfig,
} from '@bassnotion/contracts';
import { MusicXMLParser } from '@bassnotion/contracts';
import { supabase } from '@/infrastructure/supabase/client';
import { StemUploadButton } from './StemUploadButton';
import type { UploadStemOptions } from './useStemUpload';

type BassNotation = NonNullable<GrooveCardBlockConfig['bassNotation']>;

/**
 * Compact per-row MusicXML import: a small "Notation" button that reads the
 * picked .xml/.musicxml/.mxl, runs the real {@link MusicXMLParser}, and hands
 * back the ExerciseNote[]. (The shared MusicXMLUpload widget is a stub that
 * never parses — we wire the parser directly here.) Shows ♪ + a note count
 * once a score is loaded; click to replace.
 */
function NotationCell({
  notes,
  onNotes,
}: {
  notes?: ExerciseNote[];
  onNotes: (notes: ExerciseNote[] | undefined) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const count = notes?.length ?? 0;

  const onPick = useCallback(
    async (file: File) => {
      setErr(null);
      setBusy(true);
      try {
        const text = await file.text();
        const result = await new MusicXMLParser().parseFile(text);
        if (!result.success || result.notes.length === 0) {
          setErr(result.errors?.[0] ?? 'No notes found in that score.');
          return;
        }
        onNotes(result.notes);
      } catch (e) {
        setErr(e instanceof Error ? e.message : 'Import failed');
      } finally {
        setBusy(false);
      }
    },
    [onNotes],
  );

  return (
    <div className="flex shrink-0 items-center gap-1">
      <label
        title={count > 0 ? `${count} notes — replace` : 'Import bass notation'}
        className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
          busy
            ? 'cursor-wait border-white/10 bg-white/5 text-white/40'
            : count > 0
              ? 'border-sky-400/30 bg-sky-400/10 text-sky-300 hover:bg-sky-400/20'
              : 'border-white/15 bg-white/10 text-white/70 hover:bg-white/15'
        }`}
      >
        <Music4 className="h-3.5 w-3.5" />
        {busy ? '…' : count > 0 ? `♪ ${count}` : 'Notation'}
        <input
          type="file"
          accept=".xml,.musicxml,.mxl"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPick(f);
            e.target.value = '';
          }}
        />
      </label>
      {count > 0 && (
        <button
          type="button"
          onClick={() => onNotes(undefined)}
          className="shrink-0 text-white/25 transition-colors hover:text-red-400"
          title="Clear notation"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
      {err && <span className="text-[10px] text-red-400">{err}</span>}
    </div>
  );
}

interface BasslineVariantsEditorProps {
  /** Current variants (from stems.bassVariants). */
  variants: BasslineVariant[];
  /** The MAIN bass URL (stems.bass) — this is "Bass A". Doubles as the
   *  length reference every alternate line / fill is checked against. */
  mainBassUrl: string;
  /** Persist a new main-bass URL (writes stems.bass, PUBLIC audio-samples). */
  onChangeMainBass: (url: string) => void;
  /** Upload context for the main bass (path-building in the audio-samples
   *  bucket — same plumbing as the drums/harmony stem uploaders). */
  mainBassUploadContext: UploadStemOptions;
  /** Bass A's sheet notation (config.bassNotation) — Bass A is the main bass,
   *  not a variant, so its score lives on the config. */
  bassANotation?: BassNotation;
  /** Persist Bass A's notation. */
  onChangeBassANotation: (value: BassNotation | undefined) => void;
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
  mainBassUrl,
  onChangeMainBass,
  mainBassUploadContext,
  bassANotation,
  onChangeBassANotation,
  lengthBars,
  bpm,
  slug,
  onChange,
}: BasslineVariantsEditorProps) {
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cache the default bass musical length (in bars) so we decode it once.
  const defaultBarsRef = useRef<number | null>(null);

  // ── derive the nested Lines→Fills tree from the flat variant list ─────────
  // Bass A is the BUILT-IN bass (the groove's stems.bass) — it isn't a variant;
  // it always exists and owns the fills tagged with a fillId but NO lineId. Each
  // ADDED line is a base take (a variant with a lineId and no fillId); its fills
  // are the variants sharing that lineId. Fills belong to ONE line — never cross.
  const addedLineBases = variants.filter((v) => v.lineId && !v.fillId);

  /** The fills owned by a line: variants with that line's `lineId` (or none, for
   *  built-in Bass A) AND a `fillId`. */
  const fillsOfLine = useCallback(
    (lineId: string | undefined) =>
      variants.filter((v) => (v.lineId ?? undefined) === lineId && !!v.fillId),
    [variants],
  );

  const setVariant = useCallback(
    (id: string, patch: Partial<BasslineVariant>) =>
      onChange(variants.map((v) => (v.id === id ? { ...v, ...patch } : v))),
    [variants, onChange],
  );

  // Set a variant's sheet notes (empty array clears it back to undefined).
  const setVariantNotes = useCallback(
    (id: string, notes: ExerciseNote[] | undefined) =>
      setVariant(id, { notes: notes && notes.length > 0 ? notes : undefined }),
    [setVariant],
  );

  const removeVariant = useCallback(
    (id: string) => onChange(variants.filter((v) => v.id !== id)),
    [variants, onChange],
  );

  // Patch one field of a fill's region (bar/beat), clamped to the groove grid.
  // Seeds a default whole-loop region the first time any field is touched so the
  // four inputs always have a coherent value.
  const setFillRegionField = useCallback(
    (
      id: string,
      key: 'startBar' | 'startBeat' | 'endBar' | 'endBeat',
      raw: number,
    ) => {
      const maxBar = Math.max(1, lengthBars);
      const clamped =
        key === 'startBeat' || key === 'endBeat'
          ? Math.min(4, Math.max(1, Math.round(raw) || 1))
          : Math.min(maxBar, Math.max(1, Math.round(raw) || 1));
      onChange(
        variants.map((v) => {
          if (v.id !== id) return v;
          const base = v.fillRegion ?? {
            startBar: 1,
            startBeat: 1,
            endBar: maxBar,
            endBeat: 1,
          };
          return { ...v, fillRegion: { ...base, [key]: clamped } };
        }),
      );
    },
    [variants, onChange, lengthBars],
  );

  // Add a LINE: a base take tagged with a fresh lineId (label "Bass B/C/…").
  const addLine = useCallback(() => {
    // Bass A is the built-in; the first ADDED line is Bass B (index +2 → B).
    const letter = String.fromCharCode(66 + addedLineBases.length); // 66='B'
    const lineId = `line-${Date.now().toString(36)}`;
    onChange([
      ...variants,
      { id: `var-${lineId}`, title: `Bass ${letter}`, url: '', lineId },
    ]);
  }, [variants, onChange, addedLineBases.length]);

  // Remove a LINE: its base take + every fill it owns.
  const removeLine = useCallback(
    (lineId: string) => onChange(variants.filter((v) => v.lineId !== lineId)),
    [variants, onChange],
  );

  // Add a FILL to a specific line (built-in Bass A = lineId undefined → the
  // fill is tagged fillId-only; an added line → tagged with its lineId too).
  const addFillToLine = useCallback(
    (lineId: string | undefined, lineLabel: string) => {
      const n = fillsOfLine(lineId).length + 1;
      const fillId = `fill-${Date.now().toString(36)}`;
      const tag = lineId ?? 'a';
      onChange([
        ...variants,
        {
          id: `var-${tag}-${fillId}`,
          title: `${lineLabel} Fill ${n}`,
          url: '',
          fillId,
          ...(lineId ? { lineId } : {}),
        },
      ]);
    },
    [variants, onChange, fillsOfLine],
  );

  const uploadFor = useCallback(
    async (variant: BasslineVariant, file: File) => {
      setError(null);
      if (file.size > MAX_BYTES) {
        setError(`File too large (max ${MAX_BYTES / 1024 / 1024}MB).`);
        return;
      }
      if (!mainBassUrl) {
        setError('Upload Bass A (the main bass) first — it sets the length.');
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
          const ref = await fetch(mainBassUrl);
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
        // The human title (e.g. "Bass B Fill 1") so the stored filename is
        // readable in the bucket; the backend keeps a stable id suffix for
        // uniqueness + upsert-on-replace.
        form.append('title', variant.title ?? '');
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
    [variants, onChange, slug, mainBassUrl],
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

  /** A line block: the bassline (name + upload) and its OWN fills nested below,
   *  with a per-line "+ Add fill". `builtIn` is Bass A (the groove's stems.bass,
   *  no upload — it already exists as the main bass). */
  const LineBlock = ({
    lineId,
    label,
    baseVariant,
    builtIn,
  }: {
    lineId: string | undefined;
    label: string;
    /** The base take variant (added lines only; undefined for built-in Bass A). */
    baseVariant?: BasslineVariant;
    builtIn?: boolean;
  }) => {
    const fills = fillsOfLine(lineId);
    return (
      <div className="space-y-2 rounded-md border border-white/10 bg-white/5 p-3">
        {/* Bassline row */}
        <div className="flex items-center gap-2">
          {builtIn ? (
            // Bass A IS the groove's main bass (stems.bass) — its uploader writes
            // to the PUBLIC audio-samples bucket (same as drums/harmony), NOT the
            // private variant bucket. Authored here so the whole bass family
            // (Bass A + alternates + fills) lives in one list.
            <>
              <span className="shrink-0 text-sm font-medium text-white/80">
                {label}{' '}
                <span className="text-[10px] font-normal text-white/30">
                  (main bass)
                </span>
              </span>
              <div className="min-w-0 flex-1">
                <StemUploadButton
                  value={mainBassUrl}
                  onChange={onChangeMainBass}
                  uploadContext={mainBassUploadContext}
                  stemLabel="bass"
                />
              </div>
              <NotationCell
                notes={bassANotation?.notes}
                onNotes={(notes) =>
                  onChangeBassANotation(
                    notes && notes.length > 0 ? { notes } : undefined,
                  )
                }
              />
            </>
          ) : (
            <>
              <input
                value={baseVariant?.title ?? label}
                onChange={(e) =>
                  baseVariant &&
                  setVariant(baseVariant.id, { title: e.target.value })
                }
                placeholder="Bassline name (e.g. Bass B)"
                className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1.5 text-sm text-white placeholder:text-white/30"
              />
              {baseVariant && <UploadCell variant={baseVariant} />}
              {baseVariant && (
                <NotationCell
                  notes={baseVariant.notes}
                  onNotes={(notes) => setVariantNotes(baseVariant.id, notes)}
                />
              )}
              <button
                type="button"
                onClick={() => lineId && removeLine(lineId)}
                className="shrink-0 text-white/30 transition-colors hover:text-red-400"
                title="Remove bassline (and its fills)"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* This line's fills */}
        <div className="ml-3 space-y-1.5 border-l border-white/10 pl-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-white/30">
              {label} fills
            </span>
            <button
              type="button"
              onClick={() => addFillToLine(lineId, label)}
              className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] font-medium text-amber-300 transition-colors hover:bg-amber-400/20"
            >
              + Add fill
            </button>
          </div>
          {fills.length === 0 && (
            <p className="text-[11px] text-white/25">No fills for this line.</p>
          )}
          {fills.map((fv) => {
            const region = fv.fillRegion;
            return (
              <div
                key={fv.id}
                className="space-y-1.5 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5"
              >
                {/* Name + upload + delete */}
                <div className="flex items-center gap-2">
                  <input
                    value={fv.title}
                    onChange={(e) =>
                      setVariant(fv.id, { title: e.target.value })
                    }
                    placeholder="Fill name (e.g. Turnaround)"
                    className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-white placeholder:text-white/30"
                  />
                  <UploadCell variant={fv} compact />
                  <NotationCell
                    notes={fv.notes}
                    onNotes={(notes) => setVariantNotes(fv.id, notes)}
                  />
                  <button
                    type="button"
                    onClick={() => removeVariant(fv.id)}
                    className="shrink-0 text-white/30 transition-colors hover:text-red-400"
                    title="Remove fill"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                {/* Region: where the fill happens (highlighted on the waveform).
                    bar + beat, 1-indexed, clamped to the groove grid. */}
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 pl-0.5">
                  <span className="text-[10px] uppercase tracking-wider text-white/30">
                    Region
                  </span>
                  <span className="text-[10px] text-white/40">bar</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, lengthBars)}
                    value={region?.startBar ?? ''}
                    placeholder="1"
                    onChange={(e) =>
                      setFillRegionField(fv.id, 'startBar', +e.target.value)
                    }
                    className="w-10 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-center text-[11px] text-white placeholder:text-white/25"
                  />
                  <span className="text-[10px] text-white/40">beat</span>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={region?.startBeat ?? ''}
                    placeholder="1"
                    onChange={(e) =>
                      setFillRegionField(fv.id, 'startBeat', +e.target.value)
                    }
                    className="w-9 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-center text-[11px] text-white placeholder:text-white/25"
                  />
                  <span className="px-0.5 text-[11px] text-white/30">→</span>
                  <span className="text-[10px] text-white/40">bar</span>
                  <input
                    type="number"
                    min={1}
                    max={Math.max(1, lengthBars)}
                    value={region?.endBar ?? ''}
                    placeholder={String(Math.max(1, lengthBars))}
                    onChange={(e) =>
                      setFillRegionField(fv.id, 'endBar', +e.target.value)
                    }
                    className="w-10 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-center text-[11px] text-white placeholder:text-white/25"
                  />
                  <span className="text-[10px] text-white/40">beat</span>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={region?.endBeat ?? ''}
                    placeholder="1"
                    onChange={(e) =>
                      setFillRegionField(fv.id, 'endBeat', +e.target.value)
                    }
                    className="w-9 rounded border border-white/10 bg-white/5 px-1 py-0.5 text-center text-[11px] text-white placeholder:text-white/25"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <fieldset className="space-y-3">
      <div className="flex items-center justify-between">
        <legend className="text-xs uppercase tracking-wider text-amber-400/70">
          Lines &amp; Fills — premium basslines
        </legend>
        <button
          type="button"
          onClick={addLine}
          className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-400/20"
        >
          + Add bassline
        </button>
      </div>
      <p className="text-xs text-white/40">
        Bass A is the groove’s main bass; add alternate lines (Bass B, C…) and,
        under each, its <span className="text-white/60">own fills</span> — fills
        belong to one line and never cross. Every file must be the EXACT same
        length as Bass A (checked on upload). Bass A writes to the public{' '}
        <code className="text-white/50">audio-samples</code> bucket; alternate
        lines and fills write to the private{' '}
        <code className="text-white/50">premium-basslines</code> bucket.
      </p>

      <div className="space-y-2">
        {/* Bass A — the built-in main bass, with its own fills */}
        <LineBlock lineId={undefined} label="Bass A" builtIn />

        {/* Added basslines, each with its own fills */}
        {addedLineBases.map((v) => (
          <LineBlock
            key={v.id}
            lineId={v.lineId}
            label={v.title || 'Bassline'}
            baseVariant={v}
          />
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </fieldset>
  );
}
