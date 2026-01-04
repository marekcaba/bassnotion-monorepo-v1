'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Play,
  Heart,
  Star,
  Box,
  Square,
  Eye,
  Music,
  Clock,
  Zap,
  Target,
} from 'lucide-react';
import type { Exercise } from '@bassnotion/contracts';

/**
 * ExerciseControlPanel - Compact exercise selector with integrated controls
 *
 * Neumorphic glassmorphism style matching other YouTubeWidgetPage components.
 * Features:
 * 1. Compact exercise list with selection
 * 2. Dynamic description box for selected exercise
 * 3. Global controls (3D mode, play, favorites, overview)
 */

interface ExerciseControlPanelProps {
  exercises: Exercise[];
  selectedExerciseId: string | null;
  onExerciseSelect: (exerciseId: string) => void;

  // Transport controls (optional - for when wired up)
  isPlaying?: boolean;
  onPlayToggle?: () => void;

  // 3D mode controls (optional)
  is3DMode?: boolean;
  onToggle3DMode?: () => void;

  // Camera mode (optional)
  cameraMode?: 'overview' | 'action';
  onCameraModeChange?: (mode: 'overview' | 'action') => void;

  // Loading state
  loading?: boolean;
}

// Helper to safely extract string value from potentially wrapped objects
function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  if (typeof value === 'object' && 'value' in value) {
    return String((value as { value: unknown }).value);
  }
  return String(value);
}

// Get exercise ID safely
function getExerciseId(exercise: Exercise): string {
  return typeof exercise.id === 'object' && exercise.id !== null
    ? (exercise.id as { value: string }).value
    : exercise.id;
}

// Difficulty colors with neumorphic style
const difficultyStyles: Record<string, { bg: string; text: string; glow: string }> = {
  beginner: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' },
  intermediate: { bg: 'bg-amber-500/20', text: 'text-amber-400', glow: 'shadow-amber-500/20' },
  advanced: { bg: 'bg-orange-500/20', text: 'text-orange-400', glow: 'shadow-orange-500/20' },
  expert: { bg: 'bg-red-500/20', text: 'text-red-400', glow: 'shadow-red-500/20' },
};

