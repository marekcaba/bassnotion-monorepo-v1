'use client';

/**
 * StemUploadButton — LAUNCH-02.5c follow-up.
 *
 * Single-file upload affordance for one stem cell in the Groove Card
 * admin form. Replaces the previous URL text input. Three states:
 *   - Empty: shows a dashed "Upload .ogg" button.
 *   - Uploaded: shows the filename + "Replace" affordance.
 *   - Uploading: shows a small spinner.
 *
 * Hands off to useStemUpload for the actual Supabase call. On success,
 * calls onChange with the public URL so the parent form pastes it
 * into the corresponding `stems[i].{stem}` cell.
 */

import { useCallback, useRef } from 'react';
import { Upload, FileAudio, Loader2, RefreshCw, X } from 'lucide-react';
import { useStemUpload, type UploadStemOptions } from './useStemUpload';

interface StemUploadButtonProps {
  /** Current saved URL for this stem, or empty string when unset. */
  value: string;
  /** Notify the form when the URL changes (after a successful upload
   * or an explicit clear). */
  onChange: (url: string) => void;
  /** Path-building context: where in the bucket this stem lands. */
  uploadContext: UploadStemOptions;
  /** Stem name surfaced in the button label. */
  stemLabel: string;
}

export function StemUploadButton({
  value,
  onChange,
  uploadContext,
  stemLabel,
}: StemUploadButtonProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { isUploading, error, upload, clearError } = useStemUpload();

  const handleFileSelected = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset the input value so picking the same file again still
      // fires onChange (browsers skip the event when the path matches).
      e.target.value = '';
      if (!file) return;

      const url = await upload(file, uploadContext);
      if (url) {
        onChange(url);
      }
    },
    [upload, uploadContext, onChange],
  );

  const handleClear = useCallback(() => {
    onChange('');
    clearError();
  }, [onChange, clearError]);

  const triggerPicker = useCallback(() => {
    clearError();
    inputRef.current?.click();
  }, [clearError]);

  // Show the last path segment as a readable filename when we have a URL.
  const displayName = value
    ? (value.split('/').pop() ?? '').split('?')[0] || 'uploaded'
    : '';

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <input
        ref={inputRef}
        type="file"
        accept=".ogg,.oga,audio/ogg"
        className="hidden"
        onChange={handleFileSelected}
        disabled={isUploading}
        aria-hidden="true"
      />

      {value ? (
        // Uploaded state: filename + replace + clear.
        <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-white/5 border border-white/10 text-xs text-white min-w-0">
          <FileAudio className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="flex-1 truncate text-white/80" title={value}>
            {displayName}
          </span>
          <button
            type="button"
            onClick={triggerPicker}
            disabled={isUploading}
            aria-label={`Replace ${stemLabel} stem`}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-50"
          >
            {isUploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={isUploading}
            aria-label={`Clear ${stemLabel} stem`}
            className="p-1 rounded hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-50"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        // Empty state: dashed upload button.
        <button
          type="button"
          onClick={triggerPicker}
          disabled={isUploading}
          aria-label={`Upload ${stemLabel} stem`}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-white/5 border border-dashed border-white/20 text-xs text-white/60 hover:bg-white/10 hover:text-white disabled:opacity-50 transition-colors"
        >
          {isUploading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
          ) : (
            <Upload className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate">
            {isUploading ? 'Uploading…' : `Upload ${stemLabel} (.ogg)`}
          </span>
        </button>
      )}

      {error && (
        <p className="text-[10px] text-red-400 px-1" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
