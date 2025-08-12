'use client';

import React, { useEffect, useState, useRef } from 'react';
import { beatTimingAnalyzer, type TimingStatistics, type BeatTimingData } from '@/domains/playback/utils/BeatTimingAnalyzer';

interface BeatTimingVisualizerProps {
  isPlaying: boolean;
  tempo: number;
}

export function BeatTimingVisualizer({ isPlaying, tempo }: BeatTimingVisualizerProps) {
  const [stats, setStats] = useState<Record<string, TimingStatistics>>({});
  const [recentBeats, setRecentBeats] = useState<BeatTimingData[]>([]);
  const [comparison, setComparison] = useState<{
    sources: [string, string];
    averageDifference: number;
    correlation: number;
  } | null>(null);
  const updateInterval = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (isPlaying) {
      // Start analyzer
      beatTimingAnalyzer.start(tempo);
      
      // Update stats every 100ms
      updateInterval.current = window.setInterval(() => {
        // Get overall stats and per-source stats
        const sources = ['drums', 'metronome', 'harmony', 'bassline'];
        const newStats: Record<string, TimingStatistics> = {
          overall: beatTimingAnalyzer.getStatistics()
        };
        
        sources.forEach(source => {
          newStats[source] = beatTimingAnalyzer.getStatistics(source);
        });
        
        setStats(newStats);
        setRecentBeats(beatTimingAnalyzer.getRecentHistory(100));
        
        // Compare drums vs metronome
        const drumsVsMetronome = beatTimingAnalyzer.compareSourceTiming('drums', 'metronome');
        if (drumsVsMetronome.timingDifference.length > 0) {
          setComparison({
            sources: ['drums', 'metronome'],
            averageDifference: drumsVsMetronome.averageDifference,
            correlation: drumsVsMetronome.correlation
          });
        }
      }, 100);
    } else {
      // Stop updates
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
        updateInterval.current = null;
      }
    }
    
    return () => {
      if (updateInterval.current) {
        clearInterval(updateInterval.current);
      }
    };
  }, [isPlaying, tempo]);

  // Draw timing graph
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (recentBeats.length < 2) return;
    
    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    
    // Horizontal lines at 0, ±10ms, ±20ms
    const centerY = canvas.height / 2;
    const pixelsPerMs = canvas.height / 60; // ±30ms range
    
    [-20, -10, 0, 10, 20].forEach(ms => {
      const y = centerY - (ms * pixelsPerMs);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
      
      // Label
      ctx.fillStyle = '#666';
      ctx.font = '10px monospace';
      ctx.fillText(`${ms}ms`, 5, y - 2);
    });
    
    // Draw timing data
    const sources = ['drums', 'metronome', 'harmony', 'bassline'];
    const colors = {
      drums: '#ff6b6b',
      metronome: '#4ecdc4',
      harmony: '#45b7d1',
      bassline: '#96ceb4'
    };
    
    sources.forEach(source => {
      const sourceBeats = recentBeats.filter(b => b.source === source);
      if (sourceBeats.length < 2) return;
      
      ctx.strokeStyle = colors[source as keyof typeof colors];
      ctx.lineWidth = 2;
      ctx.beginPath();
      
      sourceBeats.forEach((beat, i) => {
        const x = (i / recentBeats.length) * canvas.width;
        const y = centerY - (beat.drift * pixelsPerMs);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      
      ctx.stroke();
    });
  }, [recentBeats]);

  const getSyncQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 75) return 'text-yellow-400';
    if (score >= 50) return 'text-orange-400';
    return 'text-red-400';
  };

  const getDriftTrendEmoji = (trend: string) => {
    switch (trend) {
      case 'stable': return '✅';
      case 'early': return '⏪';
      case 'late': return '⏩';
      case 'erratic': return '🔀';
      default: return '❓';
    }
  };

  return (
    <div className="bg-gray-900 p-4 rounded-lg space-y-4">
      <h2 className="text-xl font-bold text-white mb-4">Beat Timing Analysis</h2>
      
      {/* Timing Graph */}
      <div className="bg-black rounded p-2">
        <canvas 
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full"
          style={{ imageRendering: 'crisp-edges' }}
        />
      </div>
      
      {/* Overall Statistics */}
      <div className="bg-gray-800 p-3 rounded">
        <h3 className="text-lg font-semibold text-white mb-2">Overall Timing</h3>
        {stats.overall && (
          <div className="grid grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-gray-400">Sync Score</p>
              <p className={`text-2xl font-mono ${getSyncQualityColor(stats.overall.syncScore)}`}>
                {stats.overall.syncScore.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-gray-400">Average Drift</p>
              <p className="text-xl font-mono text-white">
                {stats.overall.averageDrift > 0 ? '+' : ''}{stats.overall.averageDrift.toFixed(1)}ms
              </p>
            </div>
            <div>
              <p className="text-gray-400">Jitter</p>
              <p className="text-xl font-mono text-white">
                ±{stats.overall.jitter.toFixed(1)}ms
              </p>
            </div>
            <div>
              <p className="text-gray-400">Trend</p>
              <p className="text-xl">
                {getDriftTrendEmoji(stats.overall.driftTrend)} {stats.overall.driftTrend}
              </p>
            </div>
          </div>
        )}
      </div>
      
      {/* Per-Source Statistics */}
      <div className="grid grid-cols-2 gap-3">
        {['drums', 'metronome', 'harmony', 'bassline'].map(source => {
          const sourceStats = stats[source];
          if (!sourceStats || sourceStats.totalBeats === 0) return null;
          
          return (
            <div key={source} className="bg-gray-800 p-3 rounded">
              <h4 className="font-semibold text-white capitalize mb-2">{source}</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Consistency:</span>
                  <span className={`font-mono ${getSyncQualityColor(sourceStats.consistency)}`}>
                    {sourceStats.consistency.toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Drift:</span>
                  <span className="font-mono text-white">
                    {sourceStats.averageDrift > 0 ? '+' : ''}{sourceStats.averageDrift.toFixed(1)}ms
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Beats:</span>
                  <span className="font-mono text-white">{sourceStats.totalBeats}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Source Comparison */}
      {comparison && (
        <div className="bg-gray-800 p-3 rounded">
          <h3 className="text-lg font-semibold text-white mb-2">
            {comparison.sources[0]} vs {comparison.sources[1]}
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-400">Timing Difference</p>
              <p className="text-xl font-mono text-white">
                {comparison.averageDifference > 0 ? '+' : ''}{comparison.averageDifference.toFixed(1)}ms
              </p>
            </div>
            <div>
              <p className="text-gray-400">Correlation</p>
              <p className={`text-xl font-mono ${getSyncQualityColor(comparison.correlation)}`}>
                {comparison.correlation.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Export Button */}
      <button
        onClick={() => {
          const report = beatTimingAnalyzer.exportData();
          console.log(report);
          navigator.clipboard.writeText(report);
          alert('Timing report copied to clipboard!');
        }}
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
      >
        Export Timing Report
      </button>
    </div>
  );
}