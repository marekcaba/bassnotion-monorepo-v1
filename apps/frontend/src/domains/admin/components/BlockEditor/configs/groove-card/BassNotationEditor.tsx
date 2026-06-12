'use client';

/**
 * BassNotationEditor — admin authoring for the groove card's bass sheet-music.
 *
 * Imports a MusicXML score (reusing the shared MusicXMLUpload, which parses it
 * to an Exercise) and stores its `notes` as the groove's `bassNotation`. The
 * player's window can then switch from the waveform to this bass-clef score.
 * Pre-parsed at author time, so the player renders the notes directly.
 */

import { useCallback, useState } from 'react';
import { Music4, Trash2 } from 'lucide-react';
import type {
  ExerciseNote,
  GrooveCardBlockConfig,
  TimeSignature,
} from '@bassnotion/contracts';
import { MusicXMLUpload } from '@/domains/widgets/components/shared/MusicXMLUpload';

type BassNotation = NonNullable<GrooveCardBlockConfig['bassNotation']>;

interface BassNotationEditorProps {
  value?: BassNotation;
  onChange: (value: BassNotation | undefined) => void;
}

export function BassNotationEditor({
  value,
  onChange,
}: BassNotationEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const noteCount = value?.notes?.length ?? 0;

  const onFileUploaded = useCallback(
    (exercise: { notes?: ExerciseNote[]; timeSignature?: TimeSignature }) => {
      setError(null);
      const notes = exercise?.notes ?? [];
      if (notes.length === 0) {
        setError('No notes found in that score.');
        return;
      }
      onChange({
        notes,
        ...(exercise.timeSignature
          ? { timeSignature: exercise.timeSignature }
          : {}),
      });
    },
    [onChange],
  );

  return (
    <fieldset className="space-y-2">
      <div className="flex items-center justify-between">
        <legend className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-white/40">
          <Music4 className="h-3.5 w-3.5" aria-hidden />
          Bass notation (sheet music)
        </legend>
        {noteCount > 0 && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="flex items-center gap-1 text-[11px] text-white/30 transition-colors hover:text-red-400"
            title="Remove notation"
          >
            <Trash2 className="h-3 w-3" /> Clear
          </button>
        )}
      </div>
      <p className="text-xs text-white/40">
        Import the bass line as a MusicXML score. The card’s window can then
        switch from the waveform to this bass-clef notation, which follows
        playback.
      </p>

      {noteCount > 0 ? (
        <div className="flex items-center justify-between rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-2">
          <span className="text-xs font-medium text-emerald-300">
            ✓ {noteCount} notes imported
          </span>
          <span className="text-[10px] text-white/40">
            re-import below to replace
          </span>
        </div>
      ) : null}

      <MusicXMLUpload
        onFileUploaded={onFileUploaded}
        onError={(e) => setError(e)}
      />

      {error && <p className="text-xs text-red-400">{error}</p>}
    </fieldset>
  );
}
