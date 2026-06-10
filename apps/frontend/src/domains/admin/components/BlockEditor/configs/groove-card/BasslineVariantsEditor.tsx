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
  /** The default bass URL — used to fetch+decode the reference sample length. */
  defaultBassUrl: string;
  /** Groove slug (storage path) for the upload. */
  slug: string;
  onChange: (variants: BasslineVariant[]) => void;
}

const MAX_BYTES = 8 * 1024 * 1024;

/** Decode an audio source to its sample length (per-channel frame count). */
async function decodeLength(source: ArrayBuffer): Promise<number> {
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buf = await ctx.decodeAudioData(source.slice(0));
    return buf.length;
  } finally {
    void ctx.close();
  }
}

export function BasslineVariantsEditor({
  variants,
  defaultBassUrl,
  slug,
  onChange,
}: BasslineVariantsEditorProps) {
  const [busyRow, setBusyRow] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Cache the default bass length so we decode it once across uploads.
  const defaultLenRef = useRef<number | null>(null);

  const addRow = useCallback(() => {
    const id = `var-${Date.now().toString(36)}`;
    onChange([...variants, { id, title: 'New bassline', url: '' }]);
  }, [variants, onChange]);

  const removeRow = useCallback(
    (id: string) => onChange(variants.filter((v) => v.id !== id)),
    [variants, onChange],
  );

  const setTitle = useCallback(
    (id: string, title: string) =>
      onChange(variants.map((v) => (v.id === id ? { ...v, title } : v))),
    [variants, onChange],
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
        // SAME-LENGTH GUARD: decode the picked file + the default bass and
        // compare frame counts. A mismatch would desync drums/harmony.
        const fileBuf = await file.arrayBuffer();
        const fileLen = await decodeLength(fileBuf);
        if (defaultLenRef.current == null) {
          const ref = await fetch(defaultBassUrl);
          defaultLenRef.current = await decodeLength(await ref.arrayBuffer());
        }
        const refLen = defaultLenRef.current;
        // Allow a tiny tolerance (encoder padding) — within ~1ms at 48kHz.
        if (Math.abs(fileLen - refLen) > 64) {
          setError(
            `Length mismatch: variant has ${fileLen} samples, default bass has ${refLen}. Re-render the variant to the EXACT same length.`,
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
        onChange(
          variants.map((v) => (v.id === variant.id ? { ...v, url } : v)),
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Upload failed');
      } finally {
        setBusyRow(null);
      }
    },
    [variants, onChange, slug, defaultBassUrl],
  );

  return (
    <fieldset className="space-y-2">
      <div className="flex items-center justify-between">
        <legend className="text-xs uppercase tracking-wider text-amber-400/70">
          Lines &amp; Fills — premium basslines
        </legend>
        <button
          type="button"
          onClick={addRow}
          className="rounded-md border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-amber-400/20"
        >
          + Add bassline
        </button>
      </div>
      <p className="text-xs text-white/40">
        Each variant must be the EXACT same length as the default bass (checked
        on upload). Files write to the private{' '}
        <code className="text-white/50">premium-basslines</code> bucket.
      </p>

      <div className="space-y-1.5 rounded-md border border-white/10 p-3">
        {variants.length === 0 && (
          <p className="text-xs text-white/30">No premium basslines yet.</p>
        )}

        {variants.map((v) => (
          <div
            key={v.id}
            className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2 py-1.5"
          >
            <input
              value={v.title}
              onChange={(e) => setTitle(v.id, e.target.value)}
              placeholder="Title (e.g. Walking)"
              className="min-w-0 flex-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-sm text-white placeholder:text-white/30"
            />
            <label
              className={`flex shrink-0 cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors ${
                busyRow === v.id
                  ? 'cursor-wait border-white/10 bg-white/5 text-white/40'
                  : 'border-white/15 bg-white/10 text-white/80 hover:bg-white/15'
              }`}
            >
              <UploadCloud className="h-3.5 w-3.5" />
              {busyRow === v.id ? 'Uploading…' : v.url ? 'Replace' : 'Upload'}
              <input
                type="file"
                accept=".ogg,audio/ogg"
                className="hidden"
                disabled={busyRow === v.id}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void uploadFor(v, f);
                  e.target.value = '';
                }}
              />
            </label>
            {v.url && (
              <span className="shrink-0 text-[10px] font-medium text-emerald-400">
                ✓ set
              </span>
            )}
            <button
              type="button"
              onClick={() => removeRow(v.id)}
              className="shrink-0 text-white/30 transition-colors hover:text-red-400"
              title="Remove"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </fieldset>
  );
}
