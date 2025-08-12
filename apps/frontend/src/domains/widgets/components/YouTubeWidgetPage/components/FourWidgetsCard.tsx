'use client';

import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { MetronomeWidgetV2 } from './MetronomeWidgetV2';
import { DrummerWidgetV2 } from './DrummerWidgetV2';
import { BassLineWidgetV2 } from './BassLineWidgetV2';
import { HarmonyWidgetV2 } from './HarmonyWidgetV2';
import { UseWidgetPageStateReturn } from '@/domains/widgets/hooks/useWidgetPageState';

interface FourWidgetsCardProps {
  widgetState: UseWidgetPageStateReturn;
}

export function FourWidgetsCard({ widgetState }: FourWidgetsCardProps) {
  const { state, setTempo, toggleWidgetVisibility, selectedExercise } =
    widgetState;

  const handlePatternChange = (
    widget: 'drummer' | 'bassLine',
    pattern: string,
  ) => {
    // Update the widget state
    if (widget === 'drummer') {
      widgetState.setState(prev => ({
        ...prev,
        widgets: {
          ...prev.widgets,
          drummer: { ...prev.widgets.drummer, pattern }
        }
      }));
    } else if (widget === 'bassLine') {
      widgetState.setState(prev => ({
        ...prev,
        widgets: {
          ...prev.widgets,
          bassLine: { ...prev.widgets.bassLine, pattern }
        }
      }));
    }
  };

  const handleProgressionChange = (progression: string[]) => {
    // Update harmony widget progression
    widgetState.setState(prev => ({
      ...prev,
      widgets: {
        ...prev.widgets,
        harmony: { ...prev.widgets.harmony, progression }
      }
    }));
  };

  return (
    <Card className="bg-transparent border-transparent shadow-none">
      <CardContent className="px-0 pb-6 pt-0">
        {/* 4 Widgets in Vertical Stack (1x4) as specified */}
        <div className="space-y-2">
          {/* 1. Metronome Widget V2 */}
          <MetronomeWidgetV2
            bpm={state.widgets.metronome.bpm}
            isVisible={state.widgets.metronome.isVisible}
            isPlaying={state.isPlaying}
            onBpmChange={setTempo}
            onToggleVisibility={() => toggleWidgetVisibility('metronome')}
          />

          {/* 2. Drummer Widget V2 */}
          <DrummerWidgetV2
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

          {/* 3. Bass Line Widget V2 */}
          <BassLineWidgetV2
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

          {/* 4. Harmony Widget V2 */}
          <HarmonyWidgetV2
            progression={state.widgets.harmony.progression}
            isVisible={state.widgets.harmony.isVisible}
            isPlaying={state.isPlaying}
            exercise={selectedExercise}
            tempo={state.widgets.metronome.bpm}
            onProgressionChange={handleProgressionChange}
            onToggleVisibility={() => toggleWidgetVisibility('harmony')}
          />
        </div>

        {/* Widget Synchronization Status */}
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400">
            All widgets synchronized with fretboard visualizer (Track System V2)
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