// Compact exercise item with neumorphic styling
function ExerciseItem({
  exercise,
  index,
  isSelected,
  onSelect,
}: {
  exercise: Exercise;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const title = safeString(exercise.title) || 'Untitled Exercise';
  const difficulty = safeString(exercise.difficulty) || 'beginner';
  const diffStyle = difficultyStyles[difficulty] || difficultyStyles.beginner;

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-2.5 rounded-xl transition-all duration-300 ${
        isSelected
          ? 'bg-gradient-to-r from-blue-600/30 to-purple-600/20 border border-blue-500/40 shadow-lg shadow-blue-500/10'
          : 'bg-slate-700/20 border border-slate-700/30 hover:bg-slate-700/40 hover:border-slate-600/50 hover:shadow-md'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Exercise number badge */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold transition-all duration-300 ${
            isSelected
              ? 'bg-gradient-to-br from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/30'
              : 'bg-slate-700/50 text-slate-400'
          }`}
        >
          {index + 1}
        </div>

        {/* Title */}
        <div className="flex-1 min-w-0">
          <h4
            className={`font-medium text-sm truncate transition-colors duration-200 ${
              isSelected ? 'text-white' : 'text-slate-300'
            }`}
          >
            {title}
          </h4>
        </div>

        {/* Difficulty badge */}
        <span
          className={`flex-shrink-0 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide ${diffStyle.bg} ${diffStyle.text}`}
        >
          {difficulty.slice(0, 3)}
        </span>
      </div>
    </button>
  );
}

// Selected exercise description box
function ExerciseDescriptionBox({ exercise }: { exercise: Exercise | undefined }) {
  if (!exercise) {
    return (
      <div className="p-4 bg-slate-700/20 rounded-xl border border-slate-700/30">
        <p className="text-slate-500 text-sm text-center italic">
          Select an exercise to see details
        </p>
      </div>
    );
  }

  const title = safeString(exercise.title) || 'Untitled Exercise';
  const description = safeString(exercise.description) || 'No description available';
  const difficulty = safeString(exercise.difficulty) || 'beginner';
  const totalBars = exercise.total_bars || '?';
  const bpm = exercise.bpm || '?';
  const musicalKey = safeString(exercise.key) || '?';
  const diffStyle = difficultyStyles[difficulty] || difficultyStyles.beginner;

  return (
    <div className="p-4 bg-gradient-to-br from-slate-700/30 to-slate-800/40 rounded-xl border border-slate-600/30 shadow-inner">
      {/* Header with title and difficulty */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-base font-semibold text-white leading-tight">{title}</h3>
        <span
          className={`flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-semibold ${diffStyle.bg} ${diffStyle.text} shadow-sm ${diffStyle.glow}`}
        >
          {difficulty}
        </span>
      </div>

      {/* Description */}
      <p className="text-slate-400 text-sm leading-relaxed mb-4">
        {description}
      </p>

      {/* Meta info with icons */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5 text-slate-400">
          <Clock className="w-3.5 h-3.5 text-blue-400" />
          <span>{totalBars} bars</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          <span>{bpm} BPM</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-400">
          <Target className="w-3.5 h-3.5 text-purple-400" />
          <span>Key: {musicalKey}</span>
        </div>
      </div>
    </div>
  );
}

// Neumorphic control button
function ControlButton({
  icon: Icon,
  label,
  isActive,
  onClick,
  variant = 'default',
}: {
  icon: React.ElementType;
  label: string;
  isActive?: boolean;
  onClick?: () => void;
  variant?: 'default' | 'primary' | 'favorite';
}) {
  const variantStyles = {
    default: isActive
      ? 'bg-blue-600/30 text-blue-400 border-blue-500/40 shadow-lg shadow-blue-500/10'
      : 'bg-slate-700/30 text-slate-400 border-slate-700/30 hover:bg-slate-700/50 hover:text-slate-300 hover:border-slate-600/50',
    primary: isActive
      ? 'bg-red-600 text-white border-red-500/50 shadow-lg shadow-red-600/30'
      : 'bg-blue-600 text-white border-blue-500/50 hover:bg-blue-700 shadow-lg shadow-blue-600/20',
    favorite: isActive
      ? 'bg-pink-600/30 text-pink-400 border-pink-500/40 shadow-lg shadow-pink-500/10'
      : 'bg-slate-700/30 text-slate-400 border-slate-700/30 hover:bg-slate-700/50 hover:text-pink-400 hover:border-pink-500/30',
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl border transition-all duration-300 ${variantStyles[variant]}`}
    >
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

export function ExerciseControlPanel({
  exercises,
  selectedExerciseId,
  onExerciseSelect,
  isPlaying = false,
  onPlayToggle,
  is3DMode = false,
  onToggle3DMode,
  cameraMode = 'overview',
  onCameraModeChange,
  loading = false,
}: ExerciseControlPanelProps) {
  // Local state for favorites (mockup - would be persisted in real implementation)
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const toggleFavorite = useCallback((exerciseId: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  }, []);

  const selectedExercise = useMemo(() => {
    return exercises.find((ex) => getExerciseId(ex) === selectedExerciseId);
  }, [exercises, selectedExerciseId]);

  if (loading) {
    return <ExerciseControlPanelSkeleton />;
  }

  return (
    <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-500/20 rounded-lg">
              <Music className="w-4 h-4 text-blue-400" />
            </div>
            <h3 className="text-sm font-semibold text-white">Exercises</h3>
          </div>
          <span className="text-xs text-slate-400 bg-slate-700/30 px-2 py-0.5 rounded-full">
            {exercises.length} available
          </span>
        </div>
      </div>

      {/* Exercise List - Compact */}
      <div className="p-3 space-y-2 max-h-[200px] overflow-y-auto">
        {exercises.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-sm">
            No exercises available
          </div>
        ) : (
          exercises.map((exercise, index) => {
            const exId = getExerciseId(exercise);
            return (
              <ExerciseItem
                key={exId}
                exercise={exercise}
                index={index}
                isSelected={exId === selectedExerciseId}
                onSelect={() => onExerciseSelect(exId)}
              />
            );
          })
        )}
      </div>

      {/* Selected Exercise Description Box */}
      <div className="px-3 pb-3">
        <ExerciseDescriptionBox exercise={selectedExercise} />
      </div>

      {/* Control Bar */}
      <div className="px-4 py-3 border-t border-slate-700/50 bg-gradient-to-r from-slate-900/50 to-slate-800/50">
        <div className="flex items-center justify-between">
          {/* Left: 3D Mode */}
          <ControlButton
            icon={Box}
            label={is3DMode ? '3D' : '2D'}
            isActive={is3DMode}
            onClick={onToggle3DMode}
          />

          {/* Center-Left: Favorite */}
          <ControlButton
            icon={Heart}
            label="Like"
            isActive={selectedExerciseId ? favorites.has(selectedExerciseId) : false}
            onClick={() => selectedExerciseId && toggleFavorite(selectedExerciseId)}
            variant="favorite"
          />

          {/* Center: Play Button - Larger with glow */}
          <button
            onClick={onPlayToggle}
            disabled={!selectedExercise}
            className={`flex items-center justify-center w-14 h-14 rounded-full border transition-all duration-300 ${
              !selectedExercise
                ? 'bg-slate-700/50 text-slate-500 border-slate-600/30 cursor-not-allowed'
                : isPlaying
                  ? 'bg-gradient-to-br from-red-500 to-red-600 text-white border-red-400/50 shadow-xl shadow-red-600/40 hover:shadow-red-600/50'
                  : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white border-blue-400/50 shadow-xl shadow-blue-600/40 hover:shadow-blue-600/50'
            }`}
          >
            {isPlaying ? (
              <Square className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6 ml-0.5" />
            )}
          </button>

          {/* Center-Right: Star/Rate */}
          <ControlButton
            icon={Star}
            label="Rate"
            isActive={false}
            onClick={() => {
              // TODO: Open rating modal
            }}
          />

          {/* Right: Overview */}
          <ControlButton
            icon={Eye}
            label={cameraMode === 'overview' ? 'Over' : 'Action'}
            isActive={cameraMode === 'overview'}
            onClick={() =>
              onCameraModeChange?.(
                cameraMode === 'overview' ? 'action' : 'overview'
              )
            }
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton loading state with neumorphic style
 */
export function ExerciseControlPanelSkeleton() {
  return (
    <div className="bg-slate-800/40 backdrop-blur-xl rounded-2xl border border-slate-700/50 shadow-2xl overflow-hidden">
      {/* Header skeleton */}
      <div className="px-4 py-3 border-b border-slate-700/50 bg-gradient-to-r from-slate-800/50 to-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="skeleton-shimmer w-7 h-7 rounded-lg" />
            <div className="skeleton-shimmer w-20 h-4 rounded" />
          </div>
          <div className="skeleton-shimmer w-16 h-5 rounded-full" />
        </div>
      </div>

      {/* Exercise list skeleton */}
      <div className="p-3 space-y-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="p-2.5 rounded-xl bg-slate-700/20 border border-slate-700/30"
          >
            <div className="flex items-center gap-3">
              <div className="skeleton-shimmer w-8 h-8 rounded-lg" />
              <div className="flex-1">
                <div className="skeleton-shimmer w-3/4 h-4 rounded" />
              </div>
              <div className="skeleton-shimmer w-10 h-5 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      {/* Description box skeleton */}
      <div className="px-3 pb-3">
        <div className="p-4 bg-slate-700/20 rounded-xl border border-slate-700/30">
          <div className="skeleton-shimmer w-2/3 h-5 rounded mb-3" />
          <div className="skeleton-shimmer w-full h-4 rounded mb-2" />
          <div className="skeleton-shimmer w-4/5 h-4 rounded mb-4" />
          <div className="flex gap-4">
            <div className="skeleton-shimmer w-16 h-4 rounded" />
            <div className="skeleton-shimmer w-16 h-4 rounded" />
            <div className="skeleton-shimmer w-16 h-4 rounded" />
          </div>
        </div>
      </div>

      {/* Control bar skeleton */}
      <div className="px-4 py-3 border-t border-slate-700/50 bg-gradient-to-r from-slate-900/50 to-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="skeleton-shimmer w-12 h-14 rounded-xl" />
          <div className="skeleton-shimmer w-12 h-14 rounded-xl" />
          <div className="skeleton-shimmer w-14 h-14 rounded-full" />
          <div className="skeleton-shimmer w-12 h-14 rounded-xl" />
          <div className="skeleton-shimmer w-12 h-14 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
