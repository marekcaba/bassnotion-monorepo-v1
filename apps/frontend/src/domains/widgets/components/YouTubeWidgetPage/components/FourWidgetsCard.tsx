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
  tutorialId?: string;
  isAdminMode?: boolean;
}

export function FourWidgetsCard({
  widgetState,
  tutorialId,
  isAdminMode = false,
}: FourWidgetsCardProps) {
  const { state, selectedExercise, setState, harmonyInstrument } = widgetState;

  // CRITICAL DEBUG: Log every render
  // console.log('🔍 [STATE-FLOW-3.5] FourWidgetsCard render:', {
  //   harmonyInstrument,
  //   harmonyInstrumentType: typeof harmonyInstrument,
  //   selectedExerciseId: selectedExercise?.id?.value,
  //   stateHarmonyInstrument: state.harmonyInstrument,
  // });

  // Memoize exercise by ID to prevent object reference changes
  const memoizedExercise = React.useMemo(
    () => selectedExercise,
    [selectedExercise?.id?.value],
  );

  // Debug logs disabled - too noisy
  // console.log('🔍 FourWidgetsCard RENDER:', {
  //   harmonyInstrument: state.harmonyInstrument,
  //   isPlaying: state.isPlaying,
  //   selectedExerciseId: selectedExercise?.id?.value,
  // });

  // Use useCallback to prevent recreating handlers on every render
  // Use stable setState instead of whole widgetState to prevent recreation
  const handlePatternChange = React.useCallback(
    (widget: 'drummer' | 'bassLine', pattern: string) => {
      // Update the widget state
      if (widget === 'drummer') {
        setState((prev) => ({
          ...prev,
          widgets: {
            ...prev.widgets,
            drummer: { ...prev.widgets.drummer, pattern },
          },
        }));
      } else if (widget === 'bassLine') {
        setState((prev) => ({
          ...prev,
          widgets: {
            ...prev.widgets,
            bassLine: { ...prev.widgets.bassLine, pattern },
          },
        }));
      }
    },
    [setState],
  );

  const handleProgressionChange = React.useCallback(
    (progression: string[]) => {
      // Update harmony widget progression
      setState((prev) => ({
        ...prev,
        widgets: {
          ...prev.widgets,
          harmony: { ...prev.widgets.harmony, progression },
        },
      }));
    },
    [setState],
  );

  // Memoize the onNextChord handler to prevent infinite re-renders
  const handleNextChord = React.useCallback(() => {
    // Update current chord index
    setState((prev) => ({
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
  }, [setState]);

  return (
    <Card className="bg-transparent border-transparent shadow-none">
      <CardContent className="px-0 pb-6 pt-0">
        {/* 4 Widgets in Vertical Stack (1x4) as specified */}
        <div className="space-y-2">
          {/* 1. Metronome Widget */}
          <MetronomeWidget
            isVisible={state.widgets.metronome.isVisible}
            isPlaying={state.isPlaying}
            timeSignature={selectedExercise?.timeSignature}
          />

          {/* 2. Drummer Widget */}
          <DrummerWidget
            pattern={state.widgets.drummer.pattern}
            isVisible={state.widgets.drummer.isVisible}
            isPlaying={state.isPlaying}
            exercise={selectedExercise}
            tutorialId={tutorialId}
            onPatternChange={(pattern) =>
              handlePatternChange('drummer', pattern)
            }
            isAdminMode={isAdminMode}
          />

          {/* 3. Bass Line Widget */}
          <BassLineWidget
            pattern={state.widgets.bassLine.pattern}
            isVisible={state.widgets.bassLine.isVisible}
            isPlaying={state.isPlaying}
            exercise={selectedExercise}
            onPatternChange={(pattern) =>
              handlePatternChange('bassLine', pattern)
            }
            isAdminMode={isAdminMode}
          />

          {/* 4. Harmony Widget */}
          <HarmonyWidget
            progression={state.widgets.harmony.progression}
            currentChord={state.widgets.harmony.currentChord || 0}
            isVisible={state.widgets.harmony.isVisible}
            isPlaying={state.isPlaying}
            tutorialId={tutorialId}
            harmonyInstrument={harmonyInstrument}
            exercise={memoizedExercise}
            onNextChord={handleNextChord}
            onProgressionChange={handleProgressionChange}
            isAdminMode={isAdminMode}
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
