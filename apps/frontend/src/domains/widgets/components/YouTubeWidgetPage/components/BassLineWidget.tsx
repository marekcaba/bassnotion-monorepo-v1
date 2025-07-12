'use client';

import React, { useEffect, useState } from 'react';
import { VolumeKnob } from './VolumeKnob';

interface BassLineWidgetProps {
  pattern: string;
  isPlaying: boolean;
  isVisible: boolean;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility: () => void;
  onTogglePlay?: () => void;
}

const basslineNotes = [
  {
    position: 1,
    note: 'D',
    fret: 5,
    string: 4,
    isActive: false,
    color: 'bg-blue-500',
  },
  {
    position: 2,
    note: 'E',
    fret: 7,
    string: 4,
    isActive: false,
    color: 'bg-blue-400',
  },
  {
    position: 3,
    note: 'F',
    fret: 8,
    string: 4,
    isActive: false,
    color: 'bg-blue-500',
  },
  {
    position: 4,
    note: 'G',
    fret: 10,
    string: 4,
    isActive: false,
    color: 'bg-blue-400',
  },
  {
    position: 5,
    note: 'A',
    fret: 12,
    string: 4,
    isActive: false,
    color: 'bg-blue-500',
  },
  {
    position: 6,
    note: 'B',
    fret: 14,
    string: 4,
    isActive: false,
    color: 'bg-blue-400',
  },
  {
    position: 7,
    note: 'C',
    fret: 15,
    string: 4,
    isActive: false,
    color: 'bg-blue-500',
  },
  {
    position: 8,
    note: 'D',
    fret: 17,
    string: 4,
    isActive: false,
    color: 'bg-blue-400',
  },
];

const availablePatterns = [
  'Modal Walking',
  'Chromatic Walk',
  'Pentatonic Run',
  'Scale Sequence',
  'Arpeggiated',
  'Rhythmic Pattern',
];

export function BassLineWidget({
  pattern,
  isPlaying,
  isVisible,
  onPatternChange,
  onToggleVisibility,
  onTogglePlay,
}: BassLineWidgetProps) {
  const [currentNote, setCurrentNote] = useState(0);
  const [notes, setNotes] = useState(basslineNotes);
  const [isExpanded, setIsExpanded] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  // Animate bassline pattern based on playback
  useEffect(() => {
    if (!isPlaying) {
      setNotes(basslineNotes);
      return;
    }

    const interval = setInterval(() => {
      setCurrentNote((prev) => (prev + 1) % basslineNotes.length);
    }, 500); // Sync with metronome timing

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Update note visualization based on current note
  useEffect(() => {
    setNotes((prev) =>
      prev.map((note, index) => ({
        ...note,
        isActive: index === currentNote,
      })),
    );
  }, [currentNote]);

  if (!isVisible) return null;

  return (
    <div className={`relative bg-slate-800 rounded-2xl px-4 py-1 h-24 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 select-none ${
      volume === 0 || isMuted ? 'bg-slate-850 grayscale brightness-100' : ''
    }`}>
        <div className="flex items-center justify-between h-full">
          {/* Volume Knob */}
          <div className="flex justify-center items-center w-20 h-16">
            <VolumeKnob 
              value={volume} 
              onChange={(val) => {
                console.log('Bass Line volume:', val);
                setVolume(val);
                if (val > 0) {
                  setIsMuted(false);
                }
              }} 
              color="bg-purple-400"
              size={45}
              isMuted={isMuted}
              onMuteToggle={() => {
                setIsMuted(!isMuted);
              }}
            />
          </div>
          
          {/* Title/Subtitle OR Settings Panel */}
          <div className="flex-1">
            <div className="flex items-center justify-between px-4 py-2">
              {!isExpanded ? (
                <>
                  {/* Title and Subtitle */}
                  <div className="flex-1">
                    <h3 className={`font-semibold text-sm transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-white'
                    }`}>
                      Bass Line
                    </h3>
                    <p className={`text-xs transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      {pattern.length > 15 ? pattern.substring(0, 15) + '...' : pattern}
                    </p>
                  </div>
                  
                  {/* Clickable Indicator */}
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                      volume === 0 ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Compact note dots in 2x2 grid */}
                    <div className="grid grid-cols-2 gap-1">
                      {notes.slice(0, 4).map((note, idx) => (
                        <div
                          key={idx}
                          className={`w-2 h-2 rounded-full transition-all duration-200 ${
                            note.isActive
                              ? 'bg-purple-400 shadow-lg shadow-purple-400/50'
                              : idx % 2 === 0
                              ? 'bg-purple-600'
                              : 'bg-purple-700'
                          }`}
                        />
                      ))}
                    </div>
                    {/* Small note indicator */}
                    <span className="text-xs text-purple-400 font-mono">
                      {notes[currentNote]?.note}
                    </span>
                  </button>
                </>
              ) : (
                <>
                  {/* Settings content in single row */}
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-medium text-purple-400 whitespace-nowrap">Pattern</span>
                    <select
                      value={pattern}
                      onChange={(e) => onPatternChange(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs bg-slate-800 rounded-md shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] text-purple-400 border-0 outline-none"
                    >
                      {availablePatterns.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-purple-400">{notes[currentNote]?.note}</span>
                      <div className="flex gap-1">
                        {notes.slice(0, 2).map((note, index) => (
                          <div
                            key={index}
                            className={`w-3 h-3 rounded-full transition-all duration-200 ${
                              note.isActive
                                ? 'bg-purple-400 shadow-lg shadow-purple-400/50'
                                : 'bg-slate-700'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="w-5 h-5 rounded-md bg-slate-800 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] transition-all duration-200 text-slate-400 text-xs flex items-center justify-center ml-4"
                    title="Close settings"
                  >
                    ×
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        
      </div>
  );
}
