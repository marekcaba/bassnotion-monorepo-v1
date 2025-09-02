'use client';

import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { MetronomeWidget } from './MetronomeWidget';
import { DrummerWidget } from './DrummerWidget';
import { BassLineWidget } from './BassLineWidget';
import { HarmonyWidget } from './HarmonyWidget';
import { UseWidgetPageStateReturn } from '@/domains/widgets/hooks/useWidgetPageState';

interface FourWidgetsCardFixedProps {
  widgetState: UseWidgetPageStateReturn;
}

export function FourWidgetsCardFixed({
  widgetState,
}: FourWidgetsCardFixedProps) {
  const { state, setTempo, toggleWidgetVisibility } = widgetState;

  // Use useCallback to prevent recreating these handlers on every render
  const handleDrummerPatternChange = React.useCallback(
    (pattern: string) => {
      widgetState.setState((prev) => ({
        ...prev,
        widgets: {
          ...prev.widgets,
          drummer: { ...prev.widgets.drummer, pattern },
        },
      }));
    },
    [widgetState],
  );

  const handleBassPatternChange = React.useCallback(
    (pattern: string) => {
      widgetState.setState((prev) => ({
        ...prev,
        widgets: {
          ...prev.widgets,
          bassLine: { ...prev.widgets.bassLine, pattern },
        },
      }));
    },
    [widgetState],
  );

  const handleHarmonyPatternChange = React.useCallback(
    (pattern: string) => {
      widgetState.setState((prev) => ({
        ...prev,
        widgets: {
          ...prev.widgets,
          harmony: { ...prev.widgets.harmony, pattern },
        },
      }));
    },
    [widgetState],
  );

  return (
    <Card className="bg-transparent border-transparent shadow-none">
      <CardContent className="px-0 pb-6 pt-0">
        {/* 4 Widgets in Vertical Stack (1x4) */}
        <div className="space-y-2">
          {/* 1. Metronome Widget */}
          <MetronomeWidget
            bpm={state.tempo}
            isVisible={state.widgets.metronome.isVisible}
            isPlaying={state.isPlaying}
            onBpmChange={setTempo}
            onToggleVisibility={() => toggleWidgetVisibility('metronome')}
          />

          {/* 2. Drummer Widget - Fixed props */}
          <DrummerWidget
            isVisible={state.widgets.drummer.isVisible}
            isPlaying={state.isPlaying}
            selectedPattern={state.widgets.drummer.pattern}
            onPatternChange={handleDrummerPatternChange}
            onToggleVisibility={() => toggleWidgetVisibility('drummer')}
          />

          {/* 3. Bass Line Widget - Fixed props */}
          <BassLineWidget
            isVisible={state.widgets.bassLine.isVisible}
            isPlaying={state.isPlaying}
            selectedPattern={state.widgets.bassLine.pattern}
            onPatternChange={handleBassPatternChange}
            onToggleVisibility={() => toggleWidgetVisibility('bassLine')}
          />

          {/* 4. Harmony Widget - Fixed props */}
          <HarmonyWidget
            isVisible={state.widgets.harmony.isVisible}
            isPlaying={state.isPlaying}
            selectedPattern={state.widgets.harmony.pattern}
            onPatternChange={handleHarmonyPatternChange}
            onToggleVisibility={() => toggleWidgetVisibility('harmony')}
          />
        </div>

        {/* Widget Synchronization Status */}
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-400">
            All widgets synchronized with fretboard visualizer (Fixed Version)
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
                title={`${widget} ${
                  state.widgets[widget as keyof typeof state.widgets].isVisible
                    ? 'visible'
                    : 'hidden'
                }`}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
