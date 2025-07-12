'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SyncedWidget } from '../../base';
import type { SyncedWidgetRenderProps } from '../../base';
import { VolumeKnob } from './VolumeKnob';

interface HarmonyWidgetProps {
  progression: string[];
  currentChord: number;
  isPlaying: boolean;
  isVisible: boolean;
  onNextChord: () => void;
  onProgressionChange: (progression: string[]) => void;
  onToggleVisibility: () => void;
  onTogglePlay?: () => void;
}

const chordProgressions = {
  'Jazz Standard': ['Dm7', 'G7', 'CMaj7', 'Am7'],
  'Blues in C': ['C7', 'F7', 'C7', 'G7'],
  'Pop Progression': ['C', 'G', 'Am', 'F'],
  'Modal Jazz': ['Dm7', 'Em7', 'FMaj7', 'G7'],
  'Bossa Nova': ['CMaj7', 'Dm7', 'G7', 'Em7'],
  'Funk Groove': ['Dm7', 'Dm7', 'G7', 'G7'],
};

// Legacy props interface for backward compatibility
export function HarmonyWidget({
  progression,
  currentChord,
  isPlaying,
  isVisible,
  onNextChord,
  onProgressionChange,
  onToggleVisibility,
  onTogglePlay,
}: HarmonyWidgetProps) {
  return (
    <SyncedWidget
      widgetId="harmony-widget"
      widgetName="Harmony"
      debugMode={false}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <HarmonyWidgetContent
          progression={progression}
          currentChord={currentChord}
          isPlaying={isPlaying}
          isVisible={isVisible}
          onNextChord={onNextChord}
          onProgressionChange={onProgressionChange}
          onToggleVisibility={onToggleVisibility}
          onTogglePlay={onTogglePlay}
          syncProps={syncProps}
        />
      )}
    </SyncedWidget>
  );
}

// Internal content component that handles sync events
interface HarmonyWidgetContentProps extends HarmonyWidgetProps {
  syncProps: SyncedWidgetRenderProps;
}

