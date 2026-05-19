'use client';

import React, { useState } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { LooperKnob } from './LooperKnob';
import { LoopGridStrip } from './LoopGridStrip';
import { SyncedWidget } from '../../base';
import type { SyncedWidgetRenderProps } from '../../base';
import type { LoopRegion } from './LoopGridStrip';
import { useTransportControls } from '@/domains/playback/contexts/TransportContext';

interface LooperCardProps {
  isLoopEnabled?: boolean;
  loopRegion?: LoopRegion | null;
  onLoopRegionChange?: (region: LoopRegion | null) => void;
  onToggleLoop?: () => void;
}

export function LooperCard({
  isLoopEnabled = false,
  loopRegion,
  onLoopRegionChange,
  onToggleLoop,
}: LooperCardProps) {
  return (
    <SyncedWidget
      widgetId="looper-controls"
      widgetName="Looper Controls"
      syncOptions={{
        subscribeTo: [
          'PLAYBACK_STATE',
          'TIMELINE_UPDATE',
          'EXERCISE_CHANGE',
          'TEMPO_CHANGE',
        ],
        debugMode: false,
      }}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <LooperCardContent
          syncProps={syncProps}
          isLoopEnabled={isLoopEnabled}
          loopRegion={loopRegion}
          onLoopRegionChange={onLoopRegionChange}
          onToggleLoop={onToggleLoop}
        />
      )}
    </SyncedWidget>
  );
}

function LooperCardContent({
  syncProps,
  isLoopEnabled: _isLoopEnabled,
  loopRegion,
  onLoopRegionChange,
  onToggleLoop: _onToggleLoop,
}: {
  syncProps: SyncedWidgetRenderProps;
  isLoopEnabled?: boolean;
  loopRegion?: LoopRegion | null;
  onLoopRegionChange?: (region: LoopRegion | null) => void;
  onToggleLoop?: () => void;
}) {
  const transport = useTransportControls();

  // Looper knob state
  const [selectedLooperBars, setSelectedLooperBars] = useState<number | null>(
    2,
  );

  // Handle looper bar selection
  const handleLooperBarSelect = (bars: number | null) => {
    setSelectedLooperBars(bars);

    // Convert bars to loop region
    if (bars && syncProps.selectedExercise && onLoopRegionChange) {
      const timeSignature = syncProps.selectedExercise.timeSignature || {
        numerator: 4,
        denominator: 4,
      };

      // bars is the number of bars to loop (1, 2, 4, 8)
      onLoopRegionChange({
        startMeasure: 1,
        endMeasure: bars,
        startBeat: 1,
        endBeat: timeSignature.numerator || 4,
      });
    } else if (!bars && onLoopRegionChange) {
      // Clear loop region when bars is null
      onLoopRegionChange(null);
    }
  };

  // Handle seek to position
  const handleSeek = (position: number) => {
    if (transport && transport.seekTo) {
      transport.seekTo(position);

      // Emit sync event so all widgets update their position
      if (syncProps.sync && syncProps.sync.actions) {
        syncProps.sync.actions.emitEvent(
          'SEEK',
          {
            position: position,
            time: position * 1000, // Convert to milliseconds
          },
          'high',
        );
      }

      logger.info(`🎵 Seeking to position: ${position}s`);
    }
  };

  return (
    <Card className="bg-transparent border-transparent shadow-none overflow-visible">
      <CardContent className="p-0 overflow-visible">
        {/* Looper Panel - Neumorphic style matching widgets */}
        <div className="bg-slate-800 rounded-2xl px-4 py-3 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300">
          {/* First Row - Looper Knob + Headline (like widgets) */}
          <div className="flex items-center gap-4 mb-3">
            {/* Left Side - Looper Knob */}
            <div className="flex justify-center items-center w-20 h-16">
              <LooperKnob
                selectedBars={selectedLooperBars}
                onBarSelect={handleLooperBarSelect}
                size={50}
              />
            </div>

            {/* Right Side - Headline */}
            <div className="flex-1">
              <h3 className="font-semibold text-white text-sm mb-1">
                Loop Control
              </h3>
              <p className="text-xs text-slate-400">
                Set loop regions for practice
              </p>
            </div>
          </div>

          {/* Second Row - Loop Grid Strip (full width) */}
          <div className="w-full">
            <LoopGridStrip
              exercise={syncProps.selectedExercise}
              currentTime={syncProps.currentTime || 0}
              duration={(() => {
                const exercise = syncProps.selectedExercise;
                if (!exercise) return 0;

                // Calculate duration in milliseconds from beats and BPM
                // TEMPO FIX: Use current transport tempo for duration calculation
                const effectiveBpm = syncProps.tempo || exercise.bpm;
                if (exercise.duration_beats && effectiveBpm) {
                  const beatsPerSecond = effectiveBpm / 60;
                  const durationSeconds =
                    exercise.duration_beats / beatsPerSecond;
                  return durationSeconds * 1000; // Convert to milliseconds
                }

                // Fallback to deprecated duration field if available
                return exercise.duration || 0;
              })()}
              loopRegion={loopRegion}
              onLoopRegionChange={onLoopRegionChange || (() => undefined)}
              onSeek={handleSeek}
              className="[&>div]:bg-transparent [&>div]:shadow-none [&>div]:p-0"
              currentTempo={syncProps.tempo}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
