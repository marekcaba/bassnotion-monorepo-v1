/**
 * useTransport Hook - TransportController Integration
 * Story 3.18.6: Widget Integration & Enhancement
 * 
 * Professional React hook for transport control with:
 * - ServiceRegistry integration
 * - EventBus subscription for real-time updates
 * - Type-safe transport operations
 * - Clean abstraction over TransportController
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { serviceRegistry } from '../services/core/ServiceRegistry.js';
import { UnifiedTransport, TransportState, TransportPosition } from '../services/core/index.js';
import { EventBus } from '../services/core/EventBus.js';
import type { ServiceRegistry } from '../services/core/ServiceRegistry.js';
import type { TimeSignature, MusicalPosition } from '@bassnotion/contracts/types/musical-time';

export interface UseTransportResult {
  isPlaying: boolean;
  isPaused: boolean;
  isStopped: boolean;
  tempo: number;
  timeSignature: TimeSignature;
  position: TransportPosition;
  start: () => Promise<void>;
  stop: () => Promise<void>;
  pause: () => Promise<void>;
  setTempo: (bpm: number) => Promise<void>;
  setTimeSignature: (timeSignature: TimeSignature) => void;
  seekTo: (position: MusicalPosition | number) => Promise<void>;
  setLoop: (start: number, end: number) => Promise<void>;
  isLoopEnabled: boolean;
}

export function useTransport(registry?: ServiceRegistry): UseTransportResult {
  const [state, setState] = useState<TransportState>('stopped');
  const [tempo, setTempo] = useState(120);
  const [timeSignature, setTimeSignature] = useState<TimeSignature>({ numerator: 4, denominator: 4 });
  const [position, setPosition] = useState<TransportPosition>({
    bars: 0,
    beats: 0,
    sixteenths: 0,
    ticks: 0,
    seconds: 0,
  });
  const [isLoopEnabled, setIsLoopEnabled] = useState(false);
  const [servicesReady, setServicesReady] = useState(false);

  const transportRef = useRef<UnifiedTransport | null>(null);
  const eventBusRef = useRef<EventBus | null>(null);
  const lastPositionUpdateRef = useRef<number>(0);

  // Get UnifiedTransport and EventBus from ServiceRegistry
  useEffect(() => {
    const initializeTransport = () => {
      try {
        // Try CoreServices first (new approach)
        const coreServices = (window as any).__globalCoreServices;
        if (coreServices) {
          transportRef.current = coreServices.getUnifiedTransport();
          eventBusRef.current = coreServices.getEventBus();
          console.log('useTransport: Got services from CoreServices');
        } else {
          // Fallback to registry
          const actualRegistry = registry || serviceRegistry || (window as any).__serviceRegistry;
          if (!actualRegistry) {
            console.log('ServiceRegistry not found yet, waiting...');
            return false;
          }

          // Try to get services, but don't fail if they don't exist (legacy mode)
          try {
            transportRef.current = actualRegistry.get<UnifiedTransport>('unifiedTransport');
          } catch (e) {
            console.warn('UnifiedTransport not available in registry');
            return false;
          }
          
          try {
            eventBusRef.current = actualRegistry.get<EventBus>('eventBus');
          } catch (e) {
            console.warn('EventBus not available in registry');
            return false;
          }
        }

        // Set initial state from transport
        if (transportRef.current) {
          setState(transportRef.current.getState());
          setTempo(transportRef.current.getTempo());
          setTimeSignature(transportRef.current.getTimeSignature());
          
          // Only get position if AudioEngine is fully initialized
          try {
            setPosition(transportRef.current.getCurrentPosition());
          } catch (error) {
            // AudioEngine not fully initialized yet, use default position
            console.log('useTransport: AudioEngine not ready, using default position');
            setPosition({
              bars: 0,
              beats: 0,
              sixteenths: 0,
              ticks: 0,
              seconds: 0,
            });
          }
          
          setIsLoopEnabled(transportRef.current.isLoopEnabled());
        }
        
        // Mark services as ready
        setServicesReady(true);
        
        return true;
      } catch (err) {
        console.error('Failed to get transport services:', err);
        return false;
      }
    };

    // Try immediately
    if (!initializeTransport()) {
      // Wait for audioServicesReady event
      const handleReady = () => {
        initializeTransport();
      };
      
      window.addEventListener('audioServicesReady', handleReady);
      
      return () => {
        window.removeEventListener('audioServicesReady', handleReady);
      };
    }
  }, [registry]);

  // Subscribe to transport events
  useEffect(() => {
    if (!eventBusRef.current || !transportRef.current) {
      console.log('useTransport: Waiting for EventBus and Transport...', {
        hasEventBus: !!eventBusRef.current,
        hasTransport: !!transportRef.current
      });
      return;
    }

    const eventBus = eventBusRef.current;
    console.log('useTransport: Setting up event subscriptions with EventBus:', eventBus);
    
    // Log a unique identifier for the EventBus to verify it's the same instance
    console.log('useTransport: EventBus instance ID:', (eventBus as any)._instanceId || 'no-id');

    // Transport state events
    const handleStart = () => {
      console.log('useTransport: Received transport:started event');
      setState('playing');
    };
    const handleStop = () => {
      console.log('useTransport: Received transport:stopped event');
      setState('stopped');
    };
    const handlePause = () => {
      console.log('useTransport: Received transport:paused event');
      setState('paused');
    };

    // Tempo change event
    const handleTempoChange = (data: { tempo: number }) => setTempo(data.tempo);

    // Time signature change event
    const handleTimeSignatureChange = (data: { timeSignature: TimeSignature }) => 
      setTimeSignature(data.timeSignature);

    // Position update event - throttled to prevent re-render loops
    const handlePositionUpdate = (data: { position: TransportPosition }) => {
      // Throttle position updates to max 30fps (33ms) to prevent excessive re-renders
      const now = Date.now();
      if (now - lastPositionUpdateRef.current < 33) {
        return;
      }
      lastPositionUpdateRef.current = now;
      
      // Only log every 10th update to reduce console spam
      if (Math.random() < 0.1) {
        console.log('useTransport: Received transport:position-updated event:', data.position);
      }
      setPosition(data.position);
    };

    // Loop events
    const handleLoopToggle = (data: { enabled: boolean }) => {
      setIsLoopEnabled(data.enabled);
    };

    // Subscribe to events (EventBus.on returns unsubscribe function)
    const unsubscribeStart = eventBus.on('transport:started', handleStart);
    const unsubscribeStop = eventBus.on('transport:stopped', handleStop);
    const unsubscribePause = eventBus.on('transport:paused', handlePause);
    const unsubscribeTempo = eventBus.on('transport:tempo-changed', handleTempoChange);
    const unsubscribeTimeSignature = eventBus.on('transport:time-signature-changed', handleTimeSignatureChange);
    const unsubscribePosition = eventBus.on('transport:position-updated', handlePositionUpdate);
    const unsubscribeLoop = eventBus.on('transport:loop-toggled', handleLoopToggle);

    // Cleanup subscriptions
    return () => {
      unsubscribeStart();
      unsubscribeStop();
      unsubscribePause();
      unsubscribeTempo();
      unsubscribeTimeSignature();
      unsubscribePosition();
      unsubscribeLoop();
    };
  }, [servicesReady]); // Re-run when services are ready

  // Transport control callbacks
  const start = useCallback(async () => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }
    await transportRef.current.start();
  }, []);

  const stop = useCallback(async () => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }
    await transportRef.current.stop();
  }, []);

  const pause = useCallback(async () => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }
    await transportRef.current.pause();
  }, []);

  const setTempoValue = useCallback(async (bpm: number) => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }
    await transportRef.current.setTempo(bpm);
  }, []);

  const setTimeSignatureValue = useCallback((ts: TimeSignature) => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }
    transportRef.current.setTimeSignature(ts);
  }, []);

  const seekTo = useCallback(async (pos: MusicalPosition | number) => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }
    await transportRef.current.seekTo(pos);
  }, []);

  const setLoop = useCallback(async (start: number, end: number) => {
    if (!transportRef.current) {
      throw new Error('Transport not available');
    }
    // UnifiedTransport setLoop is now synchronous and async for backward compatibility
    await transportRef.current.setLoop(start, end);
  }, []);

  return {
    isPlaying: state === 'playing',
    isPaused: state === 'paused',
    isStopped: state === 'stopped',
    tempo,
    timeSignature,
    position,
    start,
    stop,
    pause,
    setTempo: setTempoValue,
    setTimeSignature: setTimeSignatureValue,
    seekTo,
    setLoop,
    isLoopEnabled,
  };
}