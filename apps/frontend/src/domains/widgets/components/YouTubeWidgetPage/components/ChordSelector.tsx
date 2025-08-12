'use client';

import React, { useState } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/shared/components/ui/dropdown-menu';

interface ChordSelectorProps {
  value: string;
  onChange: (value: string) => void;
  isActive?: boolean;
  onFocus?: () => void;
}

// Root notes with flats and sharps
const rootNotes = [
  { value: 'C', label: 'C' },
  { value: 'C#', label: 'C♯' },
  { value: 'Db', label: 'D♭' },
  { value: 'D', label: 'D' },
  { value: 'D#', label: 'D♯' },
  { value: 'Eb', label: 'E♭' },
  { value: 'E', label: 'E' },
  { value: 'F', label: 'F' },
  { value: 'F#', label: 'F♯' },
  { value: 'Gb', label: 'G♭' },
  { value: 'G', label: 'G' },
  { value: 'G#', label: 'G♯' },
  { value: 'Ab', label: 'A♭' },
  { value: 'A', label: 'A' },
  { value: 'A#', label: 'A♯' },
  { value: 'Bb', label: 'B♭' },
  { value: 'B', label: 'B' },
];

// Chord qualities
const chordQualities = [
  // Major variants
  { value: '', label: 'Major' },
  { value: 'maj7', label: 'maj7' },
  { value: 'maj9', label: 'maj9' },
  { value: 'maj13', label: 'maj13' },
  { value: '6', label: '6' },
  { value: '6/9', label: '6/9' },
  { value: 'add9', label: 'add9' },
  // Minor variants
  { value: 'm', label: 'minor' },
  { value: 'm7', label: 'm7' },
  { value: 'm9', label: 'm9' },
  { value: 'm11', label: 'm11' },
  { value: 'm6', label: 'm6' },
  { value: 'm(maj7)', label: 'm(maj7)' },
  // Dominant variants
  { value: '7', label: '7' },
  { value: '9', label: '9' },
  { value: '11', label: '11' },
  { value: '13', label: '13' },
  { value: '7b5', label: '7♭5' },
  { value: '7#5', label: '7♯5' },
  { value: '7b9', label: '7♭9' },
  { value: '7#9', label: '7♯9' },
  // Other
  { value: 'dim', label: 'dim' },
  { value: 'dim7', label: 'dim7' },
  { value: 'aug', label: 'aug' },
  { value: 'sus2', label: 'sus2' },
  { value: 'sus4', label: 'sus4' },
  { value: '7sus4', label: '7sus4' },
];

export function ChordSelector({
  value,
  onChange,
  isActive = false,
  onFocus,
}: ChordSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSelectingRoot, setIsSelectingRoot] = useState(true);
  const [selectedRoot, setSelectedRoot] = useState('');

  // Parse current chord value
  const parseChord = (chord: string) => {
    if (!chord) return { root: '', quality: '' };

    // Check for sharp or flat
    let root = '';
    let quality = '';

    if (chord.length >= 2 && (chord[1] === '#' || chord[1] === 'b')) {
      root = chord.substring(0, 2);
      quality = chord.substring(2);
    } else {
      root = chord[0] || '';
      quality = chord.substring(1);
    }

    return { root, quality };
  };

  const { root: currentRoot } = parseChord(value);

  const handleRootSelect = (root: string) => {
    setSelectedRoot(root);
    setIsSelectingRoot(false);
    // Keep dropdown open for quality selection
  };

  const handleQualitySelect = (quality: string) => {
    const newChord = selectedRoot + quality;
    onChange(newChord);
    setIsSelectingRoot(true);
    setSelectedRoot('');
    setIsOpen(false); // Close dropdown after selection
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && onFocus) {
      onFocus();
    }
    if (!open) {
      setIsSelectingRoot(true);
      setSelectedRoot('');
    }
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          className={`w-12 h-8 text-xs font-mono text-center rounded-md border-0 outline-none transition-all duration-200 ${
            isActive
              ? 'bg-blue-500 text-white shadow-[inset_2px_2px_4px_rgba(0,0,0,0.3),inset_-2px_-2px_4px_rgba(255,255,255,0.2)]'
              : 'bg-slate-800 text-blue-300 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)]'
          }`}
        >
          {value || '—'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="bg-slate-800 border-slate-700">
        {isSelectingRoot ? (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-slate-400">
              Select Root Note
            </div>
            <DropdownMenuSeparator className="bg-slate-700" />
            {rootNotes.map((note) => (
              <DropdownMenuItem
                key={note.value}
                onSelect={(e) => {
                  e.preventDefault(); // Prevent dropdown from closing
                  handleRootSelect(note.value);
                }}
                className={`text-sm cursor-pointer ${
                  note.value === currentRoot
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {note.label}
              </DropdownMenuItem>
            ))}
          </>
        ) : (
          <>
            <div className="px-2 py-1.5 text-xs font-semibold text-slate-400">
              Select Chord Quality for {selectedRoot}
            </div>
            <DropdownMenuSeparator className="bg-slate-700" />
            {chordQualities.map((quality) => (
              <DropdownMenuItem
                key={quality.value}
                onSelect={() => handleQualitySelect(quality.value)}
                className="text-sm text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                {selectedRoot}
                {quality.label}
              </DropdownMenuItem>
            ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
