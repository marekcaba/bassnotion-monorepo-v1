'use client';

/**
 * useStemUpload — LAUNCH-02.5c follow-up.
 *
 * Direct browser → Supabase Storage upload for the Groove Card admin
 * form. Replaces the URL text-input pattern with a file picker that
 * uploads, returns a public URL, and stores it in the block config.
 *
 * Architecture:
 *   - Frontend client (`@/infrastructure/supabase/client`) carries the
 *     admin's session JWT. The `audio-samples` bucket's RLS policy
 *     allows insert/update/delete when `auth.uid()`'s profile row has
 *     role = 'admin', so no backend proxy is needed.
 *   - Files land at `audio-samples/grooves/{tutorialSlug}/{keyLabel}/{stem}.ogg`.
 *     Path is stable across re-uploads (`upsert: true`) so the saved
 *     block config's URL keeps working when the admin replaces a stem.
 *
 * Validation:
 *   - File MIME / extension must be OGG Vorbis (`audio/ogg` or `.ogg`).
 *   - Hard 8 MB cap per stem (sane upper bound; the bundled countdown
 *     click is ~5 KB; a full groove loop is ~1-2 MB at OGG q5).
 *
 * Returns the public URL on success. The form pastes that URL into
 * the corresponding `stems[i].{bass|drums|harmony|click}` cell.
 */

import { useCallback, useState } from 'react';
import { supabase as supabaseClient } from '@/infrastructure/supabase/client';

// `supabase` is typed as a union with a webkit-E2E mock that lacks
// .storage. In production it's always the real SupabaseClient. Narrow
// once at the module boundary so callers below can use .storage freely.
// (Same pattern AvatarUpload / ThumbnailUpload use implicitly.)
const supabase = supabaseClient as Extract<
  typeof supabaseClient,
  { storage: unknown }
>;

export interface UploadStemOptions {
  /** Tutorial slug for the storage path. e.g. "economy-groove-1". */
  tutorialSlug: string;
  /** Key label for the storage subfolder. e.g. "E", "G♯". Falls back
   * to the semitoneOffset (e.g. "+4", "-8") when the admin hasn't
   * named the key yet — keeps paths predictable. */
  keyFolder: string;
  /** Which musical stem this is. Click is never uploaded (it's the
   * shared metronome), so it's not in this union. */
  stem: 'bass' | 'drums' | 'harmony';
}

export interface UseStemUploadReturn {
  isUploading: boolean;
  error: string | null;
  /** Upload a single file. Resolves to the public URL on success,
   * or null on failure (error is also set in state). */
  upload: (file: File, opts: UploadStemOptions) => Promise<string | null>;
  /** Reset any error state. */
  clearError: () => void;
}

const BUCKET = 'audio-samples';
const MAX_FILE_BYTES = 8 * 1024 * 1024; // 8 MB
const ACCEPTED_EXTENSIONS = ['ogg', 'oga'] as const;
const ACCEPTED_MIME_PREFIXES = ['audio/ogg', 'application/ogg'] as const;

/**
 * URL-safe sanitiser for storage path segments. Preserves leading
 * `+`/`-` as `plus`/`minus` so semitone-offset folders never collide
 * (e.g. `+4` and `-4` would otherwise both collapse into `4/`,
 * overwriting each other's stems). Strips other non-alphanumerics,
 * lowercases, trims runs of dashes. Empty / whitespace input resolves
 * to the fallback so we never produce consecutive slashes.
 */
function sanitisePathSegment(input: string, fallback: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) return fallback;
  // Sign encoding: convert a leading + / - into a word so it survives
  // the alphanumeric scrub below.
  let withSign = trimmed;
  if (withSign.startsWith('+')) withSign = `plus${withSign.slice(1)}`;
  else if (withSign.startsWith('-')) withSign = `minus${withSign.slice(1)}`;
  const cleaned = withSign
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned.length > 0 ? cleaned : fallback;
}

export function buildStemPath(opts: UploadStemOptions): string {
  const slug = sanitisePathSegment(opts.tutorialSlug, 'untitled');
  const key = sanitisePathSegment(opts.keyFolder, 'unnamed');
  return `grooves/${slug}/${key}/${opts.stem}.ogg`;
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) {
    return `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max ${MAX_FILE_BYTES / 1024 / 1024} MB.`;
  }
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const mimeOk = ACCEPTED_MIME_PREFIXES.some((m) =>
    file.type.toLowerCase().startsWith(m),
  );
  const extOk = (ACCEPTED_EXTENSIONS as readonly string[]).includes(ext);
  if (!mimeOk && !extOk) {
    return `Unsupported file type. Use OGG Vorbis (.ogg).`;
  }
  return null;
}

export function useStemUpload(): UseStemUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File, opts: UploadStemOptions): Promise<string | null> => {
      const validationError = validateFile(file);
      if (validationError) {
        setError(validationError);
        return null;
      }

      setIsUploading(true);
      setError(null);

      try {
        const path = buildStemPath(opts);

        const { error: uploadError } = await supabase.storage
          .from(BUCKET)
          .upload(path, file, {
            cacheControl: '3600',
            upsert: true,
            contentType: 'audio/ogg',
          });

        if (uploadError) {
          // RLS denial surfaces as a 400 with a message containing
          // "new row violates row-level security policy". Surface a
          // friendlier hint.
          const isRlsDenial = uploadError.message
            .toLowerCase()
            .includes('row-level security');
          setError(
            isRlsDenial
              ? 'Upload denied. Are you signed in as an admin?'
              : uploadError.message,
          );
          return null;
        }

        // Compose the public URL. We don't store the Supabase host in
        // the saved block config — the bucket-path pattern Zod accepts
        // is host-agnostic (per CLAUDE.md, staging and production
        // project refs differ).
        const { data: urlData } = supabase.storage
          .from(BUCKET)
          .getPublicUrl(path);
        const publicUrl = urlData?.publicUrl;
        if (!publicUrl) {
          setError('Upload succeeded but no public URL could be resolved.');
          return null;
        }
        return publicUrl;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Upload failed');
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    [],
  );

  const clearError = useCallback(() => setError(null), []);

  return { isUploading, error, upload, clearError };
}

// Test-only exports.
export const _internal = {
  buildStemPath,
  sanitisePathSegment,
  validateFile,
  MAX_FILE_BYTES,
  ACCEPTED_EXTENSIONS,
};
