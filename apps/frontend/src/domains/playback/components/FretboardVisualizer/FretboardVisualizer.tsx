'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import { Fretboard3D } from './components/Fretboard3D';
import type { ExerciseNote } from './types/fretboard';

export interface FretboardVisualizerProps {
  notes: ExerciseNote[];
  currentTime: number;
  bpm: number;
  isPlaying: boolean;
  onCameraReset?: () => void;
  onSettingsClick?: () => void;
  isEditMode?: boolean;
  onNotesChange?: (notes: ExerciseNote[]) => void;
  onEditModeToggle?: (isEditMode: boolean) => void;
}

export function FretboardVisualizer({
  notes,
  currentTime,
  bpm,
  isPlaying,
  onCameraReset,
  onSettingsClick,
  isEditMode = false,
  onNotesChange,
  onEditModeToggle,
}: FretboardVisualizerProps) {
  return (
    <div className="w-full h-full relative bg-slate-900">
      {/* Simple Three.js Canvas with tilted fretboard */}
      <Canvas
        camera={{ position: [0, 5, 8], fov: 60 }}
        className="w-full h-full"
      >
        <PerspectiveCamera makeDefault position={[0, 5, 8]} fov={60} />
        <Fretboard3D visible={true} strings={4} />
      </Canvas>

      {/* UI Overlay */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {/* Settings Button */}
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            className="bg-slate-800/80 hover:bg-slate-700/80 text-white p-2 rounded-lg backdrop-blur-sm transition-colors"
            aria-label="Fretboard Settings"
          >
            ⚙️
          </button>
        )}
      </div>
    </div>
  );
}
