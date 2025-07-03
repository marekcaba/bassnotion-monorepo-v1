'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Volume2 } from 'lucide-react';
import { SyncedWidget } from '../base';
import type { SyncedWidgetRenderProps } from '../base';

interface MetronomeDot {
  id: number;
  isActive: boolean;
  isCurrent: boolean;
}

const initialDots: MetronomeDot[] = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1,
  isActive: i < 6, // First 6 dots are active
  isCurrent: i === 0, // First dot is current
}));

const drummerPatterns = [
  { beat: 1, intensity: 'high', color: 'bg-orange-500' },
  { beat: 2, intensity: 'medium', color: 'bg-orange-400' },
  { beat: 3, intensity: 'low', color: 'bg-orange-300' },
  { beat: 4, intensity: 'high', color: 'bg-orange-500' },
  { beat: 5, intensity: 'medium', color: 'bg-orange-400' },
  { beat: 6, intensity: 'medium', color: 'bg-orange-400' },
  { beat: 7, intensity: 'low', color: 'bg-orange-300' },
  { beat: 8, intensity: 'high', color: 'bg-orange-500' },
];

const basslineNotes = [
  { position: 1, note: 'C', isActive: true, color: 'bg-blue-500' },
  { position: 2, note: 'E', isActive: false, color: 'bg-blue-400' },
  { position: 3, note: 'G', isActive: true, color: 'bg-blue-500' },
  { position: 4, note: 'B', isActive: false, color: 'bg-blue-400' },
  { position: 5, note: 'D', isActive: true, color: 'bg-blue-500' },
  { position: 6, note: 'F', isActive: false, color: 'bg-blue-400' },
  { position: 7, note: 'A', isActive: false, color: 'bg-blue-400' },
  { position: 8, note: 'C', isActive: true, color: 'bg-blue-500' },
];

const harmonyChords = ['C', 'Am', 'F', 'G'];

export function SubwidgetsCard() {
  return (
    <SyncedWidget
      widgetId="subwidgets-card"
      widgetName="Practice Subwidgets"
      debugMode={false}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <SubwidgetsCardContent syncProps={syncProps} />
      )}
    </SyncedWidget>
  );
}

interface SubwidgetsCardContentProps {
  syncProps: SyncedWidgetRenderProps;
}

