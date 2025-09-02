/**
 * Integrated Drummer Widget with Track System
 *
 * This example shows how to connect the existing DrummerWidget
 * to the new track-based architecture to eliminate tempo fluctuations.
 *
 * Key improvements:
 * - Uses UnifiedTransport master clock (no more tempo drift!)
 * - Sample-accurate synchronization across all instruments
 * - Professional mixing capabilities
 * - Resource-optimized plugin management
 */

import React, { useEffect, useState } from 'react';
import { DrummerWidget } from '../components/YouTubeWidgetPage/components/DrummerWidget';
import { useTrackCompatibility } from '@/domains/playback/hooks/useTrackCompatibility';
import { useTrackMixing } from '@/domains/playback/hooks/useTrackMixing';
import { useTrackTiming } from '@/domains/playback/hooks/useTrackTiming';
import { CoreServices } from '@/domains/playback/services/core';
import type { Exercise, DrumPattern } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

export function IntegratedDrummerTrack() {
  const { correlationId, logger } = useCorrelation('IntegratedDrummerTrack');
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);

  // Generate a unique widget ID for this drummer instance
  const widgetId = 'drummer-widget-1';

  // Connect the drummer widget to the track system
  const trackCompat = useTrackCompatibility({
    widgetId,
    widgetType: 'drums',
    enabled: true,
    priority: 100, // High priority for drums
    onPatternTrigger: (event, time) => {
      // This will be called for each drum hit with sample-accurate timing
      logger.info('🥁 Drum hit:', event, 'at time:', time);
    },
    debugMode: true, // Enable debug logging to see what's happening
  });

  // Get mixing controls if we have a track
  const drumMixing = trackCompat.trackId
    ? useTrackMixing({
        trackId: trackCompat.trackId,
        autoCreate: false, // Track already created by adapter
      })
    : null;

  // Get timing metrics if we have a track
  const drumTiming = trackCompat.trackId
    ? useTrackTiming(trackCompat.trackId)
    : null;

  // Initialize core services on mount
  useEffect(() => {
    const init = async () => {
      try {
        const services = await CoreServices.createCoreServicesWithPreInit();
        logger.info('✅ Core services initialized');

        // The track system is now ready
        // UnifiedTransport is providing sample-accurate timing
      } catch (error) {
        logger.error('Failed to initialize core services:', error);
      }
    };

    init();
  }, []);

  // Create a drum pattern for testing
  useEffect(() => {
    if (trackCompat.isRegistered) {
      // Create a simple 4/4 drum pattern
      const pattern: DrumPattern = {
        type: 'drums',
        name: 'Basic Beat',
        events: [
          // Kick on 1 and 3
          { time: 0.0, drum: 'kick', velocity: 100 },
          { time: 0.5, drum: 'kick', velocity: 100 },

          // Snare on 2 and 4
          { time: 0.25, drum: 'snare', velocity: 80 },
          { time: 0.75, drum: 'snare', velocity: 80 },

          // Hi-hat eighth notes
          { time: 0.0, drum: 'hihat', velocity: 60 },
          { time: 0.125, drum: 'hihat', velocity: 40 },
          { time: 0.25, drum: 'hihat', velocity: 60 },
          { time: 0.375, drum: 'hihat', velocity: 40 },
          { time: 0.5, drum: 'hihat', velocity: 60 },
          { time: 0.625, drum: 'hihat', velocity: 40 },
          { time: 0.75, drum: 'hihat', velocity: 60 },
          { time: 0.875, drum: 'hihat', velocity: 40 },
        ],
        duration: 1.0, // 1 bar
        loop: true,
      };

      // Update the pattern in the track system
      trackCompat.updatePattern(pattern);
      logger.info('📐 Drum pattern registered with track system');
    }
  }, [trackCompat.isRegistered]);

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">
        Drummer with Track System Integration
      </h1>

      {/* Connection Status */}
      <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Track System Status</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Widget Registered: </span>
            <span
              className={
                trackCompat.isRegistered ? 'text-green-600' : 'text-red-600'
              }
            >
              {trackCompat.isRegistered ? '✅ Yes' : '❌ No'}
            </span>
          </div>
          <div>
            <span className="font-medium">Track ID: </span>
            <span className="font-mono text-xs">
              {trackCompat.trackId || 'Not assigned'}
            </span>
          </div>
        </div>
      </div>

      {/* Timing Precision (if connected) */}
      {drumTiming && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
          <h2 className="font-semibold mb-2">🎯 Timing Precision</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="font-medium">Drift: </span>
              <span
                className={
                  drumTiming.metrics.drift < 1
                    ? 'text-green-600'
                    : 'text-red-600'
                }
              >
                {drumTiming.metrics.drift.toFixed(3)}ms
              </span>
            </div>
            <div>
              <span className="font-medium">Jitter: </span>
              <span
                className={
                  drumTiming.metrics.jitter < 0.5
                    ? 'text-green-600'
                    : 'text-yellow-600'
                }
              >
                {drumTiming.metrics.jitter.toFixed(3)}ms
              </span>
            </div>
            <div>
              <span className="font-medium">Health: </span>
              <span
                className={
                  drumTiming.isHealthy ? 'text-green-600' : 'text-red-600'
                }
              >
                {drumTiming.isHealthy ? '✅ Perfect' : '⚠️ Issues'}
              </span>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
            Using UnifiedTransport AudioWorklet master clock - no more tempo
            fluctuations!
          </div>
        </div>
      )}

      {/* Mixing Controls (if connected) */}
      {drumMixing && (
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
          <h2 className="font-semibold mb-4">🎚️ Track Mixing</h2>

          <div className="space-y-3">
            {/* Volume */}
            <div>
              <label className="block text-sm font-medium mb-1">Volume</label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={drumMixing.volume}
                onChange={(e) =>
                  drumMixing.setVolume(parseFloat(e.target.value))
                }
                className="w-full"
              />
              <span className="text-xs text-gray-600">
                {Math.round(drumMixing.volume * 100)}%
              </span>
            </div>

            {/* Pan */}
            <div>
              <label className="block text-sm font-medium mb-1">Pan</label>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.01"
                value={drumMixing.pan}
                onChange={(e) => drumMixing.setPan(parseFloat(e.target.value))}
                className="w-full"
              />
              <span className="text-xs text-gray-600">
                {drumMixing.pan === 0
                  ? 'Center'
                  : drumMixing.pan < 0
                    ? `${Math.abs(drumMixing.pan * 100).toFixed(0)}% Left`
                    : `${(drumMixing.pan * 100).toFixed(0)}% Right`}
              </span>
            </div>

            {/* Buttons */}
            <div className="flex gap-2">
              <button
                onClick={() => drumMixing.setMute(!drumMixing.mute)}
                className={`px-3 py-1 rounded text-sm ${
                  drumMixing.mute
                    ? 'bg-red-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                {drumMixing.mute ? '🔇 Unmute' : '🔊 Mute'}
              </button>
              <button
                onClick={() => drumMixing.setSolo(!drumMixing.solo)}
                className={`px-3 py-1 rounded text-sm ${
                  drumMixing.solo
                    ? 'bg-yellow-500 text-white'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                {drumMixing.solo ? '🎧 Unsolo' : '🎧 Solo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The Drummer Widget */}
      <div className="border-2 border-gray-300 dark:border-gray-700 rounded-lg p-4">
        <h2 className="font-semibold mb-4">🥁 Drummer Widget</h2>
        <DrummerWidget
          pattern="Rock Steady"
          isVisible={true}
          isPlaying={isPlaying}
          exercise={exercise}
          onPatternChange={(pattern) => logger.info('Pattern changed:', pattern)}
          onToggleVisibility={() => logger.info('Visibility toggled')}
          onTogglePlay={() => setIsPlaying(!isPlaying)}
          tempo={tempo}
        />
      </div>

      {/* Performance Metrics */}
      <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">📊 Performance</h2>
        <div className="text-sm space-y-1">
          <div>Events processed: {trackCompat.metrics.eventCount}</div>
          <div>
            Last event:{' '}
            {trackCompat.metrics.lastEventTime > 0
              ? new Date(trackCompat.metrics.lastEventTime).toLocaleTimeString()
              : 'None'}
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            The track system ensures all drum hits are perfectly synchronized
            with other instruments. No more timing drift between drums, bass,
            and chords!
          </div>
        </div>
      </div>

      {/* Migration Helper */}
      <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">🚀 Full Track Migration</h2>
        <p className="text-sm mb-3">
          Currently using compatibility mode. Click below to fully migrate this
          drummer to a dedicated track:
        </p>
        <button
          onClick={async () => {
            const track = await trackCompat.migrateToTrack();
            if (track) {
              logger.info('✅ Migrated to full track:', track);
              alert(`Drummer migrated to track: ${track.name}`);
            }
          }}
          className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          Migrate to Full Track Mode
        </button>
      </div>
    </div>
  );
}
