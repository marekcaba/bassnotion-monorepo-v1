/**
 * Optimized Exercise Loading Hook
 * Loads exercise metadata immediately, then audio engine in background
 */

import { useState, useEffect, useRef } from 'react';
import { getExercise } from '@/domains/widgets/api/exercises';
import { useAudioServices } from '@/domains/playback/providers/AudioProvider';
import { widgetSyncService } from '@/domains/widgets/services/WidgetSyncService';
import { loadingMetrics } from '@/domains/widgets/utils/performance/ExerciseLoadingMetrics';
import type { Exercise } from '@bassnotion/contracts';

export interface UseOptimizedExerciseLoadingResult {
  // Exercise metadata (loaded immediately)
  exercise: Exercise | null;
  exerciseLoading: boolean;
  exerciseError: Error | null;
  
  // Audio engine status (loaded in background)
  audioReady: boolean;
  audioLoading: boolean;
  audioError: Error | null;
  
  // Overall status
  isFullyReady: boolean; // Both exercise and audio ready
  canShowUI: boolean; // Exercise loaded, can show UI
  
  // Actions
  startPlayback: () => Promise<void>;
  retryAudioInit: () => Promise<void>;
}

export function useOptimizedExerciseLoading(exerciseId: string): UseOptimizedExerciseLoadingResult {
  // Exercise metadata state
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [exerciseLoading, setExerciseLoading] = useState(true);
  const [exerciseError, setExerciseError] = useState<Error | null>(null);
  
  // Audio state from AudioProvider
  const { 
    isInitialized: audioReady, 
    error: audioProviderError,
    transportController,
    audioEngine 
  } = useAudioServices();
  
  // Track audio loading separately
  const [audioLoading, setAudioLoading] = useState(true);
  const [audioError, setAudioError] = useState<Error | null>(null);
  
  // Ref to track if we've started loading
  const loadingStarted = useRef(false);
  
  // Load exercise metadata immediately on mount
  useEffect(() => {
    if (loadingStarted.current) return;
    loadingStarted.current = true;
    
    // Start loading exercise metadata immediately
    const loadExercise = async () => {
      try {
        loadingMetrics.startExerciseMetadataLoad();
        setExerciseLoading(true);
        setExerciseError(null);
        
        const { exercise: loadedExercise } = await getExercise(exerciseId);
        
        setExercise(loadedExercise);
        loadingMetrics.completeExerciseMetadataLoad(true);
        
        // Emit to widget sync service so widgets can prepare
        widgetSyncService.emit({
          type: 'EXERCISE_CHANGE',
          payload: { exercise: loadedExercise },
          timestamp: Date.now(),
          source: 'optimized-loader',
          priority: 'high',
        });
        
        // Configure transport with exercise data (if audio is ready)
        if (transportController) {
          transportController.setTempo(loadedExercise.bpm);
          transportController.setTimeSignature(loadedExercise.timeSignature);
        }
        
      } catch (error) {
        console.error('Failed to load exercise:', error);
        setExerciseError(error instanceof Error ? error : new Error('Failed to load exercise'));
        loadingMetrics.completeExerciseMetadataLoad(false, error?.toString());
      } finally {
        setExerciseLoading(false);
      }
    };
    
    loadExercise();
  }, [exerciseId]);
  
  // Track audio initialization
  useEffect(() => {
    if (audioReady) {
      setAudioLoading(false);
      loadingMetrics.completeAudioEngineInit(true);
    } else if (audioProviderError) {
      setAudioLoading(false);
      setAudioError(audioProviderError);
      loadingMetrics.completeAudioEngineInit(false, audioProviderError.message);
    }
  }, [audioReady, audioProviderError]);
  
  // Configure transport when both exercise and audio are ready
  useEffect(() => {
    if (exercise && audioReady && transportController) {
      transportController.setTempo(exercise.bpm);
      transportController.setTimeSignature(exercise.timeSignature);
    }
  }, [exercise, audioReady, transportController]);
  
  // Start playback
  const startPlayback = async () => {
    if (!audioReady || !transportController || !audioEngine) {
      throw new Error('Audio system not ready');
    }
    
    // Ensure audio context is started (requires user gesture)
    const context = audioEngine.getContext();
    if (context && context.state !== 'running') {
      await context.resume();
    }
    
    // Start transport
    await transportController.start();
  };
  
  // Retry audio initialization
  const retryAudioInit = async () => {
    setAudioLoading(true);
    setAudioError(null);
    loadingMetrics.startAudioEngineInit();
    
    // AudioProvider will handle the retry internally
    // We just need to wait for the state to update
  };
  
  return {
    // Exercise metadata
    exercise,
    exerciseLoading,
    exerciseError,
    
    // Audio status
    audioReady,
    audioLoading,
    audioError,
    
    // Overall status
    isFullyReady: !!(exercise && audioReady),
    canShowUI: !!exercise, // Can show UI as soon as exercise is loaded
    
    // Actions
    startPlayback,
    retryAudioInit,
  };
}