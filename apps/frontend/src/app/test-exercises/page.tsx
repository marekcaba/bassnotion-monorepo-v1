'use client';

import React, { useEffect, useState } from 'react';
import {
  getExercises,
  getExerciseWithNotes,
} from '@/domains/widgets/api/exercises';
import type {
  DatabaseExercise,
  ExerciseWithNotes,
} from '@bassnotion/contracts';

export default function TestExercisesPage() {
  const [exercises, setExercises] = useState<DatabaseExercise[]>([]);
  const [selectedExercise, setSelectedExercise] =
    useState<ExerciseWithNotes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('🎯 TestExercisesPage: useEffect triggered');
    async function loadExercises() {
      console.log('🎯 TestExercisesPage: loadExercises called');
      try {
        setLoading(true);
        setError(null);
        console.log('🎯 TestExercisesPage: About to call getExercises()');
        const response = await getExercises();
        setExercises(response.exercises);
        console.log('✅ Loaded exercises:', response.exercises);
      } catch (err) {
        console.error('❌ Failed to load exercises:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load exercises',
        );
      } finally {
        setLoading(false);
      }
    }

    loadExercises();
  }, []);

  const handleExerciseClick = async (exerciseId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await getExerciseWithNotes(exerciseId);
      setSelectedExercise(response.exercise);
      console.log('✅ Loaded exercise with notes:', response.exercise);
    } catch (err) {
      console.error('❌ Failed to load exercise:', err);
      setError(err instanceof Error ? err.message : 'Failed to load exercise');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-white mb-8">
          🎸 Exercise Database Test
        </h1>

        {/* API Source Indicator */}
        <div className="bg-blue-900/30 rounded-lg p-4 mb-6">
          <h2 className="text-lg font-semibold text-white mb-2">
            🔗 API Source
          </h2>
          <p className="text-blue-200">
            {process.env.NEXT_PUBLIC_USE_BACKEND_API === 'true' ? (
              <span className="text-green-400">
                🚀 Using Backend API (Phase 3)
              </span>
            ) : (
              <span className="text-yellow-400">
                🔥 Using Supabase Direct (Fallback)
              </span>
            )}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Backend API URL:{' '}
            {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}
          </p>
        </div>

        {/* Connection Status */}
        <div className="bg-slate-800/50 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            Connection Status
          </h2>
          {loading && <p className="text-yellow-400">🔄 Loading...</p>}
          {error && (
            <div className="text-red-400">
              <p>❌ Error: {error}</p>
              <p className="text-sm mt-2 text-slate-400">
                This is expected if Supabase is not running or migration not
                applied.
              </p>
            </div>
          )}
          // TODO: Review non-null assertion - consider null safety
          {!loading && !error && exercises.length > 0 && (
            <p className="text-green-400">
              // TODO: Review non-null assertion - consider null safety ✅
              Connected! Found {exercises.length} exercises.
            </p>
          )}
          // TODO: Review non-null assertion - consider null safety
          {!loading && !error && exercises.length === 0 && (
            <p className="text-orange-400">
              ⚠️ Connected but no exercises found. Migration may not be applied.
            </p>
          )}
        </div>

        {/* Exercises List */}
        {exercises.length > 0 && (
          <div className="bg-slate-800/50 rounded-lg p-6 mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              Available Exercises
            </h2>
            <div className="grid gap-4">
              {exercises.map((exercise) => (
                <div
                  key={exercise.id}
                  className="bg-slate-700/50 rounded-lg p-4 cursor-pointer hover:bg-slate-600/50 transition-colors"
                  onClick={() => handleExerciseClick(exercise.id)}
                >
                  <h3 className="font-semibold text-white">{exercise.title}</h3>
                  <p className="text-slate-300 text-sm mb-2">
                    {exercise.description}
                  </p>
                  <div className="flex gap-4 text-xs text-slate-400">
                    <span>Difficulty: {exercise.difficulty}</span>
                    <span>BPM: {exercise.bpm}</span>
                    <span>Key: {exercise.key}</span>
                    <span>
                      Duration: {Math.round(exercise.duration / 1000)}s
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Selected Exercise Details */}
        {selectedExercise && (
          <div className="bg-slate-800/50 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">
              Exercise Details: {selectedExercise.title}
            </h2>
            <div className="mb-4">
              <p className="text-slate-300 mb-2">
                {selectedExercise.description}
              </p>
              <div className="flex gap-4 text-sm text-slate-400">
                <span>Notes: {selectedExercise.notes.length}</span>
                <span>BPM: {selectedExercise.bpm}</span>
                <span>
                  Duration: {Math.round(selectedExercise.duration / 1000)}s
                </span>
              </div>
            </div>

            {/* Notes Preview */}
            <div className="bg-slate-700/50 rounded-lg p-4">
              <h3 className="font-semibold text-white mb-3">Notes Preview</h3>
              <div className="grid gap-2 max-h-64 overflow-y-auto">
                {selectedExercise.notes.slice(0, 10).map((note, index) => (
                  <div
                    key={note.id}
                    className="flex justify-between items-center text-sm bg-slate-600/30 rounded px-3 py-2"
                  >
                    <span className="text-white">
                      {index + 1}. {note.note} (String {note.string}, Fret{' '}
                      {note.fret})
                    </span>
                    <span className="text-slate-400">{note.timestamp}ms</span>
                  </div>
                ))}
                {selectedExercise.notes.length > 10 && (
                  <p className="text-slate-400 text-sm text-center mt-2">
                    ... and {selectedExercise.notes.length - 10} more notes
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-900/30 rounded-lg p-6 mt-8">
          <h2 className="text-xl font-semibold text-white mb-4">
            🔧 Setup Instructions
          </h2>
          <div className="text-slate-300 space-y-2">
            <p>
              <strong>If you see exercises above:</strong> ✅ Everything is //
              TODO: Review non-null assertion - consider null safety working!
            </p>
            <p>
              <strong>If you see connection errors:</strong>
            </p>
            <ol className="list-decimal list-inside ml-4 space-y-1 text-sm">
              <li>Make sure Supabase MCP server is configured</li>
              <li>
                Apply the migration:{' '}
                <code className="bg-slate-700 px-2 py-1 rounded">
                  npx supabase db reset
                </code>
              </li>
              <li>
                Check environment variables in{' '}
                <code className="bg-slate-700 px-2 py-1 rounded">
                  .env.local
                </code>
              </li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
