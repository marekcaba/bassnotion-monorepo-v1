'use client';

import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { MetronomeWidget } from './MetronomeWidget';
import { DrummerWidget } from './DrummerWidget';
import { BassLineWidget } from './BassLineWidget';
import { HarmonyWidget } from './HarmonyWidget';
import { UseWidgetPageStateReturn } from '@/domains/widgets/hooks/useWidgetPageState';

interface FourWidgetsCardProps {
  widgetState: UseWidgetPageStateReturn;
}

export function FourWidgetsCard({ widgetState }: FourWidgetsCardProps) {
  const { state, togglePlayback, setTempo, toggleWidgetVisibility, nextChord } =
    widgetState;

  const handlePatternChange = (
    _widget: 'drummer' | 'bassLine',
    _pattern: string,
  ) => {
    // This would be implemented in the global state hook
    // For now, we'll just log the change
    // Pattern changed
  };

  const handleProgressionChange = (_progression: string[]) => {
    // This would be implemented in the global state hook
    // For now, we'll just log the change
    // Harmony progression changed
  };

  return (
    <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 via-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
            <div className="w-6 h-6 bg-white rounded-sm opacity-90"></div>
          </div>
          <div>
            <CardTitle className="text-xl font-bold text-white">
              🎛️ Essential Widgets
            </CardTitle>
            <p className="text-slate-400">
              Metronome • Drummer • Bass Line • Harmony
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 pb-6 pt-0">
        {/* 4 Widgets in Vertical Stack (1x4) as specified */}
        <div className="space-y-4">
          {/* 1. Metronome Widget */}
          <MetronomeWidget
            bpm={state.widgets.metronome.bpm}
            isPlaying={state.isPlaying}
            isVisible={state.widgets.metronome.isVisible}
            onTogglePlay={togglePlayback}
            onBpmChange={setTempo}
            onToggleVisibility={() => toggleWidgetVisibility('metronome')}
          />

          {/* 2. Drummer Widget */}
          <DrummerWidget
            pattern={state.widgets.drummer.pattern}
            isPlaying={state.isPlaying}
            isVisible={state.widgets.drummer.isVisible}
            onPatternChange={(pattern) =>
              handlePatternChange('drummer', pattern)
            }
            onToggleVisibility={() => toggleWidgetVisibility('drummer')}
          />

          {/* 3. Bass Line Widget */}
          <BassLineWidget
            pattern={state.widgets.bassLine.pattern}
            isPlaying={state.isPlaying}
            isVisible={state.widgets.bassLine.isVisible}
            onPatternChange={(pattern) =>
              handlePatternChange('bassLine', pattern)
            }
            onToggleVisibility={() => toggleWidgetVisibility('bassLine')}
          />

          {/* 4. Harmony Widget */}
          <HarmonyWidget
            progression={state.widgets.harmony.progression}
            currentChord={state.widgets.harmony.currentChord}
            isPlaying={state.isPlaying}
            isVisible={state.widgets.harmony.isVisible}
            onNextChord={nextChord}
            onProgressionChange={handleProgressionChange}
            onToggleVisibility={() => toggleWidgetVisibility('harmony')}
          />
        </div>

        {/* Global Controls Section */}
        <div className="mt-6 p-4 bg-slate-700/30 rounded-lg">
          <h4 className="text-sm font-semibold text-white mb-3">
            Global Controls
          </h4>

          {/* Master Play/Pause and Sync Status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300">Master Playback:</span>
              <span
                className={`text-xs font-bold ${state.isPlaying ? 'text-green-400' : 'text-slate-400'}`}
              >
                {state.isPlaying ? 'PLAYING' : 'STOPPED'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-300">Sync:</span>
              <span
                className={`text-xs font-bold ${state.syncEnabled ? 'text-green-400' : 'text-red-400'}`}
                data-testid="sync-status"
              >
                {state.syncEnabled ? 'ON' : 'OFF'}
              </span>
            </div>
          </div>

          {/* Tempo Display */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-slate-300">Master Tempo:</span>
            <span
              className="text-sm font-bold text-white"
              data-testid="master-tempo"
            >
              {state.tempo} BPM
            </span>
          </div>

          {/* Volume Controls */}
          <div className="grid grid-cols-2 gap-2">
            <div className="text-xs">
              <span className="text-slate-300">Master:</span>
              <span className="text-white ml-1">{state.volume.master}%</span>
            </div>
            <div className="text-xs">
              <span className="text-slate-300">Metronome:</span>
              <span className="text-white ml-1">{state.volume.metronome}%</span>
            </div>
            <div className="text-xs">
              <span className="text-slate-300">Drums:</span>
              <span className="text-white ml-1">{state.volume.drums}%</span>
            </div>
            <div className="text-xs">
              <span className="text-slate-300">Bass:</span>
              <span className="text-white ml-1">{state.volume.bass}%</span>
            </div>
          </div>
        </div>

        {/* Widget Synchronization Status */}
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400">
            All widgets synchronized with fretboard visualizer
          </p>
          <div className="flex justify-center gap-2 mt-2">
            {['metronome', 'drummer', 'bassLine', 'harmony'].map((widget) => (
              <div
                key={widget}
                className={`w-2 h-2 rounded-full ${
                  state.widgets[widget as keyof typeof state.widgets].isVisible
                    ? 'bg-green-400'
                    : 'bg-slate-600'
                }`}
                title={`${widget} ${state.widgets[widget as keyof typeof state.widgets].isVisible ? 'visible' : 'hidden'}`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
