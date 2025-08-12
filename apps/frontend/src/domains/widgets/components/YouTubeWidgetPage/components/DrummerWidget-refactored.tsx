'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { VolumeKnob } from './VolumeKnob';
import { supabase } from '@/infrastructure/supabase/client';
import { scheduleTransportSync } from '@/domains/widgets/utils/transportSync';
import { useWidgetSync } from '@/domains/widgets/hooks/useWidgetSync';

const logger = {
  log: (...args: any[]) => console.log('🥁 DrummerWidget:', ...args),
  error: (...args: any[]) => console.error('🥁 DrummerWidget Error:', ...args),
};

// ... (keeping all the existing constants and types)

interface DrummerWidgetProps {
  pattern: string;
  isVisible: boolean;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility: () => void;
  // REMOVED: isPlaying prop - we get it from sync service
  // REMOVED: onTogglePlay - widgets shouldn't control transport
}

export function DrummerWidget({
  pattern,
  isVisible,
  onPatternChange,
  onToggleVisibility,
}: DrummerWidgetProps) {
  // DIRECT CONNECTION TO TRANSPORT STATE
  const { syncState, isConnected } = useWidgetSync({
    widgetId: 'drummer-widget',
    subscribeTo: ['PLAY', 'STOP', 'PAUSE', 'TEMPO_CHANGE', 'SEEK'],
    debugMode: true,
  });

  // Get transport state directly from sync service
  const isPlaying = syncState.playback.isPlaying;
  const tempo = syncState.playback.tempo;
  
  const [currentBeat, setCurrentBeat] = useState(0);
  const [patterns, setPatterns] = useState(drummerPatterns);
  const [isExpanded, setIsExpanded] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  
  // ... (rest of the existing state and refs)

  // React to tempo changes from transport
  useEffect(() => {
    if (!toneRef.current || !isConnected) return;
    
    const Tone = toneRef.current;
    if (Tone.Transport.bpm.value !== tempo) {
      logger.log(`📊 Updating tempo from ${Tone.Transport.bpm.value} to ${tempo}`);
      Tone.Transport.bpm.value = tempo;
    }
  }, [tempo, isConnected]);

  // Pure Transport scheduling - reacts to sync state
  useEffect(() => {
    if (!toneRef.current || !samplesLoaded || !isConnected) return;
    
    const Tone = toneRef.current;
    
    const handleTransport = async () => {
      // Ensure audio context is running
      const audioContext = Tone.context.rawContext as AudioContext;
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
        logger.log('Audio context resumed:', audioContext.state);
      }
      
      if (isPlaying) {
        logger.log('🎵 DrummerWidget: Received PLAY from sync service');
        
        // Clear any existing Transport events
        transportEventsRef.current.forEach(id => Tone.Transport.clear(id));
        transportEventsRef.current = [];
        
        // Schedule drum pattern...
        // (existing scheduling code)
      } else {
        logger.log('⏹️ DrummerWidget: Received STOP from sync service');
        
        // Clear all scheduled events
        transportEventsRef.current.forEach(id => Tone.Transport.clear(id));
        transportEventsRef.current = [];
        logger.log('🛑 Drum pattern events cleared');
      }
    };
    
    handleTransport();
  }, [isPlaying, patterns, samplesLoaded, isConnected]);

  // Show connection status
  if (!isConnected) {
    return (
      <div className="p-4 bg-yellow-900/20 rounded">
        <p className="text-yellow-400">Connecting to transport...</p>
      </div>
    );
  }

  // ... (rest of the component UI remains the same)
}