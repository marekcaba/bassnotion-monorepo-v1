'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ZoneCard, ZoneCardContent } from '@/ui-libraries';
import { WidgetErrorBoundary } from '@/shared/components/ErrorBoundary';
import { UseWidgetPageStateReturn } from '@/domains/widgets/hooks/useWidgetPageState';
import { getSkeletonDebugTime } from '@/utils/skeletonDebug';
import { isVerboseDebugEnabled } from '@/config/debug';

// Widget loading skeleton component - upgraded with glassmorphism style
function WidgetSkeleton({ name }: { name: string }) {
  return (
    <div className="relative bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-1 h-24 shadow-2xl shadow-black/20 overflow-hidden">
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10 pointer-events-none" />
      <div className="relative flex items-center gap-4 h-full">
        <div className="skeleton-shimmer w-12 h-12 rounded-full" />
        <div className="flex-1">
          <div className="skeleton-shimmer h-4 w-24 rounded mb-2" />
          <div className="skeleton-shimmer h-3 w-32 rounded" />
        </div>
        <div className="skeleton-shimmer w-16 h-10 rounded-xl" />
      </div>
      <span className="sr-only">Loading {name} widget...</span>
    </div>
  );
}

// Dynamic imports with loading states - reduces initial bundle by ~300KB per widget
const MetronomeWidget = dynamic(
  () =>
    import('../MetronomeWidget/index.js').then((m) => {
      if (isVerboseDebugEnabled()) {
        console.log(
          `📦 [SKELETON-DEBUG] MetronomeWidget loaded at +${getSkeletonDebugTime()}ms`,
        );
      }
      return m.MetronomeWidget;
    }),
  {
    ssr: false,
    loading: () => <WidgetSkeleton name="Metronome" />,
  },
);

const DrummerWidget = dynamic(
  () =>
    import('../DrummerWidget/index.js').then((m) => {
      if (isVerboseDebugEnabled()) {
        console.log(
          `📦 [SKELETON-DEBUG] DrummerWidget loaded at +${getSkeletonDebugTime()}ms`,
        );
      }
      return m.DrummerWidget;
    }),
  {
    ssr: false,
    loading: () => <WidgetSkeleton name="Drummer" />,
  },
);

const BassLineWidget = dynamic(
  () =>
    import('../BassLineWidget/index.js').then((m) => {
      if (isVerboseDebugEnabled()) {
        console.log(
          `📦 [SKELETON-DEBUG] BassLineWidget loaded at +${getSkeletonDebugTime()}ms`,
        );
      }
      return m.BassLineWidget;
    }),
  {
    ssr: false,
    loading: () => <WidgetSkeleton name="Bass Line" />,
  },
);

