'use client';

/**
 * FloatingTorusRing - Individual 3D Torus Ring with useFrame Animation
 *
 * This component renders a single floating torus (donut) ring that descends
 * toward its target note position on the fretboard. The ring uses Three.js
 * TorusGeometry and animates at 60fps via useFrame.
 *
 * Animation behavior:
 * 1. Ring starts at startHeight above the fretboard
 * 2. Ring descends toward endHeight as progress increases (0 to 1)
 * 3. Ring color is determined by bass technique (hammer-on, pull-off, etc.)
 * 4. Ring has emissive glow for visibility on transparent canvas
 * 5. Ring gently rotates for visual interest
 *
 * @module FloatingTorusRing
 * @since Phase 1 - Foundation
 */

import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { BassArticulationType } from '@bassnotion/contracts';
import type { NoteTimelineEntry } from '@/domains/widgets/hooks/useFretboardNoteSync';
import type { RingOverlayConfig } from './RingOverlayConfig.js';
import { TORUS_GEOMETRY_CONFIG } from './RingOverlayConfig.js';
import { getTechniqueColor, getRingOpacity } from './ringStyles.js';
import type { Position3D } from './utils/fretboardTo3DCoords.js';

/**
 * Props for the FloatingTorusRing component.
 */
export interface FloatingTorusRingProps {
  /** The note timeline entry this ring represents */
  note: NoteTimelineEntry;
  /** Current playback time in seconds */
  currentTime: number;
  /** Ring overlay configuration */
  config: RingOverlayConfig;
  /** Function to convert fretboard position to 3D world coordinates */
  get3DPosition: (stringIndex: number, fret: number | 'open') => Position3D;
  /** Index of this ring in the upcoming notes queue (0 = closest) */
  ringIndex: number;
}

/**
 * Calculate animation progress based on current time and note timing.
 *
 * @param noteStartTime - When the note should be played
 * @param currentTime - Current playback position
 * @param lookaheadMs - How far ahead rings appear
 * @returns Progress value from 0 (just appeared) to 1 (at note position)
 */
function calculateProgress(
  noteStartTime: number,
  currentTime: number,
  lookaheadMs: number,
): number {
  const lookaheadSec = lookaheadMs / 1000;
  const entryTime = noteStartTime - lookaheadSec;

  if (currentTime < entryTime) return 0;
  if (currentTime >= noteStartTime) return 1;

  return (currentTime - entryTime) / lookaheadSec;
}

/**
 * FloatingTorusRing renders a 3D torus that animates toward a fretboard position.
 *
 * Uses useFrame for smooth 60fps GPU-accelerated animation.
 * The ring:
 * - Descends on Y-axis from startHeight to endHeight
 * - Moves on X/Z axes toward the target fret/string position
 * - Rotates gently for visual interest
 * - Uses emissive material for glow effect
 */
export function FloatingTorusRing({
  note,
  currentTime,
  config,
  get3DPosition,
  ringIndex,
}: FloatingTorusRingProps): JSX.Element | null {
  const meshRef = useRef<THREE.Mesh>(null);

  // Extract technique from note for color determination
  // The note may have an articulation property with a type field
  const technique = useMemo((): BassArticulationType | undefined => {
    const noteData = note.note as
      | { articulation?: { type?: BassArticulationType } }
      | undefined;
    return noteData?.articulation?.type;
  }, [note.note]);

  // Calculate target 3D position from note's fretboard position
  const targetPosition = useMemo((): Position3D => {
    const fret = note.position.fret === 'open' ? 'open' : note.position.fret;
    return get3DPosition(note.position.stringIndex, fret);
  }, [note.position, get3DPosition]);

  // Get color based on technique (or default yellow for normal)
  const color = useMemo(() => {
    if (config.techniqueColors && technique) {
      return getTechniqueColor(technique);
    }
    return getTechniqueColor('normal');
  }, [config.techniqueColors, technique]);

  // Calculate opacity based on ring index (further = more transparent)
  const opacity = useMemo(() => {
    return getRingOpacity(ringIndex);
  }, [ringIndex]);

  // Calculate initial progress for positioning
  const initialProgress = useMemo(() => {
    return calculateProgress(note.startTime, currentTime, config.lookaheadMs);
  }, [note.startTime, currentTime, config.lookaheadMs]);

  // Skip rendering if progress is complete (ring has arrived)
  if (initialProgress >= 1) {
    return null;
  }

  // useFrame runs every frame for smooth animation
  // We update position and rotation directly on the mesh for performance
  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // Calculate current progress
    const progress = calculateProgress(
      note.startTime,
      currentTime,
      config.lookaheadMs,
    );

    // Apply animation speed multiplier to delta for consistent feel
    const speedMultiplier = config.animationSpeed;

    // Animate Y position (descend toward fretboard)
    const startY = config.startHeight;
    const endY = config.endHeight;
    const targetY = THREE.MathUtils.lerp(startY, endY, progress);
    meshRef.current.position.y = THREE.MathUtils.lerp(
      meshRef.current.position.y,
      targetY,
      Math.min(delta * 5 * speedMultiplier, 1),
    );

    // Animate X position toward target
    meshRef.current.position.x = THREE.MathUtils.lerp(
      meshRef.current.position.x,
      targetPosition[0],
      Math.min(delta * 5 * speedMultiplier, 1),
    );

    // Animate Z position toward target
    meshRef.current.position.z = THREE.MathUtils.lerp(
      meshRef.current.position.z,
      targetPosition[2],
      Math.min(delta * 5 * speedMultiplier, 1),
    );

    // Gentle rotation for visual interest
    meshRef.current.rotation.x += delta * 0.5 * speedMultiplier;
    meshRef.current.rotation.z += delta * 0.2 * speedMultiplier;
  });

  // Initial position: at target X/Z but at start height
  const initialPosition: [number, number, number] = [
    targetPosition[0],
    config.startHeight,
    targetPosition[2],
  ];

  return (
    <mesh ref={meshRef} position={initialPosition}>
      <torusGeometry
        args={[
          config.ringSize || TORUS_GEOMETRY_CONFIG.radius,
          TORUS_GEOMETRY_CONFIG.tube,
          TORUS_GEOMETRY_CONFIG.radialSegments,
          TORUS_GEOMETRY_CONFIG.tubularSegments,
        ]}
      />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={config.glowIntensity}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
