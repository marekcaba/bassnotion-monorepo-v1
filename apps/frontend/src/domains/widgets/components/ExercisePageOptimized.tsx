/**
 * Optimized Exercise Page Component
 * Demonstrates loading exercise metadata immediately while audio loads in background
 */

import React from 'react';
import { useOptimizedExerciseLoading } from '@/domains/widgets/hooks/useOptimizedExerciseLoading';
import { loadingMetrics } from '@/domains/widgets/utils/performance/ExerciseLoadingMetrics';

interface ExercisePageOptimizedProps {
  exerciseId: string;
}

export function ExercisePageOptimized({ exerciseId }: ExercisePageOptimizedProps) {
  const {
    exercise,
    exerciseLoading,
    exerciseError,
    audioReady,
    audioLoading,
    audioError,
    isFullyReady,
    canShowUI,
    startPlayback,
  } = useOptimizedExerciseLoading(exerciseId);
  
  // Loading state for exercise metadata
  if (exerciseLoading) {
    return (
      <div className="p-8 bg-gray-900 text-white min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-700 rounded w-3/4 mb-4"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2 mb-8"></div>
            <div className="space-y-3">
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded"></div>
              <div className="h-4 bg-gray-700 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  // Error state for exercise
  if (exerciseError) {
    return (
      <div className="p-8 bg-gray-900 text-white min-h-screen">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900 border border-red-700 rounded p-4">
            <h2 className="text-xl font-bold text-red-200 mb-2">Failed to Load Exercise</h2>
            <p className="text-red-300">{exerciseError.message}</p>
          </div>
        </div>
      </div>
    );
  }
  
  // Main UI - Show immediately when exercise metadata is loaded
  return (
    <div className="p-8 bg-gray-900 text-white min-h-screen">
      <div className="max-w-4xl mx-auto">
        {/* Exercise Info - Shown immediately */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{exercise?.title}</h1>
          <p className="text-gray-400 mb-4">{exercise?.description}</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-800 p-4 rounded">
              <p className="text-sm text-gray-400">Tempo</p>
              <p className="text-xl font-bold">{exercise?.bpm} BPM</p>
            </div>
            <div className="bg-gray-800 p-4 rounded">
              <p className="text-sm text-gray-400">Key</p>
              <p className="text-xl font-bold">{exercise?.key}</p>
            </div>
            <div className="bg-gray-800 p-4 rounded">
              <p className="text-sm text-gray-400">Time Signature</p>
              <p className="text-xl font-bold">
                {exercise?.timeSignature.numerator}/{exercise?.timeSignature.denominator}
              </p>
            </div>
            <div className="bg-gray-800 p-4 rounded">
              <p className="text-sm text-gray-400">Difficulty</p>
              <p className="text-xl font-bold capitalize">{exercise?.difficulty}</p>
            </div>
          </div>
          
          {/* Chord Progression */}
          {exercise?.chord_progression && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-2">Chord Progression</h3>
              <div className="flex gap-2">
                {exercise.chord_progression.map((chord, index) => (
                  <div key={index} className="bg-gray-800 px-4 py-2 rounded">
                    {chord}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Audio Loading Status - Shown in background */}
        <div className="mb-6">
          {audioLoading && (
            <div className="bg-blue-900 border border-blue-700 rounded p-4 mb-4">
              <div className="flex items-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-400 mr-3"></div>
                <p className="text-blue-200">Loading audio engine in background...</p>
              </div>
            </div>
          )}
          
          {audioError && (
            <div className="bg-yellow-900 border border-yellow-700 rounded p-4 mb-4">
              <p className="text-yellow-200">Audio engine failed to load: {audioError.message}</p>
              <button 
                onClick={() => window.location.reload()} 
                className="mt-2 px-4 py-2 bg-yellow-700 hover:bg-yellow-600 rounded text-sm"
              >
                Reload Page
              </button>
            </div>
          )}
          
          {audioReady && (
            <div className="bg-green-900 border border-green-700 rounded p-4 mb-4">
              <p className="text-green-200">✅ Audio engine ready!</p>
            </div>
          )}
        </div>
        
        {/* Play Button - Enabled when audio is ready */}
        <div className="flex justify-center mb-8">
          <button
            onClick={startPlayback}
            disabled={!isFullyReady}
            className={`px-12 py-6 text-2xl font-bold rounded-lg transition-all ${
              isFullyReady
                ? 'bg-green-600 hover:bg-green-700 text-white cursor-pointer'
                : 'bg-gray-700 text-gray-400 cursor-not-allowed'
            }`}
          >
            {audioLoading ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                Preparing Audio...
              </span>
            ) : isFullyReady ? (
              '▶️ PLAY EXERCISE'
            ) : (
              '⏸️ Audio Not Ready'
            )}
          </button>
        </div>
        
        {/* Performance Metrics (Development Only) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-8 p-4 bg-gray-800 rounded">
            <h3 className="text-sm font-semibold mb-2 text-gray-400">Loading Performance</h3>
            <button
              onClick={() => loadingMetrics.printSummary()}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
            >
              Show Metrics in Console
            </button>
          </div>
        )}
        
        {/* Fretboard/Widgets would go here */}
        <div className="bg-gray-800 p-8 rounded text-center text-gray-400">
          <p>Fretboard and widgets will render here</p>
          <p className="text-sm mt-2">
            {canShowUI ? 'UI is ready - exercise loaded' : 'Waiting for exercise...'}
          </p>
        </div>
      </div>
    </div>
  );
}