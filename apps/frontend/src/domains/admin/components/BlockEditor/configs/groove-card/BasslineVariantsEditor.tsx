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
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50/40 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-amber-700">
          Lines &amp; Fills (premium basslines)
        </h4>
        <button
          type="button"
          onClick={addRow}
          className="rounded-md bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-600"
        >
          + Add bassline
        </button>
      </div>
      <p className="text-[11px] text-gray-500">
        Each variant must be the EXACT same length as the default bass (checked
        on upload). Files go to the private premium-basslines bucket.
      </p>

      {variants.length === 0 && (
        <p className="text-xs text-gray-400">No premium basslines yet.</p>
      )}

      {variants.map((v) => (
        <div
          key={v.id}
          className="flex items-center gap-2 rounded border bg-white px-2 py-1.5"
        >
          <input
            value={v.title}
            onChange={(e) => setTitle(v.id, e.target.value)}
            placeholder="Title (e.g. Walking)"
            className="flex-1 rounded border px-2 py-1 text-sm text-gray-900"
          />
          <label className="flex cursor-pointer items-center gap-1 rounded bg-gray-800 px-2 py-1 text-xs font-medium text-white hover:bg-gray-700">
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
          {v.url && <span className="text-[10px] text-emerald-600">✓ set</span>}
          <button
            type="button"
            onClick={() => removeRow(v.id)}
            className="text-red-500 hover:text-red-700"
            title="Remove"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
