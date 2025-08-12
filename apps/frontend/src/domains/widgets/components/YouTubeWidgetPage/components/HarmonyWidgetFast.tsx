'use client';

import React, { useEffect, useState, useRef } from 'react';
import { VolumeKnob } from './VolumeKnob';

const logger = {
  log: (...args: any[]) => console.log('🎵 HarmonyWidgetFast:', ...args),
  error: (...args: any[]) => console.error('🎵 HarmonyWidgetFast Error:', ...args),
};

interface HarmonyWidgetProps {
  progression: string[];
  isPlaying: boolean;
  isVisible: boolean;
  onProgressionChange: (progression: string[]) => void;
  onToggleVisibility: () => void;
  onTogglePlay?: () => void;
}

/**
 * Ultra-fast HarmonyWidget that loads instantly like DrummerWidget
 * Uses a simple synth fallback if samples take too long
 */
export function HarmonyWidgetFast({
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
  const [loadingStatus, setLoadingStatus] = useState('Loading...');
  const [isReady, setIsReady] = useState(false);
  
  // Store Tone module and audio source
  const toneRef = useRef<typeof import('tone') | null>(null);
  const audioSourceRef = useRef<any>(null);
  const transportEventsRef = useRef<number[]>([]);
  const hasInitializedRef = useRef(false);

  // ULTRA FAST: Load Tone and create basic synth immediately
  useEffect(() => {
    // Prevent double initialization
    if (hasInitializedRef.current) return;
    hasInitializedRef.current = true;
    
    const initImmediately = async () => {
      logger.log('🚀 ULTRA FAST INIT: Creating synth immediately...');
      
      // 1. Load Tone.js
      const Tone = await import('tone');
      toneRef.current = Tone;
      
      // 2. Create a basic PolySynth immediately (no sample loading!)
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { 
          attack: 0.02,
          decay: 0.1,
          sustain: 0.3,
          release: 1
        }
      }).toDestination();
      
      synth.volume.value = -10;
      audioSourceRef.current = synth;
      
      // Force state update in next tick to ensure React picks it up
      await new Promise(resolve => setTimeout(resolve, 0));
      setIsReady(true);
      setLoadingStatus('Ready (synth)');
      logger.log('✅ Synth ready instantly!');
      
      // 3. Try to upgrade to samples in background (don't wait)
      upgradeToSamples();
    };
    
    const upgradeToSamples = async () => {
      try {
        logger.log('⬆️ Attempting to upgrade to real samples in background...');
        
        // Check BackgroundSampleLoader
        const { getBackgroundLoader } = await import('@/domains/playback/services/BackgroundSampleLoader');
        const loader = getBackgroundLoader();
        const preloadedSamples = loader.getPreloadedSamples('harmony');
        
        if (preloadedSamples && typeof preloadedSamples.playChord === 'function') {
          logger.log('✨ Upgrading to preloaded samples!');
          audioSourceRef.current = preloadedSamples;
          setLoadingStatus('Ready (samples)');
          return;
        }
        
        // Try loading ChordInstrumentProcessor with 5 second timeout
        const timeoutPromise = new Promise((resolve) => 
          setTimeout(() => {
            logger.log('⏱️ Sample loading timeout reached (5s)');
            resolve(null);
          }, 5000)
        );
        
        const loadPromise = (async () => {
          try {
            const { ChordInstrumentProcessor, ChordPreset } = await import(
              '@/domains/playback/services/plugins/ChordInstrumentProcessor'
            );
            const processor = new ChordInstrumentProcessor();
            
            // Try to set preset with a more aggressive timeout
            const presetTimeout = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Preset timeout')), 2000)
            );
            
            await Promise.race([
              processor.setPreset(ChordPreset.PIANO),
              presetTimeout
            ]);
            
            logger.log('✅ Processor preset loaded');
            return processor;
          } catch (presetError) {
            logger.log('❌ Preset loading failed:', presetError);
            return null;
          }
        })();
        
        const result = await Promise.race([loadPromise, timeoutPromise]);
        
        if (result) {
          logger.log('✨ Upgraded to ChordInstrumentProcessor!');
          audioSourceRef.current = result;
          setLoadingStatus('Ready (piano)');
        } else {
          logger.log('⏱️ Sample loading timed out or failed, keeping synth');
          setLoadingStatus('Ready (synth fallback)');
        }
      } catch (error) {
        logger.log('Sample upgrade failed, keeping synth:', error);
        setLoadingStatus('Ready (synth - error fallback)');
      }
    };
    
    initImmediately();
    
    // Cleanup
    return () => {
      if (audioSourceRef.current && typeof audioSourceRef.current.dispose === 'function') {
        audioSourceRef.current.dispose();
      }
    };
  }, []);

  // Schedule playback
  useEffect(() => {
    if (!toneRef.current || !isReady || !audioSourceRef.current) {
      logger.log('Not ready for playback:', { tone: !!toneRef.current, ready: isReady, source: !!audioSourceRef.current });
      return;
    }
    
    const Tone = toneRef.current;
    
    if (isPlaying && progression.length > 0) {
      // Clear old events
      transportEventsRef.current.forEach(id => Tone.Transport.clear(id));
      transportEventsRef.current = [];
      
      // Schedule chords
      let totalBeats = 0;
      progression.forEach((chord, index) => {
        const chordDuration = 4;
        const startBeat = totalBeats;
        
        const eventId = Tone.Transport.scheduleRepeat((time) => {
          setCurrentChordIndex(index);
          playChord(chord, time);
        }, `${progression.length * 4}m`, `0:${startBeat}:0`);
        
        transportEventsRef.current.push(eventId);
        totalBeats += chordDuration;
      });
      
      logger.log(`Scheduled ${progression.length} chords with synth`);
    } else {
      // Clear events
      transportEventsRef.current.forEach(id => Tone.Transport.clear(id));
      transportEventsRef.current = [];
      setCurrentChordIndex(-1);
      stopAllSounds();
    }
  }, [isPlaying, progression, isReady]);

  const playChord = (chord: string, time?: number) => {
    if (!audioSourceRef.current) return;
    
    // Map chord names to notes
    const chordNotes: Record<string, string[]> = {
      'C': ['C4', 'E4', 'G4'],
      'Am': ['A3', 'C4', 'E4'],
      'F': ['F3', 'A3', 'C4'],
      'G': ['G3', 'B3', 'D4'],
      'Dm': ['D4', 'F4', 'A4'],
      'Em': ['E4', 'G4', 'B4'],
      'Bb': ['Bb3', 'D4', 'F4'],
    };
    
    const notes = chordNotes[chord] || ['C4', 'E4', 'G4'];
    
    // Check if it's a processor or synth
    if (typeof audioSourceRef.current.playChord === 'function') {
      // It's a ChordInstrumentProcessor
      audioSourceRef.current.playChord(chord, {
        duration: 2,
        velocity: 0.7,
        time
      });
    } else if (typeof audioSourceRef.current.triggerAttackRelease === 'function') {
      // It's a PolySynth
      audioSourceRef.current.triggerAttackRelease(notes, '2n', time);
    }
  };
  
  const stopAllSounds = () => {
    if (!audioSourceRef.current) return;
    
    if (typeof audioSourceRef.current.stopChord === 'function') {
      audioSourceRef.current.stopChord();
    } else if (typeof audioSourceRef.current.releaseAll === 'function') {
      audioSourceRef.current.releaseAll();
    }
  };

  // Manual test
  const testChord = async (chord: string) => {
    if (!toneRef.current) return;
    
    const Tone = toneRef.current;
    const audioContext = Tone.context.rawContext as AudioContext;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    logger.log(`Testing chord: ${chord}`);
    playChord(chord);
  };

  // Volume control
  useEffect(() => {
    if (!audioSourceRef.current) return;
    
    const volumeValue = isMuted ? -Infinity : -30 + (volume * 0.3);
    
    if (audioSourceRef.current.volume) {
      audioSourceRef.current.volume.value = volumeValue;
    } else if (typeof audioSourceRef.current.setVolume === 'function') {
      audioSourceRef.current.setVolume(isMuted ? 0 : volume / 100);
    }
  }, [volume, isMuted]);

  if (!isVisible) return null;

  return (
    <div
      className={`relative bg-slate-800 rounded-2xl px-4 py-1 h-24 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)] transition-all duration-300 select-none ${
        volume === 0 || isMuted ? 'bg-slate-850 grayscale brightness-100' : ''
      }`}
    >
      <div className="flex items-center justify-between h-full">
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

        <div className="flex-1 px-4">
          <h3 className={`font-semibold text-sm ${volume === 0 ? 'text-slate-600' : 'text-white'}`}>
            Harmony (Fast)
          </h3>
          <p className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}>
            {isReady ? loadingStatus : 'Loading...'} | {progression.length} chords
          </p>
          
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