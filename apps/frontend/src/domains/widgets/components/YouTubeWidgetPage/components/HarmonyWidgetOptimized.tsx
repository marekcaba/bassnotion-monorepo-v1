'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { VolumeKnob } from './VolumeKnob';

const logger = {
  log: (...args: any[]) => console.log('🎵 HarmonyWidget:', ...args),
  error: (...args: any[]) => console.error('🎵 HarmonyWidget Error:', ...args),
};

interface HarmonyWidgetProps {
  progression: string[];
  isPlaying: boolean;
  isVisible: boolean;
  onProgressionChange: (progression: string[]) => void;
  onToggleVisibility: () => void;
  onTogglePlay?: () => void;
}

export function HarmonyWidgetOptimized({
  progression,
  isPlaying,
  isVisible,
  onProgressionChange,
  onToggleVisibility,
  onTogglePlay,
}: HarmonyWidgetProps) {
  const [currentChordIndex, setCurrentChordIndex] = useState(-1);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [samplesLoaded, setSamplesLoaded] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Not started');
  const [toneLoaded, setToneLoaded] = useState(false);
  
  // Store Tone module and processor
  const toneRef = useRef<typeof import('tone') | null>(null);
  const processorRef = useRef<any>(null);
  const transportEventsRef = useRef<number[]>([]);

  // FAST INIT: Load Tone.js and samples immediately on mount (like DrummerWidget)
  useEffect(() => {
    const initializeImmediately = async () => {
      logger.log('🚀 FAST INIT: Loading Tone.js and samples immediately...');
      
      try {
        // 1. Load Tone.js
        const Tone = await import('tone');
        toneRef.current = Tone;
        
        // Try to start audio context (may be suspended until user interaction)
        const audioContext = Tone.context.rawContext as AudioContext;
        if (audioContext.state === 'suspended') {
          audioContext.resume().catch(() => {
            logger.log('Audio context suspended until user interaction - this is normal');
          });
        }
        
        logger.log('Tone.js loaded, context state:', audioContext.state);
        setToneLoaded(true);
        
        // 2. Check for preloaded samples from BackgroundSampleLoader
        try {
          const { getBackgroundLoader } = await import('@/domains/playback/services/BackgroundSampleLoader');
          const loader = getBackgroundLoader();
          const preloadedSamples = loader.getPreloadedSamples('harmony');
          
          if (preloadedSamples) {
            const status = loader.getSampleStatus('harmony');
            logger.log(`🎉 Using preloaded harmony samples (${status.quality} quality)!`);
            processorRef.current = preloadedSamples;
            setSamplesLoaded(true);
            setLoadingStatus(`Ready (${status.quality})`);
            return; // Done!
          }
        } catch (error) {
          logger.log('BackgroundSampleLoader not available, will load on demand');
        }
        
        // 3. Fallback: Load ChordInstrumentProcessor on demand
        logger.log('Loading ChordInstrumentProcessor on demand...');
        setLoadingStatus('Loading samples...');
        
        // CRITICAL: Ensure AudioContext is running before loading samples
        if (audioContext.state === 'suspended') {
          logger.log('⚠️ AudioContext suspended, will resume on first interaction');
          // Don't wait for resume - just proceed with loading
          // The context will resume on first user interaction
        }
        
        const { ChordInstrumentProcessor, ChordPreset } = await import(
          '@/domains/playback/services/plugins/ChordInstrumentProcessor'
        );
        
        const processor = new ChordInstrumentProcessor();
        
        // Add timeout to prevent hanging - 3 seconds max
        const loadWithTimeout = async () => {
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Sample loading timeout')), 3000)
          );
          
          const loadPromise = (async () => {
            try {
              await processor.setPreset(ChordPreset.PIANO);
              // Don't wait for ensureSamplesLoaded if context is suspended
              if (audioContext.state === 'running') {
                await processor.ensureSamplesLoaded();
              } else {
                logger.log('⚠️ AudioContext suspended, skipping sample wait');
              }
            } catch (err) {
              logger.error('Error during sample loading:', err);
              throw err;
            }
          })();
          
          return Promise.race([loadPromise, timeoutPromise]);
        };
        
        try {
          await loadWithTimeout();
          processorRef.current = processor;
          setSamplesLoaded(true);
          setLoadingStatus('Ready');
          logger.log('✅ Harmony samples loaded and ready!');
        } catch (timeoutError) {
          logger.error('Sample loading timed out or failed (3s limit), using processor anyway:', timeoutError);
          // Still use the processor even if samples didn't fully load
          // The processor can still work with partial or no samples
          processorRef.current = processor;
          setSamplesLoaded(true);
          setLoadingStatus('Ready (fallback)');
        }
        
      } catch (error) {
        logger.error('Failed to initialize:', error);
        setLoadingStatus('Error loading');
      }
    };

    // Start immediately - no waiting!
    initializeImmediately();

    // Handle clicks to resume audio context if needed
    const handleClick = async () => {
      if (toneRef.current) {
        const Tone = toneRef.current;
        const audioContext = Tone.context.rawContext as AudioContext;
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
          logger.log('Resumed audio context on user interaction');
        }
      }
    };

    document.addEventListener('click', handleClick);
    return () => {
      document.removeEventListener('click', handleClick);
      
      // Cleanup
      if (processorRef.current && typeof processorRef.current.dispose === 'function') {
        processorRef.current.dispose();
      }
    };
  }, []); // Run once on mount

  // Track if events are already scheduled
  const eventsScheduledRef = useRef(false);

  // Schedule chord playback when playing
  useEffect(() => {
    if (!toneRef.current || !samplesLoaded || !processorRef.current) return;
    
    const Tone = toneRef.current;
    
    const handleTransport = async () => {
      // Ensure audio context is running
      const audioContext = Tone.context.rawContext as AudioContext;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        logger.log('Audio context resumed:', audioContext.state);
      }
      
      if (isPlaying && progression.length > 0) {
        // Don't clear events if already scheduled and playing
        if (eventsScheduledRef.current && transportEventsRef.current.length > 0) {
          logger.log('Chord events already scheduled, keeping them active');
          return;
        }
        
        // Clear any existing events
        transportEventsRef.current.forEach(id => Tone.Transport.clear(id));
        transportEventsRef.current = [];
        
        // Schedule chord progression
        let totalBeats = 0;
        progression.forEach((chord, index) => {
          const chordDuration = 4; // Default 4 beats per chord
          const startBeat = totalBeats;
          
          // Schedule chord to play at the right time
          const eventId = Tone.Transport.scheduleRepeat((time) => {
            logger.log(`Playing chord ${chord} at beat ${startBeat}`);
            setCurrentChordIndex(index);
            
            // Play the chord
            if (processorRef.current && typeof processorRef.current.playChord === 'function') {
              processorRef.current.playChord(chord, {
                duration: chordDuration * 0.5, // seconds
                velocity: 0.7,
                time: time
              });
            }
          }, `${progression.length * 4}m`, `0:${startBeat}:0`);
          
          transportEventsRef.current.push(eventId);
          totalBeats += chordDuration;
        });
        
        eventsScheduledRef.current = true;
        logger.log(`Scheduled ${progression.length} chords to play`);
        
      } else {
        // Clear scheduled events
        transportEventsRef.current.forEach(id => Tone.Transport.clear(id));
        transportEventsRef.current = [];
        eventsScheduledRef.current = false;
        setCurrentChordIndex(-1);
        
        // Stop any playing sounds
        if (processorRef.current && typeof processorRef.current.stopChord === 'function') {
          processorRef.current.stopChord();
        }
        
        logger.log('Cleared chord events');
      }
    };
    
    handleTransport();
  }, [isPlaying, samplesLoaded, progression]);

  // Handle volume changes
  useEffect(() => {
    if (!processorRef.current || typeof processorRef.current.setVolume !== 'function') return;
    
    const volumeValue = isMuted ? 0 : volume / 100;
    processorRef.current.setVolume(volumeValue);
  }, [volume, isMuted]);

  // Manual chord test
  const testChord = async (chord: string) => {
    if (!toneRef.current || !processorRef.current) {
      logger.log('Cannot test chord - not ready');
      return;
    }
    
    const Tone = toneRef.current;
    const audioContext = Tone.context.rawContext as AudioContext;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    logger.log(`Testing chord: ${chord}`);
    if (typeof processorRef.current.playChord === 'function') {
      processorRef.current.playChord(chord, {
        duration: 1,
        velocity: 0.7
      });
    }
  };

  if (!isVisible) return null;

  return (
    <div
      className={`relative bg-slate-800 rounded-2xl px-4 py-1 h-24 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 select-none ${
        volume === 0 || isMuted ? 'bg-slate-850 grayscale brightness-100' : ''
      }`}
    >
      <div className="flex items-center justify-between h-full">
        {/* Volume Knob */}
        <div className="flex justify-center items-center w-20 h-16">
          <VolumeKnob
            value={volume}
            onChange={setVolume}
            color="bg-purple-400"
            size={45}
            isMuted={isMuted}
            onMuteToggle={() => setIsMuted(!isMuted)}
          />
        </div>

        {/* Title and Progression Display */}
        <div className="flex-1 px-4">
          <h3 className={`font-semibold text-sm ${volume === 0 ? 'text-slate-600' : 'text-white'}`}>
            Harmony
          </h3>
          <p className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}>
            {loadingStatus} | {progression.length} chords
          </p>
          
          {/* Chord progression display */}
          <div className="flex gap-2 mt-1">
            {progression.slice(0, 8).map((chord, i) => (
              <button
                key={i}
                onClick={() => testChord(chord)}
                className={`text-xs px-2 py-1 rounded transition-all ${
                  currentChordIndex === i && isPlaying
                    ? 'bg-purple-500 text-white shadow-lg shadow-purple-500/50'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {chord}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}