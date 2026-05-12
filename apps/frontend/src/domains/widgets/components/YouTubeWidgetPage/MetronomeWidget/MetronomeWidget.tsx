'use client';

/**
 * MetronomeWidget Component (Refactored)
 *
 * A compact metronome widget with beat visualization, volume control,
 * and customizable sound presets.
 *
 * This refactored version serves as a minimal orchestrator (~250 lines),
 * delegating complex logic to specialized hooks and rendering to sub-components.
 */

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { VolumeKnob } from '../components/VolumeKnob.js';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { useTransportControls } from '@/domains/playback/contexts/TransportContext';
import { getLogger } from '@/utils/logger.js';
import { lifecycle } from '@/domains/playback/utils/InitializationLifecycleLogger.js';

// Local module imports
import type { MetronomeWidgetProps, MetronomeSoundType } from './types.js';
import { MetronomeSound, initialDots } from './types.js';
import { useVolumeControl } from './hooks/useVolumeControl.js';
import { usePluginLoading } from './hooks/usePluginLoading.js';
import { usePluginCreation } from './hooks/usePluginCreation.js';
import { useMetronomePattern } from './hooks/useMetronomePattern.js';
import { useTimeSignature } from './hooks/useTimeSignature.js';
import { useMetronomeRegistration } from './hooks/useMetronomeRegistration.js';
import { BeatIndicators, ExpandedControls } from './components/index.js';

const logger = getLogger('metronome-widget');

