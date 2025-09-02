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
  const { state, setTempo, toggleWidgetVisibility, selectedExercise } =
    widgetState;

  // Use useCallback to prevent recreating handlers on every render
  const handlePatternChange = React.useCallback(
    (widget: 'drummer' | 'bassLine', pattern: string) => {
      // Update the widget state
      if (widget === 'drummer') {
        widgetState.setState((prev) => ({
          ...prev,
          widgets: {
            ...prev.widgets,
            drummer: { ...prev.widgets.drummer, pattern },
          },
        }));
      } else if (widget === 'bassLine') {
        widgetState.setState((prev) => ({
          ...prev,
          widgets: {
            ...prev.widgets,
            bassLine: { ...prev.widgets.bassLine, pattern },
          },
        }));
      }
    },
    [widgetState],
  );

  const handleProgressionChange = React.useCallback(
    (progression: string[]) => {
      // Update harmony widget progression
      widgetState.setState((prev) => ({
        ...prev,
        widgets: {
          ...prev.widgets,
          harmony: { ...prev.widgets.harmony, progression },
        },
      }));
    },
    [widgetState],
  );

  // Memoize the onNextChord handler to prevent infinite re-renders
  const handleNextChord = React.useCallback(() => {
    // Update current chord index
    widgetState.setState((prev) => ({
      ...prev,
      widgets: {
        ...prev.widgets,
        harmony: {
          ...prev.widgets.harmony,
          currentChord:
            ((prev.widgets.harmony.currentChord || 0) + 1) %
            prev.widgets.harmony.progression.length,
        },
      },
    }));
  }, [widgetState]);

  return (
    <Card className="bg-transparent border-transparent shadow-none">
      <CardContent className="px-0 pb-6 pt-0">
        {/* 4 Widgets in Vertical Stack (1x4) as specified */}
        <div className="space-y-2">
          {/* 1. Metronome Widget */}
          <MetronomeWidget
            bpm={state.widgets.metronome.bpm}
            isVisible={state.widgets.metronome.isVisible}
            isPlaying={state.isPlaying}
            onBpmChange={setTempo}
            onToggleVisibility={() => toggleWidgetVisibility('metronome')}
          />

          {/* 2. Drummer Widget */}
          <DrummerWidget
            pattern={state.widgets.drummer.pattern}
            isVisible={state.widgets.drummer.isVisible}
            isPlaying={state.isPlaying}
            exercise={selectedExercise}
            tempo={state.widgets.metronome.bpm}
            onPatternChange={(pattern) =>
              handlePatternChange('drummer', pattern)
            }
            onToggleVisibility={() => toggleWidgetVisibility('drummer')}
          />

          {/* 3. Bass Line Widget */}
          <BassLineWidget
            pattern={state.widgets.bassLine.pattern}
            isVisible={state.widgets.bassLine.isVisible}
            isPlaying={state.isPlaying}
            exercise={selectedExercise}
            tempo={state.widgets.metronome.bpm}
            onPatternChange={(pattern) =>
              handlePatternChange('bassLine', pattern)
            }
            onToggleVisibility={() => toggleWidgetVisibility('bassLine')}
          />

          {/* 4. Harmony Widget */}
          <HarmonyWidget
            progression={state.widgets.harmony.progression}
            currentChord={state.widgets.harmony.currentChord || 0}
            isVisible={state.widgets.harmony.isVisible}
            isPlaying={state.isPlaying}
            onNextChord={handleNextChord}
            onProgressionChange={handleProgressionChange}
            onToggleVisibility={() => toggleWidgetVisibility('harmony')}
          />
        </div>

        {/* Widget Synchronization Status */}
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400">
            All widgets synchronized with fretboard visualizer (Track System)
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
