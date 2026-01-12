/**
 * RingOverlayConfig - Types and Configuration for Guitar Hero Ring Overlay
 *
 * This module defines the configuration options and types for the 3D floating
 * torus ring overlay system. The ring overlay provides Guitar Hero-style visual
 * feedback for note timing on the 2D fretboard.
 *
 * @module RingOverlayConfig
 * @since Phase 1 - Foundation
 */

/**
 * Available ring animation styles.
 * Each style provides a different visual effect for the approaching ring.
 */
export type RingStyle =
  | 'classic' // Yellow static highlight (free tier fallback)
  | 'spotlight' // Moving yellow dot (premium)
  | 'guitarHero' // Approaching notes from distance with descent (premium)
  | 'technique' // Color changes by bass technique (premium)
  | 'pulse' // Rhythmic pulse effect synced to beat (premium)
  | 'trail'; // Ghost trail behind ring (pro)

/**
 * Configuration options for the ring overlay system.
 * These settings control appearance, timing, and behavior of the 3D rings.
 */
export interface RingOverlayConfig {
  /** Whether the ring overlay is enabled */
  enabled: boolean;

  /** Current animation style */
  style: RingStyle;

  /** How far ahead to show incoming notes (milliseconds) */
  lookaheadMs: number;

  /** Movement speed multiplier (1.0 = normal, 2.0 = double speed) */
  animationSpeed: number;

  /** Whether to use technique-specific colors (hammer-on, pull-off, etc.) */
  techniqueColors: boolean;

  /** Maximum number of upcoming notes to show simultaneously */
  showUpcoming: number;

  /** Ring radius in Three.js world units */
  ringSize: number;

  /** Emissive glow intensity (0-1 scale) */
  glowIntensity: number;

  /** Starting height above fretboard (Y-axis) in world units */
  startHeight: number;

  /** Ending height when ring arrives at note (Y-axis) in world units */
  endHeight: number;
}

/**
 * Default configuration values for the ring overlay.
 * These provide a balanced starting point for the Guitar Hero style animation.
 */
export const DEFAULT_RING_CONFIG: RingOverlayConfig = {
  enabled: false,
  style: 'guitarHero',
  lookaheadMs: 2000, // 2 seconds lookahead
  animationSpeed: 1.0,
  techniqueColors: true,
  showUpcoming: 3,
  ringSize: 0.6, // Matches approximate size of fretboard dots
  glowIntensity: 0.5,
  startHeight: 5, // Start floating above
  endHeight: 0.5, // End just above fretboard surface
};

/**
 * Torus geometry configuration for the ring mesh.
 * TorusGeometry(radius, tube, radialSegments, tubularSegments)
 */
export const TORUS_GEOMETRY_CONFIG = {
  radius: 0.6, // Main ring radius
  tube: 0.15, // Thickness of the tube
  radialSegments: 16, // Segments around the tube
  tubularSegments: 32, // Segments around the ring
} as const;

/**
 * Camera configuration for the overlay canvas.
 * Positioned looking down at the fretboard plane.
 */
export const OVERLAY_CAMERA_CONFIG = {
  position: [0, 15, 0] as const, // Looking down from above
  fov: 50, // Field of view
  near: 0.1,
  far: 100,
} as const;

/**
 * Light configuration for the overlay scene.
 */
export const OVERLAY_LIGHTING_CONFIG = {
  ambient: {
    intensity: 0.6,
  },
  point: {
    position: [0, 10, 0] as const,
    intensity: 0.5,
  },
} as const;
