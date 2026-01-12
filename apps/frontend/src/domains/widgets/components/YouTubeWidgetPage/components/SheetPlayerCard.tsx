'use client';

import React, { useMemo, useCallback, useRef } from 'react';
import { Music } from 'lucide-react';
import type { ExerciseNote } from '@bassnotion/contracts';
import { useTransportControls, useTransportPosition } from '@/domains/playback/contexts/TransportContext';
import { SheetMusicDisplay } from '../../SheetMusic/index.js';
import { logSkeletonDebug } from '@/utils/skeletonDebug';

// =============================================================================
// POSITION-AWARE SHEET MUSIC (isolates position updates)
// =============================================================================
interface PositionAwareSheetMusicProps {
  notes: ExerciseNote[];
  bpm: number;
  timeSignature: { numerator: number; denominator: number } | undefined;
  title?: string;
  width: number | undefined;
  height: number;
  maxMeasuresPerSystem: number;
  totalBars: number;
  onReady: () => void;
}

let positionAwareRenderCount = 0;

const PositionAwareSheetMusic = React.memo<PositionAwareSheetMusicProps>(
  ({
    notes,
    bpm,
    timeSignature,
    title,
    width,
    height,
    maxMeasuresPerSystem,
    totalBars,
    onReady,
  }) => {
    positionAwareRenderCount++;
    // Subscribe to position updates - only this component re-renders
    const position = useTransportPosition();
    const { isPlaying } = useTransportControls();

    return (
      <SheetMusicDisplay
        notes={notes}
        bpm={bpm}
        timeSignature={timeSignature}
        title={title}
        width={width}
        height={height}
        maxMeasuresPerSystem={maxMeasuresPerSystem}
        totalBars={totalBars}
        isPlaying={isPlaying}
        currentBar={position?.bars ?? 0}
        currentPosition={position ?? undefined}
        onReady={onReady}
      />
    );
  },
);
PositionAwareSheetMusic.displayName = 'PositionAwareSheetMusic';

// =============================================================================
// COMPONENT PROPS
// =============================================================================
interface SheetPlayerCardProps {
  selectedExercise?: any;
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================
let sheetPlayerCardRenderCount = 0;

export function SheetPlayerCard({ selectedExercise }: SheetPlayerCardProps) {
  sheetPlayerCardRenderCount++;
  logSkeletonDebug('🎼', 'SheetPlayerCard', sheetPlayerCardRenderCount, {
    hasExercise: !!selectedExercise,
  });

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollPosition = useRef(0);
  const { isPlaying } = useTransportControls();

  // Extract exercise data
  const exerciseNotes = useMemo<ExerciseNote[]>(() => {
    if (!selectedExercise?.notes || !Array.isArray(selectedExercise.notes)) {
      return [];
    }
    return selectedExercise.notes;
  }, [selectedExercise?.notes]);

  const exerciseBpm = useMemo(() => {
    return selectedExercise?.bpm || 120;
  }, [selectedExercise?.bpm]);

  const exerciseTotalBars = useMemo(() => {
    return selectedExercise?.total_bars || 4;
  }, [selectedExercise?.total_bars]);

  const timeSignature = useMemo(() => {
    if (selectedExercise?.time_signature) {
      const ts = selectedExercise.time_signature;
      return {
        numerator: ts.numerator || ts.beats_per_bar || 4,
        denominator: ts.denominator || ts.beat_value || 4,
      };
    }
    return { numerator: 4, denominator: 4 };
  }, [selectedExercise?.time_signature]);

  const handleSheetMusicReady = useCallback(() => {
    // Sheet music is ready
  }, []);

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      if (!isPlaying) {
        savedScrollPosition.current = e.currentTarget.scrollLeft;
      }
    },
    [isPlaying],
  );

  return (
    <>
      {exerciseNotes.length > 0 ? (
        <div
          style={{
            position: 'relative',
            borderRadius: '20px',
            overflow: 'hidden',
          }}
        >
          {/* Left feathered edge */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '40px',
              background: 'linear-gradient(to right, #c8c8c8 0%, transparent 100%)',
              zIndex: 10,
              pointerEvents: 'none',
              borderRadius: '20px 0 0 20px',
            }}
          />
          {/* Right feathered edge */}
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: '40px',
              background: 'linear-gradient(to left, #c8c8c8 0%, transparent 100%)',
              zIndex: 10,
              pointerEvents: 'none',
              borderRadius: '0 20px 20px 0',
            }}
          />
          <div
            ref={scrollContainerRef}
            className="w-full scrollbar-hide"
            style={{
              height: '140px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, #bfbfbf 0%, #d1d1d1 100%)',
              boxShadow: 'inset 5px 5px 10px #b3b3b3, inset -5px -5px 10px #dfdfdf',
              position: 'relative',
              zIndex: 1,
              isolation: 'isolate',
              overflowX: 'auto',
              overflowY: 'hidden',
            }}
            onScroll={handleScroll}
          >
            <div
              className="min-w-full"
              style={{
                height: '100%',
                position: 'relative',
                pointerEvents: 'auto',
                cursor: 'default',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <PositionAwareSheetMusic
                notes={exerciseNotes}
                bpm={exerciseBpm}
                timeSignature={timeSignature}
                title={selectedExercise?.title}
                width={undefined}
                height={140}
                maxMeasuresPerSystem={2}
                totalBars={exerciseTotalBars}
                onReady={handleSheetMusicReady}
              />
            </div>
          </div>
        </div>
      ) : (
        <div
          className="flex items-center justify-center flex-col gap-3"
          style={{
            height: '140px',
            borderRadius: '20px',
            background: 'linear-gradient(135deg, #bfbfbf 0%, #d1d1d1 100%)',
            boxShadow: 'inset 5px 5px 10px #b3b3b3, inset -5px -5px 10px #dfdfdf',
          }}
        >
          <Music className="w-10 h-10 text-slate-500/60" />
          <span className="text-slate-600 text-sm">
            Select an exercise to view notation
          </span>
        </div>
      )}
    </>
  );
}

// =============================================================================
// SKELETON
// =============================================================================
export function SheetPlayerCardSkeleton() {
  return (
    <div
      className="skeleton-shimmer w-full"
      style={{
        height: '140px',
        borderRadius: '20px',
      }}
    />
  );
}
