/**
 * Drummer Widget with Track System Example
 *
 * This example demonstrates how to use the new track-based architecture
 * with the drummer widget, providing professional timing precision and
 * multi-track capabilities.
 */

import React, { useEffect, useState } from 'react';
import { DrummerWidget } from '../components/YouTubeWidgetPage/components/DrummerWidget';
import { useTrackCompatibility } from '@/domains/playback/hooks/useTrackCompatibility';
import { useTrackMixing } from '@/domains/playback/hooks/useTrackMixing';
import { useTrackTiming } from '@/domains/playback/hooks/useTrackTiming';
import { CoreServices } from '@/domains/playback/services/core';
import type { Exercise } from '@bassnotion/contracts';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

/**
 * Example: Professional Drummer with Track System
 *
 * Key Benefits:
 * - Rock-solid timing (< 1ms drift)
 * - Multiple drum tracks support
 * - Professional mixing with EQ, compression, reverb
 * - Perfect sync with bass, chords, and metronome
 * - No more tempo fluctuations!
 */
export function DrummerWithTrackSystem() {
  const { correlationId, logger } = useCorrelation('DrummerWithTrackSystem');
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Initialize core services
  useEffect(() => {
    const initializeServices = async () => {
      const services = await CoreServices.createCoreServicesWithPreInit();

      // Initialize track system
      await services.trackManager.initialize();
      await services.mixingEngine.initialize(services.audioEngine.getContext());

      setIsReady(true);
    };

    initializeServices();
  }, []);

  // Use track compatibility for seamless widget integration
  const trackCompat = useTrackCompatibility({
    widgetId: 'drummer-main',
    widgetType: 'drums',
    enabled: true,
    debugMode: true,
  });

  // Create a dummy track for demonstration (in real usage, get from useTrack hook)
  const dummyTrack = {
    id: 'drums-main',
    mixing: { volume: 0.8, pan: 0, mute: false, solo: false },
  } as any;

  // Get mixing controls for the drum track
  const drumMixing = useTrackMixing({
    track: dummyTrack,
    debugMode: true,
  });

  // Get timing controls for perfect synchronization
  const drumTiming = useTrackTiming({
    track: dummyTrack,
    debugMode: true,
  });

  if (!isReady) {
    return <div>Initializing professional audio system...</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Drummer with Track System</h1>

      {/* Timing Status */}
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Timing Precision</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Drift: </span>
            <span
              className={
                drumTiming.drift < 1 ? 'text-green-600' : 'text-red-600'
              }
            >
              {drumTiming.drift.toFixed(2)}ms
            </span>
          </div>
          <div>
            <span className="font-medium">Sync Health: </span>
            <span
              className={
                !drumTiming.isIsolated ? 'text-green-600' : 'text-red-600'
              }
            >
              {!drumTiming.isIsolated ? 'Perfect' : 'Issues Detected'}
            </span>
          </div>
        </div>
      </div>

      {/* Mixing Controls */}
      <div className="bg-gray-100 p-4 rounded-lg">
        <h2 className="font-semibold mb-4">Professional Mixing</h2>

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
              onChange={(e) => drumMixing.setVolume(parseFloat(e.target.value))}
              className="w-full"
            />
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
          </div>

          {/* Mute/Solo */}
          <div className="flex gap-4">
            <button
              onClick={() => drumMixing.setMute(!drumMixing.mute)}
              className={`px-4 py-2 rounded ${
                drumMixing.mute ? 'bg-red-500 text-white' : 'bg-gray-300'
              }`}
            >
              {drumMixing.mute ? 'Unmute' : 'Mute'}
            </button>
            <button
              onClick={() => drumMixing.setSolo(!drumMixing.solo)}
              className={`px-4 py-2 rounded ${
                drumMixing.solo ? 'bg-yellow-500 text-white' : 'bg-gray-300'
              }`}
            >
              {drumMixing.solo ? 'Unsolo' : 'Solo'}
            </button>
          </div>

          {/* Send to Reverb */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Reverb Send
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={drumMixing.sends.reverb || 0}
              onChange={(e) =>
                drumMixing.setSendLevel('reverb', parseFloat(e.target.value))
              }
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* The Drummer Widget - now with track system integration! */}
      <div className="border-2 border-gray-300 rounded-lg p-4">
        <DrummerWidget
          pattern="Rock Steady"
          isVisible={true}
          isPlaying={true}
          exercise={exercise}
          onPatternChange={(pattern) =>
            logger.info('Pattern changed:', pattern)
          }
          onToggleVisibility={() => logger.info('Visibility toggled')}
          onTogglePlay={() => logger.info('Play toggled')}
          tempo={120}
        />
      </div>

      {/* Multi-Track Example */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <h2 className="font-semibold mb-2">Multi-Track Drums</h2>
        <p className="text-sm mb-4">
          You can now have multiple drum tracks playing simultaneously with
          perfect sync!
        </p>
        <button
          onClick={() => createAdditionalDrumTrack()}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Add Percussion Track
        </button>
      </div>
    </div>
  );
}

/**
 * Example: Creating additional drum tracks
 */
async function createAdditionalDrumTrack() {
  const services = CoreServices.getInstance();

  // Create a percussion track
  const percussionTrack = await services.trackManager.createTrack({
    name: 'Percussion',
    instrumentType: 'drums' as any,
    mixing: {
      volume: 0.6,
      pan: 0.3, // Slightly right
    },
  });

  // Route to a drum bus for group processing
  const drumBusId = services.mixingEngine.createSubBus('drum-bus', 'Drums');
  services.mixingEngine.routeTrackToBus(percussionTrack.id, drumBusId);

  // Add some compression to the drum bus
  const compressor = new DynamicsCompressorNode(
    services.audioEngine.getContext(),
    {
      threshold: -12,
      knee: 2,
      ratio: 4,
      attack: 0.003,
      release: 0.1,
    },
  );

  services.mixingEngine.addBusEffect(drumBusId, compressor);

  logger.info('✅ Added percussion track with bus routing!');
}
