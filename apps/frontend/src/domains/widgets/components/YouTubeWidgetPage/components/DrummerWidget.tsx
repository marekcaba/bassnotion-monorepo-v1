'use client';

import React, { useEffect, useState } from 'react';
import { VolumeKnob } from './VolumeKnob';

interface DrummerWidgetProps {
  pattern: string;
  isPlaying: boolean;
  isVisible: boolean;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility: () => void;
  onTogglePlay?: () => void;
}

// Drum pattern data structure: 3 rows (HH, SN, K) x 8 columns
const drummerPatterns = {
  hihat: Array.from({ length: 8 }, (_, i) => ({
    beat: i + 1,
    isActive: i % 2 === 0,
    intensity: 'medium',
  })),
  snare: Array.from({ length: 8 }, (_, i) => ({
    beat: i + 1,
    isActive: i === 1 || i === 5,
    intensity: 'high',
  })),
  kick: Array.from({ length: 8 }, (_, i) => ({
    beat: i + 1,
    isActive: i === 0 || i === 3 || i === 6,
    intensity: 'high',
  })),
};

const availablePatterns = [
  'Jazz Swing',
  'Rock Steady',
  'Bossa Nova',
  'Funk Groove',
  'Latin',
  'Shuffle',
];

export function DrummerWidget({
  pattern,
  isPlaying,
  isVisible,
  onPatternChange,
  onToggleVisibility,
  onTogglePlay,
}: DrummerWidgetProps) {
  const [currentBeat, setCurrentBeat] = useState(0);
  const [patterns, setPatterns] = useState(drummerPatterns);
  const [isExpanded, setIsExpanded] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  // Animate drum pattern based on playback
  useEffect(() => {
    if (!isPlaying) {
      setPatterns(drummerPatterns);
      return;
    }

    const interval = setInterval(() => {
      setCurrentBeat((prev) => (prev + 1) % 8);
    }, 500); // Sync with metronome timing

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Update pattern visualization based on current beat
  useEffect(() => {
    setPatterns((prev) => {
      const newPatterns = { ...prev };
      // Update the active beat for all drum parts
      (Object.keys(newPatterns) as Array<keyof typeof newPatterns>).forEach(
        (part) => {
          newPatterns[part] = newPatterns[part].map((beat, index) => ({
            ...beat,
            isActive: index === currentBeat,
          }));
        },
      );
      return newPatterns;
    });
  }, [currentBeat]);

  if (!isVisible) return null;

  return (
    <div
      className={`relative bg-slate-800 rounded-2xl px-4 py-1 h-24 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 select-none ${
        volume === 0 || isMuted ? 'bg-slate-850 grayscale brightness-100' : ''
      }`}
    >
      <div className="flex items-center justify-between h-full">
        {/* Volume Knob */}
        <div className="flex justify-center items-center w-20 h-16">
          <VolumeKnob
            value={volume}
            onChange={(val) => {
              console.log('Drummer volume:', val);
              setVolume(val);
              if (val > 0) {
                setIsMuted(false);
              }
            }}
            color="bg-orange-400"
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
                  <h3
                    className={`font-semibold text-sm transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-white'
                    }`}
                  >
                    Drummer
                  </h3>
                  <p
                    className={`text-xs transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {pattern}
                  </p>
                </div>

                {/* Clickable Indicator */}
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                    volume === 0 ? 'opacity-50' : ''
                  }`}
                >
                  {/* Compact beat dots in 3x8 grid (3 rows, 8 beats each) */}
                  <div className="grid grid-rows-3 grid-cols-8 gap-1">
                    {/* Hi-hat row */}
                    {patterns.hihat?.map((beat, idx) => (
                      <div
                        key={`hh-${idx}`}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          beat.isActive
                            ? currentBeat === idx && isPlaying
                              ? 'bg-orange-200 shadow-lg shadow-orange-200/50'
                              : 'bg-orange-500'
                            : 'bg-slate-700'
                        }`}
                      />
                    )) || []}

                    {/* Snare row */}
                    {patterns.snare?.map((beat, idx) => (
                      <div
                        key={`sn-${idx}`}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          beat.isActive
                            ? currentBeat === idx && isPlaying
                              ? 'bg-orange-200 shadow-lg shadow-orange-200/50'
                              : 'bg-orange-500'
                            : 'bg-slate-700'
                        }`}
                      />
                    )) || []}

                    {/* Kick row */}
                    {patterns.kick?.map((beat, idx) => (
                      <div
                        key={`k-${idx}`}
                        className={`w-2 h-2 rounded-full transition-all duration-200 ${
                          beat.isActive
                            ? currentBeat === idx && isPlaying
                              ? 'bg-orange-200 shadow-lg shadow-orange-200/50'
                              : 'bg-orange-500'
                            : 'bg-slate-700'
                        }`}
                      />
                    )) || []}
                  </div>
                </button>
              </>
            ) : (
              <>
                {/* Settings content - 3 rows of drum patterns */}
                <div className="flex flex-col gap-3 flex-1 justify-center items-center">
                  {/* Drum pattern grid - 3 rows x 8 columns */}
                  <div className="space-y-2">
                    {/* Hi-hat row */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-orange-400 w-6">
                        HH
                      </span>
                      <div className="grid grid-cols-8 gap-1">
                        {patterns.hihat.map((beat, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              const newPatterns = { ...patterns };
                              if (newPatterns.hihat && newPatterns.hihat[i]) {
                                newPatterns.hihat[i].isActive =
                                  !newPatterns.hihat[i].isActive;
                                setPatterns(newPatterns);
                              }
                            }}
                            className={`w-4 h-4 rounded-full transition-all duration-200 ${
                              beat.isActive
                                ? currentBeat === i && isPlaying
                                  ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                                  : 'bg-orange-500 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)]'
                                : 'bg-slate-700 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Snare row */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-orange-400 w-6">
                        SN
                      </span>
                      <div className="grid grid-cols-8 gap-1">
                        {patterns.snare.map((beat, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              const newPatterns = { ...patterns };
                              if (newPatterns.snare && newPatterns.snare[i]) {
                                newPatterns.snare[i].isActive =
                                  !newPatterns.snare[i].isActive;
                                setPatterns(newPatterns);
                              }
                            }}
                            className={`w-4 h-4 rounded-full transition-all duration-200 ${
                              beat.isActive
                                ? currentBeat === i && isPlaying
                                  ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                                  : 'bg-orange-500 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)]'
                                : 'bg-slate-700 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)]'
                            }`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Kick row */}
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-mono text-orange-400 w-6">
                        K
                      </span>
                      <div className="grid grid-cols-8 gap-1">
                        {patterns.kick.map((beat, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              const newPatterns = { ...patterns };
                              if (newPatterns.kick && newPatterns.kick[i]) {
                                newPatterns.kick[i].isActive =
                                  !newPatterns.kick[i].isActive;
                                setPatterns(newPatterns);
                              }
                            }}
                            className={`w-4 h-4 rounded-full transition-all duration-200 ${
                              beat.isActive
                                ? currentBeat === i && isPlaying
                                  ? 'bg-orange-300 shadow-lg shadow-orange-300/50'
                                  : 'bg-orange-500 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)]'
                                : 'bg-slate-700 shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)]'
                            }`}
                          />
                        ))}
                      </div>
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