function SubwidgetsCardContent({ syncProps }: SubwidgetsCardContentProps) {
  const [metronomeDots, setMetronomeDots] = useState(initialDots);
  const [currentChord, setCurrentChord] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  // Sync with global playback state
  useEffect(() => {
    const globalIsPlaying = syncProps.isPlaying;
    if (globalIsPlaying !== isPlaying) {
      setIsPlaying(globalIsPlaying);
    }
  }, [syncProps.isPlaying, isPlaying]);

  // Sync tempo with global state
  useEffect(() => {
    const globalTempo = syncProps.tempo;
    if (globalTempo && globalTempo !== 100) {
      // Update metronome tempo display or BPM logic here
      console.log(`🎵 SubwidgetsCard: Tempo synced to ${globalTempo} BPM`);
    }
  }, [syncProps.tempo]);

  // Simulate metronome animation synced with global playback
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setMetronomeDots((prev) => {
        const currentIndex = prev.findIndex((dot) => dot.isCurrent);
        const nextIndex =
          (currentIndex + 1) % prev.filter((dot) => dot.isActive).length;

        return prev.map((dot, index) => ({
          ...dot,
          isCurrent: dot.isActive && index === nextIndex,
        }));
      });
    }, 500);

    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleMetronomeToggle = () => {
    const newPlayingState = !isPlaying;
    setIsPlaying(newPlayingState);

    // Emit sync event for playback state change
    syncProps.sync.actions.emitEvent(
      'PLAYBACK_STATE',
      { isPlaying: newPlayingState },
      'normal',
    );
  };

  const _handleTempoChange = (newTempo: number) => {
    // Emit sync event for tempo change
    syncProps.sync.actions.emitEvent(
      'TEMPO_CHANGE',
      { tempo: newTempo },
      'normal',
    );
  };

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Metronome Widget */}
      <Card
        className="bg-emerald-900/30 backdrop-blur-xl border border-emerald-700/50 shadow-lg hover:shadow-emerald-500/10 transition-all duration-300 cursor-pointer"
        // TODO: Review non-null assertion - consider null safety
        onClick={handleMetronomeToggle}
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Metronome</h3>
              <p className="text-xs text-emerald-200">100 BPM</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {metronomeDots.map((dot) => (
              <div
                key={dot.id}
                className={`
                  w-4 h-4 rounded-full transition-all duration-200
                  ${
                    dot.isActive
                      ? dot.isCurrent
                        ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50 scale-125'
                        : 'bg-emerald-600/70'
                      : 'bg-slate-700/50'
                  }
                `}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Drummer Widget */}
      <Card className="bg-orange-900/30 backdrop-blur-xl border border-orange-700/50 shadow-lg hover:shadow-orange-500/10 transition-all duration-300 cursor-pointer">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Drummer</h3>
              <p className="text-xs text-orange-200">Jazz Swing</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1">
            {drummerPatterns.map((pattern, index) => (
              <div key={index} className="flex flex-col gap-1">
                <div
                  className={`
                    w-full h-2 rounded-sm transition-all duration-200
                    ${pattern.color}
                    ${
                      pattern.intensity === 'high'
                        ? 'opacity-100'
                        : pattern.intensity === 'medium'
                          ? 'opacity-70'
                          : 'opacity-40'
                    }
                  `}
                />
                <div
                  className={`
                    w-full h-1 rounded-sm
                    ${pattern.color}
                    ${
                      pattern.intensity === 'high'
                        ? 'opacity-80'
                        : pattern.intensity === 'medium'
                          ? 'opacity-50'
                          : 'opacity-20'
                    }
                  `}
                />
                <div
                  className={`
                    w-full h-1 rounded-sm
                    ${pattern.color}
                    ${pattern.intensity === 'high' ? 'opacity-60' : 'opacity-10'}
                  `}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bass Line Widget */}
      <Card className="bg-blue-900/30 backdrop-blur-xl border border-blue-700/50 shadow-lg hover:shadow-blue-500/10 transition-all duration-300 cursor-pointer">
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Bass Line</h3>
              <p className="text-xs text-blue-200">Modal Walking...</p>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            {basslineNotes.slice(0, 8).map((note, index) => (
              <div key={index} className="flex flex-col items-center gap-1">
                <div
                  className={`
                    w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold text-white
                    transition-all duration-200
                    ${note.color}
                    ${note.isActive ? 'shadow-lg scale-110' : 'opacity-50'}
                  `}
                >
                  {index < 4 ? note.note.charAt(0) : ''}
                </div>
                <div
                  className={`
                    w-1 h-2 rounded-full
                    ${note.color}
                    ${note.isActive ? 'opacity-100' : 'opacity-30'}
                  `}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Harmony Widget */}
      <Card
        className="bg-purple-900/30 backdrop-blur-xl border border-purple-700/50 shadow-lg hover:shadow-purple-500/10 transition-all duration-300 cursor-pointer"
        onClick={() =>
          setCurrentChord((prev) => (prev + 1) % harmonyChords.length)
        }
      >
        <CardContent className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
              <Volume2 className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Harmony</h3>
              <p className="text-xs text-purple-200">Dm7 - G7 - CMaj7</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {harmonyChords.map((chord, index) => (
              <div
                key={index}
                className={`
                  h-8 rounded-lg flex items-center justify-center text-sm font-bold
                  transition-all duration-300
                  ${
                    index === currentChord
                      ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/30 scale-105'
                      : 'bg-purple-800/40 text-purple-200 hover:bg-purple-700/60'
                  }
                `}
              >
                {chord}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
