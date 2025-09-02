'use client';

import React, { useEffect, useState } from 'react';
import { beatTimingAnalyzer } from '@/domains/playback/utils/BeatTimingAnalyzer';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface TimingDebugWindowProps {
  isVisible: boolean;
  onClose: () => void;
}

export function TimingDebugWindow({
  isVisible,
  onClose,
}: TimingDebugWindowProps) {
  const { correlationId, logger } = useCorrelation('TimingDebugWindow');
  const [stats, setStats] = useState({
    drums: { averageDrift: 0, jitter: 0, syncScore: 0, totalBeats: 0 },
    metronome: { averageDrift: 0, jitter: 0, syncScore: 0, totalBeats: 0 },
    overall: { averageDrift: 0, jitter: 0, syncScore: 0, totalBeats: 0 },
  });

  const [comparison, setComparison] = useState({
    averageDifference: 0,
    correlation: 0,
  });

  useEffect(() => {
    if (!isVisible) return;

    const updateStats = () => {
      const drumsStats = beatTimingAnalyzer.getStatistics('drums');
      const metronomeStats = beatTimingAnalyzer.getStatistics('metronome');
      const overallStats = beatTimingAnalyzer.getStatistics();
      const comp = beatTimingAnalyzer.compareSourceTiming('drums', 'metronome');

      setStats({
        drums: drumsStats,
        metronome: metronomeStats,
        overall: overallStats,
      });

      setComparison({
        averageDifference: comp.averageDifference,
        correlation: comp.correlation,
      });
    };

    // Update every 100ms
    const interval = setInterval(updateStats, 100);
    updateStats(); // Initial update

    return () => clearInterval(interval);
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-slate-900 border border-slate-700 rounded-lg p-4 shadow-lg z-50 font-mono text-xs max-w-md">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-white font-bold">Timing Debug</h3>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          ×
        </button>
      </div>

      <div className="space-y-3">
        {/* Overall Stats */}
        <div>
          <h4 className="text-yellow-400 mb-1">Overall</h4>
          <div className="text-slate-300">
            <div>Beats: {stats.overall.totalBeats}</div>
            <div>Avg Drift: {stats.overall.averageDrift.toFixed(1)}ms</div>
            <div>Jitter: {stats.overall.jitter.toFixed(1)}ms</div>
            <div
              className={`font-bold ${stats.overall.syncScore > 80 ? 'text-green-400' : stats.overall.syncScore > 60 ? 'text-yellow-400' : 'text-red-400'}`}
            >
              Sync Score: {stats.overall.syncScore.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Drums Stats */}
        <div>
          <h4 className="text-orange-400 mb-1">Drums</h4>
          <div className="text-slate-300">
            <div>Beats: {stats.drums.totalBeats}</div>
            <div>Avg Drift: {stats.drums.averageDrift.toFixed(1)}ms</div>
            <div>Jitter: {stats.drums.jitter.toFixed(1)}ms</div>
            <div
              className={`${stats.drums.syncScore > 80 ? 'text-green-400' : stats.drums.syncScore > 60 ? 'text-yellow-400' : 'text-red-400'}`}
            >
              Sync: {stats.drums.syncScore.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Metronome Stats */}
        <div>
          <h4 className="text-green-400 mb-1">Metronome</h4>
          <div className="text-slate-300">
            <div>Beats: {stats.metronome.totalBeats}</div>
            <div>Avg Drift: {stats.metronome.averageDrift.toFixed(1)}ms</div>
            <div>Jitter: {stats.metronome.jitter.toFixed(1)}ms</div>
            <div
              className={`${stats.metronome.syncScore > 80 ? 'text-green-400' : stats.metronome.syncScore > 60 ? 'text-yellow-400' : 'text-red-400'}`}
            >
              Sync: {stats.metronome.syncScore.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Comparison */}
        {stats.drums.totalBeats > 0 && stats.metronome.totalBeats > 0 && (
          <div>
            <h4 className="text-purple-400 mb-1">Drums vs Metronome</h4>
            <div className="text-slate-300">
              <div>
                Timing Diff: {comparison.averageDifference.toFixed(1)}ms
              </div>
              <div
                className={`${comparison.correlation > 80 ? 'text-green-400' : comparison.correlation > 60 ? 'text-yellow-400' : 'text-red-400'}`}
              >
                Correlation: {comparison.correlation.toFixed(0)}%
              </div>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={() => {
          const report = beatTimingAnalyzer.exportData();
          logger.info(report);
          alert('Timing report exported to console');
        }}
        className="mt-3 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-white rounded text-xs"
      >
        Export Report
      </button>
    </div>
  );
}
