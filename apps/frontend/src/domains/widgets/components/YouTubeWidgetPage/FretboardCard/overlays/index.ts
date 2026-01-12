/**
 * Ring Overlay Module - Guitar Hero Style 3D Ring Animation
 *
 * This module provides a 3D floating torus ring overlay system that enhances
 * the 2D fretboard with Guitar Hero-style approaching note animations.
 *
 * Key components:
 * - Ring3DOverlayCanvas: Main R3F Canvas container (transparent overlay)
 * - RingOverlayGroup: Container managing multiple rings
 * - FloatingTorusRing: Individual 3D torus with useFrame animation
 * - useRingOverlay: Hook for access control and configuration
 *
 * @module overlays
 * @since Phase 1 - Foundation
 */

// Configuration and types
export {
  type RingStyle,
  type RingOverlayConfig,
  DEFAULT_RING_CONFIG,
  TORUS_GEOMETRY_CONFIG,
  OVERLAY_CAMERA_CONFIG,
  OVERLAY_LIGHTING_CONFIG,
} from './RingOverlayConfig.js';

// Technique colors
export {
  TECHNIQUE_COLORS,
  EXTENDED_TECHNIQUE_COLORS,
  getTechniqueColor,
  getTechniqueEmissive,
  getRingOpacity,
  RING_OPACITY_BY_INDEX,
} from './ringStyles.js';

// Coordinate mapping utilities
export {
  type CoordMappingConfig,
  type Position3D,
  DEFAULT_COORD_CONFIG,
  fretToX,
  stringToZ,
  fretboardTo3DPosition,
  createPositionCalculator,
  calculateCameraHeight,
} from './utils/fretboardTo3DCoords.js';

// Main hook
export {
  useRingOverlay,
  type UseRingOverlayOptions,
  type UseRingOverlayResult,
  type EnableRingResult,
} from './useRingOverlay.js';

// React components
export {
  FloatingTorusRing,
  type FloatingTorusRingProps,
} from './FloatingTorusRing.js';

export {
  RingOverlayGroup,
  type RingOverlayGroupProps,
} from './RingOverlayGroup.js';

export {
  Ring3DOverlayCanvas,
  type Ring3DOverlayCanvasProps,
} from './Ring3DOverlayCanvas.js';

// Re-export NoteTimelineEntry for convenience
export type { NoteTimelineEntry } from '@/domains/widgets/hooks/useFretboardNoteSync';