function HarmonyWidgetContent({
  progression: initialProgression,
  currentChord: initialCurrentChord,
  isPlaying,
  isVisible,
  onNextChord,
  onProgressionChange,
  onToggleVisibility,
  onTogglePlay,
  syncProps,
}: HarmonyWidgetContentProps) {
  // Local state for progression and current chord that can be updated by sync events
  const [progression, setProgression] = useState(initialProgression);
  const [currentChord, setCurrentChord] = useState(initialCurrentChord);
  const [isExpanded, setIsExpanded] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);

  // Use refs to track previous values and prevent infinite loops
  const prevSelectedExerciseRef = useRef<any>(null);
  const prevProgressionRef = useRef<string[]>(initialProgression);

  // Watch for exercise changes in sync state
  useEffect(() => {
    const selectedExercise = syncProps.sync.selectedExercise;

    // Only update if the exercise actually changed
    if (
      selectedExercise &&
      selectedExercise !== prevSelectedExerciseRef.current
    ) {
      prevSelectedExerciseRef.current = selectedExercise;

      if (
        selectedExercise?.chord_progression &&
        Array.isArray(selectedExercise.chord_progression)
      ) {
        const newProgression = selectedExercise.chord_progression;

        // Only update if the progression is actually different
        if (
          JSON.stringify(newProgression) !==
          JSON.stringify(prevProgressionRef.current)
        ) {
          console.log(
            '🎼 HarmonyWidget: Updating progression from exercise:',
            newProgression,
          );

          setProgression(newProgression);
          setCurrentChord(0); // Reset to first chord
          prevProgressionRef.current = newProgression;

          // Only call onProgressionChange if it's different from current progression
          if (JSON.stringify(newProgression) !== JSON.stringify(progression)) {
            onProgressionChange?.(newProgression);
          }
        }
      }
    }
  }, [syncProps.sync.selectedExercise]); // Removed onProgressionChange from dependencies

  // Update local state when props change (for backward compatibility)
  useEffect(() => {
    if (
      JSON.stringify(initialProgression) !==
      JSON.stringify(prevProgressionRef.current)
    ) {
      setProgression(initialProgression);
      prevProgressionRef.current = initialProgression;
    }
  }, [initialProgression]);

  useEffect(() => {
    setCurrentChord(initialCurrentChord);
  }, [initialCurrentChord]);

  // Enhanced progression change that emits sync events
  const handleSyncProgressionChange = useCallback(
    (newProgression: string[]) => {
      setProgression(newProgression);
      setCurrentChord(0);
      onProgressionChange?.(newProgression);

      // Emit sync event for other widgets
      syncProps.sync.actions.emitEvent(
        'CUSTOM_BASSLINE',
        {
          chordProgression: newProgression,
          currentChord: 0,
          source: 'harmony-widget',
          reason: 'progression-change',
        },
        'normal',
      );
    },
    [onProgressionChange, syncProps.sync.actions],
  );

  const currentProgressionName =
    Object.keys(chordProgressions).find(
      (key) =>
        JSON.stringify(
          chordProgressions[key as keyof typeof chordProgressions],
        ) === JSON.stringify(progression),
    ) || 'Custom';

  // Auto-advance chords when playing
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      onNextChord();
    }, 2000); // Change chord every 2 seconds

    return () => clearInterval(interval);
  }, [isPlaying, onNextChord]);

  const handleProgressionDropdownChange = (progressionName: string) => {
    if (progressionName in chordProgressions) {
      const newProgression =
        chordProgressions[progressionName as keyof typeof chordProgressions];
      handleSyncProgressionChange(newProgression);
    }
  };

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
                console.log('Harmony volume:', val);
                setVolume(val);
                if (val > 0) {
                  setIsMuted(false);
                }
              }} 
              color="bg-blue-400"
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
                      Harmony
                    </h3>
                    <p className={`text-xs transition-all duration-300 ${
                      volume === 0 ? 'text-slate-600' : 'text-slate-400'
                    }`}>
                      {progression[currentChord]} - {currentProgressionName.length > 12 ? currentProgressionName.substring(0, 12) + '...' : currentProgressionName}
                    </p>
                  </div>
                  
                  {/* Clickable Indicator */}
                  <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-800 shadow-[5px_5px_10px_rgba(0,0,0,0.5),-5px_-5px_10px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 cursor-pointer ${
                      volume === 0 ? 'opacity-50' : ''
                    }`}
                  >
                    {/* Compact chord display */}
                    <div className="flex gap-1 text-xs font-mono">
                      {progression.slice(0, 4).map((chord, idx) => (
                        <span
                          key={idx}
                          className={`transition-all duration-200 ${
                            idx === currentChord
                              ? 'text-blue-400 font-bold'
                              : 'text-slate-500'
                          }`}
                        >
                          {chord.length > 3 ? chord.substring(0, 3) : chord}
                        </span>
                      ))}
                    </div>
                  </button>
                </>
              ) : (
                <>
                  {/* Settings content in single row */}
                  <div className="flex items-center gap-2 flex-1">
                    <span className="text-xs font-medium text-blue-400 whitespace-nowrap">Progression</span>
                    <select
                      value={currentProgressionName}
                      onChange={(e) => handleProgressionDropdownChange(e.target.value)}
                      className="flex-1 px-2 py-1 text-xs bg-slate-800 rounded-md shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)] text-blue-400 border-0 outline-none"
                    >
                      {Object.keys(chordProgressions).map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-bold text-blue-400">{progression[currentChord]}</span>
                      <div className="flex gap-1">
                        {progression.slice(0, 2).map((chord, index) => (
                          <button
                            key={index}
                            onClick={() => {
                              setCurrentChord(index);
                              onNextChord();
                            }}
                            className={`w-4 h-4 rounded text-xs font-medium transition-all duration-200 ${
                              index === currentChord
                                ? 'bg-blue-500 text-white shadow-[inset_1px_1px_2px_rgba(0,0,0,0.3),inset_-1px_-1px_2px_rgba(255,255,255,0.2)]'
                                : 'bg-slate-800 text-blue-300 shadow-[2px_2px_4px_rgba(0,0,0,0.5),-2px_-2px_4px_rgba(255,255,255,0.1)] hover:shadow-[inset_1px_1px_2px_rgba(0,0,0,0.5),inset_-1px_-1px_2px_rgba(255,255,255,0.1)]'
                            }`}
                          >
                            {chord.substring(0, 2)}
                          </button>
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
