'use client';

import React from 'react';
import * as THREE from 'three';
import { Canvas, extend } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Fretboard3D } from './components/Fretboard3D';
import { NoteRenderer } from './components/NoteRenderer';
import { CameraControls } from './components/CameraControls';
import { TechniqueRenderer } from './components/TechniqueRenderer';
import { useFretboardState } from './hooks/useFretboardState';
import { useThreeJSOptimization } from './hooks/useThreeJSOptimization';
import type { ExerciseNote } from './types/fretboard';

// Register Three.js elements for JSX usage - this should make them available to all child components
extend(THREE as any);

// Ensure all Three.js geometry and material elements are registered
extend({
  // Geometries
  sphereGeometry: THREE.SphereGeometry,
  planeGeometry: THREE.PlaneGeometry,
  boxGeometry: THREE.BoxGeometry,
  // Materials
  meshBasicMaterial: THREE.MeshBasicMaterial,
  meshStandardMaterial: THREE.MeshStandardMaterial,
  // Lights
  ambientLight: THREE.AmbientLight,
  directionalLight: THREE.DirectionalLight,
  pointLight: THREE.PointLight,
  // Objects
  group: THREE.Group,
  mesh: THREE.Mesh,
});

interface FretboardVisualizerProps {
  notes: ExerciseNote[];
  currentTime: number;
  bpm: number;
  isPlaying: boolean;
  onCameraReset?: () => void;
  onSettingsClick?: () => void;
}

// 3D Scene Component - contains all Three.js elements
function FretboardScene({
  notes,
  currentTime,
  bpm,
  isPlaying,
  onCameraReset,
}: Omit<FretboardVisualizerProps, 'onSettingsClick'>) {
  const { visibleNotes, playStripPosition: _playStripPosition } =
    useFretboardState({
      notes,
      currentTime,
      bpm,
      isPlaying,
    });

  const { performanceSettings: _performanceSettings } =
    useThreeJSOptimization();

  return (
    <>
      {/* Camera Setup */}
      <PerspectiveCamera
        makeDefault
        position={[0, 8, 12]}
        fov={50}
        near={0.1}
        far={1000}
      />

      {/* 3D Fretboard (includes its own lighting) */}
      <Fretboard3D visible={true} />

      {/* Note Visualization */}
      <NoteRenderer
        notes={visibleNotes}
        currentTime={currentTime}
        bpm={bpm}
        visible={true}
      />

      {/* Technique Visualization */}
      <TechniqueRenderer
        notes={visibleNotes}
        currentTime={currentTime}
        visible={true}
      />

      {/* Camera Controls */}
      <CameraControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        onCameraChange={onCameraReset}
      />

      {/* OrbitControls for mouse/touch interaction */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        maxPolarAngle={Math.PI / 2}
        minDistance={5}
        maxDistance={30}
      />
    </>
  );
}

export function FretboardVisualizer({
  notes,
  currentTime,
  bpm,
  isPlaying,
  onCameraReset,
  onSettingsClick,
}: FretboardVisualizerProps) {
  return (
    <div className="w-full h-full relative">
      {/* Three.js Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 8, 12], fov: 50 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        dpr={[1, 2]} // Device pixel ratio for retina displays
        className="w-full h-full"
      >
        <FretboardScene
          notes={notes}
          currentTime={currentTime}
          bpm={bpm}
          isPlaying={isPlaying}
          onCameraReset={onCameraReset}
        />
      </Canvas>

      {/* UI Overlay (outside Canvas) */}
      {onSettingsClick && (
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={onSettingsClick}
            className="bg-slate-800/80 hover:bg-slate-700/80 text-white p-2 rounded-lg backdrop-blur-sm transition-colors"
            aria-label="Fretboard Settings"
          >
            ⚙️
          </button>
        </div>
      )}

      {/* Performance Indicator (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 left-4 text-xs text-slate-400 bg-slate-900/80 px-2 py-1 rounded backdrop-blur-sm">
          3D Fretboard Visualizer
        </div>
      )}
    </div>
  );
}
