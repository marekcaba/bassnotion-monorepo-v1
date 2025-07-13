'use client';

import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
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
    <Card className="bg-transparent border-transparent shadow-none">
      <CardContent className="px-0 pb-6 pt-0">
        {/* 4 Widgets in Vertical Stack (1x4) as specified */}
        <div className="space-y-2">
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
