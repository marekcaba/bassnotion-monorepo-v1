'use client';

import React, { useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { BASS_FRETBOARD_DIMENSIONS } from '../utils/fretboardGeometry';

interface CameraControlsProps {
  enablePan?: boolean;
  enableZoom?: boolean;
  enableRotate?: boolean;
  autoRotate?: boolean;
  onCameraChange?: () => void;
}

export function CameraControls({
  enablePan = true,
  enableZoom = true,
  enableRotate = true,
  autoRotate = false,
  onCameraChange,
}: CameraControlsProps) {
  const controlsRef = useRef(null);

  // Camera positioning for optimal fretboard view
  const defaultTarget: [number, number, number] = [
    0,
    0,
    -BASS_FRETBOARD_DIMENSIONS.scaleLength * 0.3,
  ];
  const minDistance = 200; // mm
  const maxDistance = 1000; // mm

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={enablePan}
      enableZoom={enableZoom}
      enableRotate={enableRotate}
      autoRotate={autoRotate}
      autoRotateSpeed={0.5}
      target={defaultTarget}
      minDistance={minDistance}
      maxDistance={maxDistance}
      maxPolarAngle={Math.PI * 0.8} // Prevent going underneath
      minPolarAngle={Math.PI * 0.1} // Prevent going too high
      onChange={onCameraChange}
    />
  );
}
