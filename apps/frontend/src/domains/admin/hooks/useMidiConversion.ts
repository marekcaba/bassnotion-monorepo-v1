import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

/**
 * Measure anchor position
 */
export interface MeasureAnchor {
  measureNumber: number;
  string: number; // 1-6
  fret: number; // 0-24
}

/**
 * Confidence level for generated notes
 */
export type ConfidenceLevel = 'high' | 'medium' | 'low';

/**
 * Alternative fretboard position
 */
export interface AlternativePosition {
  string: number;
  fret: number;
  score: number;
  reason?: string;
}

/**
 * Position warning
 */
export interface PositionWarning {
  type:
    | 'large_stretch'
    | 'difficult_shift'
    | 'string_crossing'
    | 'awkward_position';
  message: string;
  severity: 'info' | 'warning' | 'error';
}

/**
 * Generated exercise note with fretboard position and musical timing
 */
export interface GeneratedExerciseNote {
  id: string;
  // Fretboard position
  string: number;
  fret: number;
  note: string;

  // Musical timing (Primary - from MIDI parser)
  position: {
    measure: number;
    beat: number;
    subdivision: number;
  };
  noteDuration: string; // 'quarter', 'eighth', etc.
  durationTicks: number;

  // Performance data
  pitch: number;
  velocity: number;
  measureNumber: number;

  // Fretboard analysis metadata
  confidence: ConfidenceLevel;
  alternatives: AlternativePosition[];
  warnings?: PositionWarning[];
  score: number;

  // Fingering (optional - assigned by admin)
  finger_index?: 1 | 2 | 3 | 4 | 'T'; // 1=index, 2=middle, 3=ring, 4=pinky, T=thumb

  // Legacy (optional, for backward compatibility)
  timestamp?: number;
  duration?: number;
}

/**
 * Playability metrics
 */
export interface PlayabilityMetrics {
  overallScore: number;
  largeStretches: number;
  difficultShifts: number;
  stringCrossings: number;
  handStability: number;
  highConfidencePercentage: number;
}

/**
 * MIDI conversion request
 */
export interface ConvertMidiRequest {
  anchors: MeasureAnchor[];
  bassType?: '4' | '5' | '6';
}

/**
 * MIDI conversion response
 */
export interface ConvertMidiResponse {
  notes: GeneratedExerciseNote[];
  totalNotes: number;
  playability: PlayabilityMetrics;
  processingTimeMs: number;
}

/**
 * Hook for converting MIDI to fretboard positions
 */
export function useMidiConversion() {
  const { correlationId, logger } = useCorrelation('useMidiConversion');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<ConvertMidiResponse | null>(null);

  const convertMidi = useCallback(
    async (
      exerciseIdOrMeasures: string | { measures: any[] },
      request: ConvertMidiRequest,
    ): Promise<ConvertMidiResponse> => {
      setLoading(true);
      setError(null);

      try {
        // Story 4.4 - Task 4.5: Support stateless conversion
        if (
          typeof exerciseIdOrMeasures === 'object' &&
          'measures' in exerciseIdOrMeasures
        ) {
          // Stateless mode: Use /api/v1/midi/convert with measures
          logger.info(
            'Converting MIDI to fretboard (stateless mode - Story 4.4)',
            {
              measureCount: exerciseIdOrMeasures.measures.length,
              anchorCount: request.anchors.length,
              bassType: request.bassType,
              correlationId,
            },
          );

          const response = await apiClient.post<ConvertMidiResponse>(
            `/api/v1/midi/convert`,
            {
              measures: exerciseIdOrMeasures.measures,
              anchors: request.anchors,
              bassType: request.bassType,
            },
            { correlationId },
          );

          setData(response);
          logger.info('MIDI conversion completed (stateless)', {
            totalNotes: response.totalNotes,
            playabilityScore: response.playability.overallScore,
            correlationId,
          });

          return response;
        } else {
          // Legacy mode: Use exercise ID
          const exerciseId = exerciseIdOrMeasures as string;
          logger.info('Converting MIDI to fretboard (legacy mode)', {
            exerciseId,
            anchorCount: request.anchors.length,
            bassType: request.bassType,
          });

          const response = await apiClient.post<ConvertMidiResponse>(
            `/api/v1/exercises/${exerciseId}/midi/convert`,
            request,
            { correlationId },
          );

          setData(response);
          logger.info('MIDI conversion completed (legacy)', {
            exerciseId,
            totalNotes: response.totalNotes,
            playabilityScore: response.playability.overallScore,
          });

          return response;
        }
      } catch (err) {
        const error =
          err instanceof Error ? err : new Error('Failed to convert MIDI');
        setError(error);

        // Check if this is a validation error (expected user error) vs system error
        const isValidationError =
          error.message?.includes('outside bass guitar range') ||
          error.message?.includes('Invalid') ||
          error.message?.includes('required');

        // Use warn for validation errors, error for unexpected failures
        if (isValidationError) {
          logger.warn('MIDI conversion validation failed', {
            message: error.message,
            mode:
              typeof exerciseIdOrMeasures === 'object' ? 'stateless' : 'legacy',
          });
        } else {
          logger.error('MIDI conversion failed', error, {
            mode:
              typeof exerciseIdOrMeasures === 'object' ? 'stateless' : 'legacy',
          });
        }

        throw error;
      } finally {
        setLoading(false);
      }
    },
    [correlationId, logger],
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    convertMidi,
    loading,
    error,
    data,
    reset,
  };
}
