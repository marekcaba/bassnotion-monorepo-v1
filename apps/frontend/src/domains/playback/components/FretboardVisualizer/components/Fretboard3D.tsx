'use client';

import React from 'react';

interface Fretboard3DProps {
  visible?: boolean;
  strings?: number;
}

export function Fretboard3D({ visible = true, strings = 4 }: Fretboard3DProps) {
  if (!visible) return null;

  const frets = 13; // 0-12 frets
  const stringSpacing = 1.0; // Space between strings
  const fretSpacing = 1.5; // Space between frets

  // Generate dots for each string and fret
  const dots = [];
  for (let stringIndex = 0; stringIndex < strings; stringIndex++) {
    for (let fretIndex = 0; fretIndex < frets; fretIndex++) {
      // Calculate position
      const x = fretIndex * fretSpacing - ((frets - 1) * fretSpacing) / 2;
      const z = (stringIndex - (strings - 1) / 2) * stringSpacing;

      // Perspective scaling - bottom strings bigger, top strings smaller
      const scale = 1 - stringIndex * 0.1;
      const dotSize = 0.25 * scale;

      // Zero fret = square, other frets = circle
      const isZeroFret = fretIndex === 0;

      dots.push(
        <mesh
          key={`dot-${stringIndex}-${fretIndex}`}
          position={[x, 0, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          {isZeroFret ? (
            <planeGeometry args={[dotSize * 1.5, dotSize * 1.5]} />
          ) : (
            <circleGeometry args={[dotSize, 16]} />
          )}
          <meshBasicMaterial color="#cccccc" />
        </mesh>,
      );
    }
  }

  return (
    <>
      {/* Tilted group for perspective */}
      <group rotation={[-0.2, 0, 0]} position={[0, 0, 0]}>
        {dots}
      </group>

      {/* Bright lighting */}
      <ambientLight intensity={1.2} />
    </>
  );
}
