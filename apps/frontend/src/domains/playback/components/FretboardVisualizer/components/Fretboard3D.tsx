'use client';

import React, { useMemo } from 'react';
import {
  createCompleteFretboardGeometry,
  BASS_FRETBOARD_DIMENSIONS,
} from '../utils/fretboardGeometry';
import {
  createFretboardMaterial,
  createFretMaterial,
  createStringMaterial,
  createInlayMaterial,
} from '../utils/colorScheme';

interface Fretboard3DProps {
  visible?: boolean;
}

// This component will be used inside a Canvas from react-three-fiber
export function Fretboard3D({ visible = true }: Fretboard3DProps) {
  // Create fretboard geometry and materials
  const { fretboardGeometry, fretboardMaterial } = useMemo(() => {
    const geometry = createCompleteFretboardGeometry();
    return {
      fretboardGeometry: geometry,
      fretboardMaterial: {
        fretboard: createFretboardMaterial(),
        frets: createFretMaterial(),
        strings: createStringMaterial(),
        inlays: createInlayMaterial(),
      },
    };
  }, []);

  if (!visible) return null;

  // Note: This JSX will work inside a Canvas component from react-three-fiber
  // The parent FretboardVisualizer component will provide the Canvas context
  return (
    <>
      <group name="fretboard3d">
        {/* Main fretboard */}
        <mesh
          geometry={fretboardGeometry.fretboard}
          material={fretboardMaterial.fretboard}
          castShadow
          receiveShadow
        />

        {/* Fret wires */}
        {fretboardGeometry.frets.map((fretGeometry, index) => (
          <mesh
            key={`fret-${index}`}
            geometry={fretGeometry}
            material={fretboardMaterial.frets}
            castShadow
          />
        ))}

        {/* Strings */}
        {fretboardGeometry.strings.map((stringGeometry, index) => (
          <mesh
            key={`string-${index}`}
            geometry={stringGeometry}
            material={fretboardMaterial.strings}
            castShadow
          />
        ))}

        {/* Inlays (position markers) */}
        {fretboardGeometry.inlays.map((inlayGeometry, index) => (
          <mesh
            key={`inlay-${index}`}
            geometry={inlayGeometry}
            material={fretboardMaterial.inlays}
          />
        ))}
      </group>

      {/* Lighting setup as specified in story */}
      <ambientLight intensity={0.4} color="#ffffff" />

      <directionalLight
        position={[10, 10, 5]}
        intensity={0.8}
        color="#ffffff"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={50}
        shadow-camera-left={-50}
        shadow-camera-right={50}
        shadow-camera-top={50}
        shadow-camera-bottom={-50}
      />

      <pointLight
        position={[0, 20, -BASS_FRETBOARD_DIMENSIONS.scaleLength * 0.4]}
        intensity={0.6}
        color="#fff8e1"
        distance={500}
        decay={2}
      />
    </>
  );
}
