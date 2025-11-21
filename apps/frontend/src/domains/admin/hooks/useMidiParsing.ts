import { useState, useCallback } from 'react';
import { apiClient } from '@/lib/api-client';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

/**
 * Parsed measure structure returned from backend
 */
export interface MidiNoteEvent {
  pitch: number;
  velocity: number;
  name: string;
  time: number;
  duration: number;
}

export interface ParsedMeasure {
  measureNumber: number;
  startTime: number;
  endTime: number;
  notes: MidiNoteEvent[];
}

export interface ParseMidiResponse {
  totalMeasures: number;
  totalNotes: number;
  durationSeconds: number;
  measures: ParsedMeasure[];
  metadata: {
    bpm: number;
    timeSignature: {
      numerator: number;
      denominator: number;
    };
    totalBars: number;
  };
}

/**
 * Hook for parsing MIDI files from exercises
 *
 * Story 4.4 - Task 4.2: Added support for stateless MIDI parsing
 * - Can now parse MIDI from any URL (temp storage or permanent)
 * - Falls back to exercise ID lookup for backward compatibility
 */
export function useMidiParsing() {
  const { correlationId, logger } = useCorrelation('useMidiParsing');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<ParseMidiResponse | null>(null);

  /**
   * Parse MIDI file - supports both stateless and legacy modes
   *
   * @param exerciseIdOrUrl - Either an exercise ID (legacy) or direct MIDI URL (stateless)
   * @param options - Optional parsing parameters (bpm, timeSignature, totalBars)
   * @returns Parsed MIDI data
   */
  const parseMidi = useCallback(async (
    exerciseIdOrUrl: string,
    options?: {
      midiUrl?: string;
      bpm?: number;
      timeSignature?: { numerator: number; denominator: number };
      totalBars?: number;
    }
  ): Promise<ParseMidiResponse> => {
    setLoading(true);
    setError(null);

    try {
      // Story 4.4 - Task 1: Use stateless endpoint if midiUrl provided
      if (options?.midiUrl) {
        logger.info('Parsing MIDI file (stateless mode - Story 4.4)', {
          midiUrl: options.midiUrl,
          bpm: options.bpm,
          totalBars: options.totalBars,
          correlationId,
        });

        const response = await apiClient.post<ParseMidiResponse>(
          `/api/v1/midi/parse`,
          {
            midiUrl: options.midiUrl,
            bpm: options.bpm,
            timeSignature: options.timeSignature,
            totalBars: options.totalBars,
          },
          { correlationId },
        );

        setData(response);
        logger.info('MIDI parsing completed (stateless)', {
          midiUrl: options.midiUrl,
          totalMeasures: response.totalMeasures,
          totalNotes: response.totalNotes,
          correlationId,
        });

        return response;
      }

      // Legacy mode: Parse from saved exercise (backward compatibility)
      logger.info('Parsing MIDI file (legacy mode)', {
        exerciseId: exerciseIdOrUrl,
        correlationId,
      });

      const response = await apiClient.post<ParseMidiResponse>(
        `/api/v1/exercises/${exerciseIdOrUrl}/midi/parse`,
        {},
        { correlationId },
      );

      setData(response);
      logger.info('MIDI parsing completed (legacy)', {
        exerciseId: exerciseIdOrUrl,
        totalMeasures: response.totalMeasures,
        totalNotes: response.totalNotes,
        correlationId,
      });

      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to parse MIDI');
      setError(error);
      logger.error('MIDI parsing failed', error, {
        exerciseIdOrUrl,
        hasStatelessUrl: !!options?.midiUrl,
        correlationId,
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [correlationId, logger]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    parseMidi,
    loading,
    error,
    data,
    reset,
  };
}