const HarmonyWidget = dynamic(
  () =>
    import('../HarmonyWidget/index.js').then((m) => {
      if (isVerboseDebugEnabled()) {
        console.log(
          `📦 [SKELETON-DEBUG] HarmonyWidget loaded at +${getSkeletonDebugTime()}ms`,
        );
      }
      return m.HarmonyWidget;
    }),
  {
    ssr: false,
    loading: () => <WidgetSkeleton name="Harmony" />,
  },
);

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
  const {
    state,
    selectedExercise,
    setState,
    harmonyInstrument,
    setVolume,
    toggleMuted,
  } = widgetState;

  // Memoized volume change handlers to prevent re-renders
  const handleMetronomeVolumeChange = React.useCallback(
    (volume: number) => setVolume('metronome', volume),
    [setVolume],
  );
  const handleDrumsVolumeChange = React.useCallback(
    (volume: number) => setVolume('drums', volume),
    [setVolume],
  );
  const handleBassVolumeChange = React.useCallback(
    (volume: number) => setVolume('bass', volume),
    [setVolume],
  );
  const handleHarmonyVolumeChange = React.useCallback(
    (volume: number) => setVolume('harmony', volume),
    [setVolume],
  );

  // Memoized mute toggle handlers
  const handleMetronomeMuteToggle = React.useCallback(
    () => toggleMuted('metronome'),
    [toggleMuted],
  );
  const handleDrumsMuteToggle = React.useCallback(
    () => toggleMuted('drums'),
    [toggleMuted],
  );
  const handleBassMuteToggle = React.useCallback(
    () => toggleMuted('bass'),
    [toggleMuted],
  );
  const handleHarmonyMuteToggle = React.useCallback(
    () => toggleMuted('harmony'),
    [toggleMuted],
  );

  // CRITICAL DEBUG: Log every render
  // console.log('🔍 [STATE-FLOW-3.5] FourWidgetsCard render:', {
  //   harmonyInstrument,
  //   harmonyInstrumentType: typeof harmonyInstrument,
  //   selectedExerciseId: selectedExercise?.id?.value,
  //   stateHarmonyInstrument: state.harmonyInstrument,
  // });

  // Memoize exercise by ID AND harmonyInstrument to ensure instrument changes are detected
  // FIX: Include harmonyInstrument in deps to ensure HarmonyWidget gets updated exercise
  const memoizedExercise = React.useMemo(
    () => selectedExercise,
    [selectedExercise?.id?.value, selectedExercise?.harmonyInstrument],
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

  // Memoized pattern change handlers to prevent unnecessary re-renders
  // These replace inline arrow functions that were creating new references on every render
  const handleDrummerPatternChange = React.useCallback(
    (pattern: string) => handlePatternChange('drummer', pattern),
    [handlePatternChange],
  );
  const handleBassLinePatternChange = React.useCallback(
    (pattern: string) => handlePatternChange('bassLine', pattern),
    [handlePatternChange],
  );

  return (
    <ZoneCard className="zone-card bg-transparent border-transparent shadow-none">
      <ZoneCardContent className="px-0 pb-6 pt-0">
        {/* 4 Widgets in Vertical Stack (1x4) as specified */}
        <div className="space-y-2">
          {/* 1. Metronome Widget */}
          <WidgetErrorBoundary widgetName="Metronome">
            <MetronomeWidget
              isVisible={state.widgets.metronome.isVisible}
              isPlaying={state.isPlaying}
              timeSignature={selectedExercise?.timeSignature}
              volume={state.volume.metronome}
              isMuted={state.muted.metronome}
              onVolumeChange={handleMetronomeVolumeChange}
              onMuteToggle={handleMetronomeMuteToggle}
            />
          </WidgetErrorBoundary>

          {/* 2. Drummer Widget */}
          <WidgetErrorBoundary widgetName="Drums">
            <DrummerWidget
              pattern={state.widgets.drummer.pattern}
              isVisible={state.widgets.drummer.isVisible}
              isPlaying={state.isPlaying}
              exercise={selectedExercise}
              tutorialId={tutorialId}
              onPatternChange={handleDrummerPatternChange}
              isAdminMode={isAdminMode}
              volume={state.volume.drums}
              isMuted={state.muted.drums}
              onVolumeChange={handleDrumsVolumeChange}
              onMuteToggle={handleDrumsMuteToggle}
            />
          </WidgetErrorBoundary>

          {/* 3. Bass Line Widget */}
          <WidgetErrorBoundary widgetName="Bass">
            <BassLineWidget
              pattern={state.widgets.bassLine.pattern}
              isVisible={state.widgets.bassLine.isVisible}
              isPlaying={state.isPlaying}
              exercise={selectedExercise}
              onPatternChange={handleBassLinePatternChange}
              isAdminMode={isAdminMode}
              volume={state.volume.bass}
              isMuted={state.muted.bass}
              onVolumeChange={handleBassVolumeChange}
              onMuteToggle={handleBassMuteToggle}
            />
          </WidgetErrorBoundary>

          {/* 4. Harmony Widget */}
          <WidgetErrorBoundary widgetName="Harmony">
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
              volume={state.volume.harmony}
              isMuted={state.muted.harmony}
              onVolumeChange={handleHarmonyVolumeChange}
              onMuteToggle={handleHarmonyMuteToggle}
            />
          </WidgetErrorBoundary>
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
      </ZoneCardContent>
    </ZoneCard>
  );
}

/**
 * Skeleton loading state for FourWidgetsCard
 * Shows placeholders for all 4 widget cards
 */
export function FourWidgetsCardSkeleton() {
  return (
    <ZoneCard className="zone-card bg-transparent border-transparent shadow-none">
      <ZoneCardContent className="px-0 pb-6 pt-0">
        <div className="space-y-2">
          <WidgetSkeleton name="Metronome" />
          <WidgetSkeleton name="Drummer" />
          <WidgetSkeleton name="Bass Line" />
          <WidgetSkeleton name="Harmony" />
        </div>
        <div className="mt-4 text-center">
          <div className="skeleton-shimmer h-3 w-64 mx-auto rounded" />
          <div className="flex justify-center gap-2 mt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="skeleton-shimmer w-2 h-2 rounded-full" />
            ))}
          </div>
        </div>
      </ZoneCardContent>
      <span className="sr-only">Loading widgets...</span>
    </ZoneCard>
  );
}