const MetronomeWidgetComponent = ({
  isVisible,
  isPlaying: isPlayingProp,
  onToggleVisibility,
  onTogglePlay,
  timeSignature,
  volume: controlledVolume,
  isMuted: controlledMuted,
  onVolumeChange,
  onMuteToggle,
}: MetronomeWidgetProps) => {
  // Lifecycle checkpoint: Widget mounted
  useEffect(() => {
    lifecycle.checkpoint('METRONOME_WIDGET_MOUNTED');
  }, []);

  // Get tempo from Transport controls (stable - no position re-renders)
  const transport = useTransportControls();
  const bpm = transport.tempo;

  // UI state
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentSound, setCurrentSound] = useState<MetronomeSoundType>(
    MetronomeSound.CLASSIC
  );
  const [subdivisions, setSubdivisions] = useState(1);
  const [pluginLoadAttempts, setPluginLoadAttempts] = useState(0);

  // Plugin loading state
  const [wamPluginLoaded, setWamPluginLoaded] = useState(false);
  const [pluginClassLoaded, setPluginClassLoaded] = useState(false);

  // Plugin refs
  const wamPluginClassRef = useRef<any>(null);
  const metronomePluginRef = useRef<any>(null);
  const currentRegionRef = useRef<string | null>(null);

  // Create track for metronome
  const track = useTrack({
    trackId: 'metronome-widget-track',
    name: 'Metronome',
    type: 'utility',
    debugMode: false,
  });
  const trackIsReady = track.isReady;

  // Time signature hook
  const { beats, noteValue, setBeats, setNoteValue } = useTimeSignature({
    timeSignature,
    defaultBeats: 4,
    defaultNoteValue: 4,
  });

  // Metronome pattern hook
  const { createMetronomePattern } = useMetronomePattern({
    beats,
    noteValue,
    subdivisions,
  });

  // Volume control hook
  const { volume, isMuted, handleVolumeChange, handleMuteToggle, effectiveVolume } =
    useVolumeControl({
      controlledVolume,
      controlledMuted,
      onVolumeChange,
      onMuteToggle,
      metronomePluginRef,
      defaultVolume: 80,
    });

  // Callback for plugin class loaded
  const handlePluginClassLoaded = useCallback(() => {
    setPluginClassLoaded(true);
  }, []);

  // Callback for preloaded plugin found
  const handlePreloadedPluginFound = useCallback(
    async (vol: number, muted: boolean) => {
      setWamPluginLoaded(true);
      setPluginClassLoaded(true);

      // Set initial volume
      if (metronomePluginRef.current?.audioNode) {
        await metronomePluginRef.current.audioNode.setParameterValues({
          volume: muted ? 0 : vol / 100,
        });
      }
    },
    []
  );

  // Plugin loading hook (Phase 1)
  usePluginLoading({
    pluginClassLoaded,
    wamPluginClassRef,
    metronomePluginRef,
    onPluginClassLoaded: handlePluginClassLoaded,
    onPreloadedPluginFound: handlePreloadedPluginFound,
    volume,
    isMuted,
  });

  // Callback for plugin loaded
  const handlePluginLoaded = useCallback(() => {
    setWamPluginLoaded(true);
  }, []);

  // Plugin creation hook (Phase 2)
  usePluginCreation({
    pluginClassLoaded,
    wamPluginClassRef,
    metronomePluginRef,
    trackIsReady,
    wamPluginLoaded,
    pluginLoadAttempts,
    beats,
    volume,
    isMuted,
    createMetronomePattern,
    onPluginLoaded: handlePluginLoaded,
    currentRegionRef,
    track,
  });

  // Metronome registration hook (handles tempo, time sig, patterns)
  const { handleSoundChange, handleSubdivisionChange, testClick } =
    useMetronomeRegistration({
      metronomePluginRef,
      wamPluginLoaded,
      beats,
      noteValue,
      bpm,
      subdivisions,
      currentSound,
      createMetronomePattern,
      currentRegionRef,
      track,
      setCurrentSound,
      MetronomeSound,
    });

  // Wrap subdivision change to also update local state
  const handleSubdivChange = useCallback(
    (subdiv: number) => {
      setSubdivisions(subdiv);
      handleSubdivisionChange(subdiv);
    },
    [handleSubdivisionChange]
  );

  // Get isPlaying from TransportContext (same source as TransportClock which works)
  const { isPlaying: isTransportContextPlaying } = transport;

  // Use TransportContext's isPlaying as the AUTHORITATIVE source for beat indicator
  const isPlaying = isTransportContextPlaying;

  // Handle play state changes - reset visual when stopped
  useEffect(() => {
    if (!isPlaying && metronomePluginRef.current) {
      // Visual reset is handled by beat indicators component
    }
  }, [isPlaying]);

  // Memoize handlers for child components
  const handleExpandClick = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const handleCollapseClick = useCallback(() => {
    setIsExpanded(false);
  }, []);

  // Early return if not visible
  if (!isVisible) return null;

  const isMutedOrZero = volume === 0 || isMuted;

  return (
    <div
      className={`relative bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-1 h-24 shadow-2xl shadow-black/20 transition-all duration-300 select-none overflow-hidden ${
        isMutedOrZero ? 'grayscale brightness-100' : ''
      }`}
    >
      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10 pointer-events-none" />
      <div className="relative flex items-center justify-between h-full">
        {/* Volume Knob */}
        <div className="flex justify-center items-center w-20 h-16">
          <VolumeKnob
            value={volume}
            onChange={handleVolumeChange}
            color="bg-green-400"
            size={45}
            isMuted={isMuted}
            onMuteToggle={handleMuteToggle}
            defaultValue={80}
          />
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <div className="flex items-center justify-between px-4 py-2">
            {!isExpanded ? (
              <>
                <div className="flex-1">
                  <h3
                    className={`font-semibold text-sm ${
                      isMutedOrZero ? 'text-slate-600' : 'text-white'
                    }`}
                  >
                    Metronome Track
                  </h3>
                  <p
                    className={`text-xs ${
                      isMutedOrZero ? 'text-slate-600' : 'text-slate-400'
                    }`}
                  >
                    {beats}/{noteValue} | {currentSound}
                  </p>
                </div>

                <BeatIndicators
                  beats={beats}
                  isPlaying={isPlaying}
                  isVisible={isVisible}
                  isMutedOrZero={isMutedOrZero}
                  onClick={handleExpandClick}
                />
              </>
            ) : (
              <ExpandedControls
                currentSound={currentSound}
                subdivisions={subdivisions}
                trackIsReady={trackIsReady}
                onSoundChange={handleSoundChange}
                onSubdivisionChange={handleSubdivChange}
                onTestClick={testClick}
                onClose={handleCollapseClick}
              />
            )}
          </div>
        </div>
      </div>

      {/* Play Control (if provided) */}
      {onTogglePlay && isExpanded && (
        <div className="absolute bottom-2 right-2">
          <button
            onClick={onTogglePlay}
            className={`px-3 py-1 text-xs rounded font-medium transition-colors ${
              isPlaying
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-green-600 hover:bg-green-700 text-white'
            }`}
            disabled={!trackIsReady}
          >
            {isPlaying ? 'Stop' : 'Play'}
          </button>
        </div>
      )}
    </div>
  );
};

// Wrap in React.memo to prevent unnecessary re-renders
export const MetronomeWidget = React.memo(MetronomeWidgetComponent);
