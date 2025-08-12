/**
 * useDirectTransport Hook
 * 
 * Performance-optimized hook for widgets that need direct access to UnifiedTransport
 * without the overhead of multiple event processing layers.
 * 
 * This bypasses WidgetSyncService for timing-critical operations while still
 * allowing widgets to participate in the sync ecosystem for UI updates.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { UnifiedTransport, TransportState } from '@/domains/playback/services/core/UnifiedTransport';
import type { EventBus } from '@/domains/playback/services/core/EventBus';
import type { CoreServices } from '@/domains/playback/services/core/CoreServices';

export interface UseDirectTransportResult {
  // Direct refs for performance-critical access
  transportRef: React.MutableRefObject<UnifiedTransport | null>;
  eventBusRef: React.MutableRefObject<EventBus | null>;
  
  // State for UI updates (less frequent)
  isPlaying: boolean;
  tempo: number;
  
  // Direct control methods
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  
  // Status
  isReady: boolean;
}

export function useDirectTransport(): UseDirectTransportResult {
  // Refs for direct access without React re-renders
  const transportRef = useRef<UnifiedTransport | null>(null);
  const eventBusRef = useRef<EventBus | null>(null);
  
  // Minimal state for UI updates
  const [isPlaying, setIsPlaying] = useState(false);
  const [tempo, setTempo] = useState(120);
  const [isReady, setIsReady] = useState(false);
  
  // Initialize direct references
  useEffect(() => {
    const initializeRefs = async () => {
      // Wait for CoreServices
      let attempts = 0;
      while (attempts < 30) {
        const coreServices = (window as any).__globalCoreServices as CoreServices;
        
        if (coreServices) {
          try {
            // Get direct references
            transportRef.current = coreServices.getUnifiedTransport();
            eventBusRef.current = coreServices.getEventBus();
            
            // Set initial state
            if (transportRef.current) {
              setIsPlaying(transportRef.current.getState() === 'playing');
              setTempo(transportRef.current.getTempo());
            }
            
            setIsReady(true);
            
            // Subscribe to critical events only
            if (eventBusRef.current) {
              const handleStart = () => setIsPlaying(true);
              const handleStop = () => setIsPlaying(false);
              const handlePause = () => setIsPlaying(false);
              const handleTempo = (data: { tempo: number }) => setTempo(data.tempo);
              
              eventBusRef.current.on('transport:started', handleStart);
              eventBusRef.current.on('transport:stopped', handleStop);
              eventBusRef.current.on('transport:paused', handlePause);
              eventBusRef.current.on('transport:tempo-changed', handleTempo);
              
              // Cleanup
              return () => {
                eventBusRef.current?.off('transport:started', handleStart);
                eventBusRef.current?.off('transport:stopped', handleStop);
                eventBusRef.current?.off('transport:paused', handlePause);
                eventBusRef.current?.off('transport:tempo-changed', handleTempo);
              };
            }
            
            break;
          } catch (error) {
            // Services not fully initialized yet
          }
        }
        
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
    };
    
    initializeRefs();
  }, []);
  
  // Direct control methods
  const start = useCallback(async () => {
    if (transportRef.current) {
      await transportRef.current.start();
    }
  }, []);
  
  const stop = useCallback(async () => {
    if (transportRef.current) {
      await transportRef.current.stop();
    }
  }, []);
  
  const pause = useCallback(async () => {
    if (transportRef.current) {
      await transportRef.current.pause();
    }
  }, []);
  
  return {
    transportRef,
    eventBusRef,
    isPlaying,
    tempo,
    start,
    stop,
    pause,
    isReady,
  };
}

/**
 * Helper hook for widgets that need position updates without React re-renders
 */
export function useDirectTransportPosition(
  callback: (position: { bars: number; beats: number; sixteenths: number }) => void,
  intervalMs: number = 50
) {
  const { transportRef, isPlaying, isReady } = useDirectTransport();
  
  useEffect(() => {
    if (!isReady || !isPlaying || !transportRef.current) return;
    
    const updatePosition = () => {
      if (transportRef.current) {
        try {
          const pos = transportRef.current.getCurrentPosition();
          callback({
            bars: pos.bars,
            beats: pos.beats,
            sixteenths: pos.sixteenths
          });
        } catch (error) {
          // Transport might not be fully initialized
        }
      }
    };
    
    // Use requestAnimationFrame for smooth updates
    let rafId: number;
    let lastTime = 0;
    
    const animate = (time: number) => {
      if (time - lastTime >= intervalMs) {
        updatePosition();
        lastTime = time;
      }
      rafId = requestAnimationFrame(animate);
    };
    
    rafId = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [isReady, isPlaying, intervalMs, callback]);
}