/**
 * Hook for widgets to report beat timing to the analyzer
 */

import { useCallback } from 'react';
import { beatTimingAnalyzer } from '@/domains/playback/utils/BeatTimingAnalyzer';

export function useBeatTimingReport(source: string) {
  const reportBeat = useCallback(
    (beatNumber: number, measureNumber: number, actualTime?: number) => {
      beatTimingAnalyzer.recordBeat(
        source,
        beatNumber,
        measureNumber,
        actualTime,
      );
    },
    [source],
  );

  return { reportBeat };
}
