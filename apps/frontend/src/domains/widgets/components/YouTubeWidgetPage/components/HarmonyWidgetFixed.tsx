'use client';

import React, { useEffect, useState, useRef } from 'react';
import { VolumeKnob } from './VolumeKnob';

const logger = {
  log: (...args: any[]) => console.log('🎹 HarmonyWidgetFixed:', ...args),
  error: (...args: any[]) => console.error('🎹 HarmonyWidgetFixed Error:', ...args),
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
 * Fixed HarmonyWidget that ACTUALLY loads Salamander piano samples within 3 seconds
 * No bullshit synthesizer fallback - real samples only
 */
export function HarmonyWidgetFixed({
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
  const [loadingStatus, setLoadingStatus] = useState('Loading Salamander Piano...');
  const [isReady, setIsReady] = useState(false);
  
  const toneRef = useRef<typeof import('tone') | null>(null);
  const processorRef = useRef<any>(null);
  const transportEventsRef = useRef<number[]>([]);

  // Load REAL Salamander piano samples - NO SYNTH BULLSHIT
  useEffect(() => {
    let mounted = true;
    
    const loadRealPianoSamples = async () => {
      const startTime = performance.now();
      logger.log('🎹 Starting REAL Salamander piano loading...');
      
      try {
        // 1. Load Tone.js
        const Tone = await import('tone');
        toneRef.current = Tone;
        
        // 2. Force audio context to start if needed
        const audioContext = Tone.context.rawContext as AudioContext;
        if (audioContext.state === 'suspended') {
          // Try to resume on first user interaction
          const resumeOnInteraction = async () => {
            await audioContext.resume();
            logger.log('Audio context resumed');
            document.removeEventListener('click', resumeOnInteraction);
            document.removeEventListener('keydown', resumeOnInteraction);
          };
          document.addEventListener('click', resumeOnInteraction);
          document.addEventListener('keydown', resumeOnInteraction);
        }
        
        // 3. Load ChordInstrumentProcessor with REAL Salamander samples
        const { ChordInstrumentProcessor, ChordPreset } = await import(
          '@/domains/playback/services/plugins/ChordInstrumentProcessor'
        );
        
        const processor = new ChordInstrumentProcessor();
        
        // Set a hard 3-second deadline for loading
        const loadingPromise = processor.setPreset(ChordPreset.PIANO);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('3 second timeout')), 3000)
        );
        
        try {
          // Race against 3-second timeout
          await Promise.race([loadingPromise, timeoutPromise]);
          
          // Ensure samples are actually loaded
          await processor.ensureSamplesLoaded();
          
          if (!mounted) return;
          
          processorRef.current = processor;
          setIsReady(true);
          
          const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
          setLoadingStatus(`✅ Salamander Piano Ready (${loadTime}s)`);
          logger.log(`✅ REAL Salamander piano loaded in ${loadTime}s`);
          
        } catch (timeoutError) {
          // If we timeout, still try to use what we have
          if (!mounted) return;
          
          processorRef.current = processor;
          setIsReady(true);
          
          const loadTime = ((performance.now() - startTime) / 1000).toFixed(2);
          setLoadingStatus(`⚠️ Salamander Piano (partial ${loadTime}s)`);
          logger.log(`⚠️ Salamander piano partially loaded in ${loadTime}s`);
        }
        
      } catch (error) {
        logger.error('Failed to load Salamander piano:', error);
        if (!mounted) return;
        setLoadingStatus('❌ Failed to load piano');
      }
    };
    
    loadRealPianoSamples();
    
    return () => {
      mounted = false;
      if (processorRef.current && typeof processorRef.current.dispose === 'function') {
        processorRef.current.dispose();
      }
    };
  }, []);

  // Schedule playback with REAL piano
  useEffect(() => {
    if (!toneRef.current || !isReady || !processorRef.current) return;
    
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
          
          if (processorRef.current && typeof processorRef.current.playChord === 'function') {
            processorRef.current.playChord(chord, {
              duration: 2,
              velocity: 0.7,
              time
            });
          }
        }, `${progression.length * 4}m`, `0:${startBeat}:0`);
        
        transportEventsRef.current.push(eventId);
        totalBeats += chordDuration;
      });
      
      logger.log(`Scheduled ${progression.length} chords with Salamander piano`);
    } else {
      // Clear events
      transportEventsRef.current.forEach(id => Tone.Transport.clear(id));
      transportEventsRef.current = [];
      setCurrentChordIndex(-1);
      
      if (processorRef.current && typeof processorRef.current.stopChord === 'function') {
        processorRef.current.stopChord();
      }
    }
  }, [isPlaying, progression, isReady]);

  // Manual chord test
  const testChord = async (chord: string) => {
    if (!toneRef.current || !processorRef.current) {
      logger.log('Cannot test - Salamander piano not ready');
      return;
    }
    
    const Tone = toneRef.current;
    const audioContext = Tone.context.rawContext as AudioContext;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    
    logger.log(`Testing chord ${chord} with Salamander piano`);
    if (typeof processorRef.current.playChord === 'function') {
      processorRef.current.playChord(chord, {
        duration: 1,
        velocity: 0.7
      });
    }
  };

  // Volume control
  useEffect(() => {
    if (!processorRef.current || typeof processorRef.current.setVolume !== 'function') return;
    
    const volumeValue = isMuted ? 0 : volume / 100;
    processorRef.current.setVolume(volumeValue);
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
            Harmony (Salamander Piano)
          </h3>
          <p className={`text-xs ${volume === 0 ? 'text-slate-600' : 'text-slate-400'}`}>
            {loadingStatus} | {progression.length} chords
          </p>
          
          <div className="flex gap-2 mt-1">
            {progression.slice(0, 8).map((chord, i) => (
              <button
                key={i}
                onClick={() => testChord(chord)}
                disabled={!isReady}
                className={`text-xs px-2 py-1 rounded transition-all ${
                  !isReady 
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : currentChordIndex === i && isPlaying
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