'use client';

/**
 * useStemUpload — LAUNCH-02.5c follow-up.
 *
 * Uploads a Groove Card stem for the admin form, returning a public URL
 * the form stores in the block config.
 *
 * Architecture (backend proxy):
 *   - The upload POSTs multipart FormData to the backend endpoint
 *     `POST /api/v1/tutorials/groove-stem/upload`, authenticated with
 *     the admin's session bearer token.
 *   - The backend (NestJS AdminGuard) uploads with the service-role key,
 *     bypassing storage RLS. This mirrors the existing ThumbnailUpload
 *     flow.
 *   - Why not direct browser → Supabase Storage? The direct path's
 *     storage POST wasn't reliably authenticated as the admin in the
 *     browser (the JWT didn't reach the storage request), so Supabase
 *     rejected it with a row-level-security violation. The backend proxy
 *     sidesteps that entirely and matches how every other admin upload
 *     in this codebase works.
 *   - Files land at
 *     `audio-samples/grooves/{tutorialSlug}/{keyFolder}/{stem}.ogg`.
 *     Path is stable across re-uploads (server uses `upsert: true`) so
 *     the saved block config's URL keeps working when a stem is replaced.
 *
 * Validation (client-side pre-check; the backend re-validates):
 *   - File MIME / extension must be OGG Vorbis (`audio/ogg` or `.ogg`).
 *   - Hard 8 MB cap per stem.
 *
 * Returns the public URL on success. The form pastes it into the
 * corresponding `stems[i].{bass|drums|harmony}` cell.
 */

import { useCallback, useState } from 'react';
import { supabase } from '@/infrastructure/supabase/client';

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
        // Need the admin's session token to authenticate to the backend.
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session) {
          setError('Session expired. Please refresh and sign in again.');
          return null;
        }

        // Append the text fields BEFORE the file. Fastify's req.file()
        // resolves at the file part and only exposes text fields that were
        // already streamed; fields after the file would arrive too late and
        // read back as empty on the server.
        const formData = new FormData();
        formData.append('slug', opts.tutorialSlug);
        formData.append('keyFolder', opts.keyFolder);
        formData.append('stem', opts.stem);
        formData.append('file', file);

        const apiUrl =
          process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const response = await fetch(
          `${apiUrl}/api/v1/tutorials/groove-stem/upload`,
          {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: formData,
          },
        );

        if (!response.ok) {
          const body = (await response.json().catch(() => ({}))) as {
            message?: string;
          };
          if (response.status === 401 || response.status === 403) {
            setError('Upload denied. Are you signed in as an admin?');
          } else {
            setError(
              body.message ?? `Upload failed (HTTP ${response.status}).`,
            );
          }
          return null;
        }

        const result = (await response.json()) as {
          publicUrl?: string;
          path?: string;
        };
        if (!result.publicUrl) {
          setError('Upload succeeded but no public URL was returned.');
          return null;
        }
        return result.publicUrl;
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
