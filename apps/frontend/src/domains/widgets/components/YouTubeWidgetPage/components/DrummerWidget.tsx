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

const drummerPatterns = [
  { beat: 1, intensity: 'high', isActive: false },
  { beat: 2, intensity: 'medium', isActive: false },
  { beat: 3, intensity: 'low', isActive: false },
  { beat: 4, intensity: 'high', isActive: false },
  { beat: 5, intensity: 'medium', isActive: false },
  { beat: 6, intensity: 'medium', isActive: false },
  { beat: 7, intensity: 'low', isActive: false },
  { beat: 8, intensity: 'high', isActive: false },
];

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
    setPatterns((prev) =>
      prev.map((p, index) => ({
        ...p,
        isActive: index === currentBeat,
      })),
    );
  }, [currentBeat]);

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
                    <h3 className={`font-semibold text-sm transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-white'
                    }`}>
                      Drummer
                    </h3>
                    <p className={`text-xs transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-slate-400'
                    }`}>
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
                    {/* Compact beat dots in 2x2 grid */}
                    <div className="grid grid-cols-2 gap-1">
                      {patterns.slice(0, 4).map((p, idx) => (
                        <div
                          key={idx}
                          className={`w-2 h-2 rounded-full transition-all duration-200 ${
                            p.isActive
                              ? 'bg-orange-400 shadow-lg shadow-orange-400/50'
                              : p.intensity === 'high'
                              ? 'bg-orange-600'
                              : p.intensity === 'medium'
                              ? 'bg-orange-700'
                              : 'bg-slate-700'
                          }`}
                        />
                      ))}
                    </div>
                  </button>
                </>
              ) : (
                <>
                  {/* Settings content in single row */}
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-medium text-orange-400 whitespace-nowrap">Pattern</span>
                    <select
                      value={pattern}
                      onChange={(e) => onPatternChange(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs bg-slate-800 rounded-md shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] text-orange-400 border-0 outline-none"
                    >
                      {availablePatterns.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                    <div className="flex gap-1">
                      {patterns.slice(0, 2).map((p, idx) => (
                        <div
                          key={idx}
                          className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-mono transition-all duration-200 ${
                            p.isActive
                              ? 'bg-orange-400 text-white shadow-lg shadow-orange-400/50'
                              : p.intensity === 'high'
                              ? 'bg-orange-600 text-orange-200'
                              : p.intensity === 'medium'
                              ? 'bg-orange-700 text-orange-300'
                              : 'bg-slate-700 text-slate-500'
                          }`}
                        >
                          {p.beat}
                        </div>
                      ))}
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
