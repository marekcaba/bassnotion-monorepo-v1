import * as THREE from 'three';
import { STRING_COLORS } from '../types/fretboard';

// String color mapping by string number (1-4)
export const getStringColor = (stringNumber: number): string => {
  switch (stringNumber) {
    case 1:
      return STRING_COLORS.E; // Red - E string (lowest)
    case 2:
      return STRING_COLORS.A; // Teal - A string
    case 3:
      return STRING_COLORS.D; // Blue - D string
    case 4:
      return STRING_COLORS.G; // Green - G string (highest)
    default:
      return STRING_COLORS.E;
  }
};

// Convert hex color to THREE.Color
export const hexToThreeColor = (hex: string): THREE.Color => {
  return new THREE.Color(hex);
};

// Get string color as THREE.Color
export const getStringThreeColor = (stringNumber: number): THREE.Color => {
  return hexToThreeColor(getStringColor(stringNumber));
};

// Material colors for fretboard components
export const FRETBOARD_MATERIALS = {
  // Fretboard - Dark rosewood with grain texture
  fretboard: {
    color: new THREE.Color(0x2d1810), // Dark brown
    roughness: 0.8,
    metalness: 0.1,
  },

  // Frets - Metallic silver with subtle reflections
  frets: {
    color: new THREE.Color(0xc0c0c0), // Silver
    roughness: 0.2,
    metalness: 0.9,
  },

  // Strings - Realistic steel wire appearance
  strings: {
    color: new THREE.Color(0x808080), // Steel gray
    roughness: 0.3,
    metalness: 0.8,
  },

  // Inlays - Pearl-like position markers
  inlays: {
    color: new THREE.Color(0xf8f8ff), // Pearl white
    roughness: 0.1,
    metalness: 0.2,
    opacity: 0.9,
  },
};

// Note visualization colors
export const NOTE_COLORS = {
  current: '#FF0000', // Bright red for current note
  upcoming: '#00FF00', // Bright green for upcoming notes
  played: '#808080', // Gray for played notes
  selected: '#FFFF00', // Yellow for selected/highlighted notes
};

// Create note material with glow effect
export const createNoteMaterial = (
  color: string,
  opacity = 1.0,
): THREE.MeshStandardMaterial => {
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    emissive: new THREE.Color(color),
    emissiveIntensity: 0.3,
    transparent: opacity < 1.0,
    opacity,
    roughness: 0.4,
    metalness: 0.1,
  });

  return material;
};

// Create fretboard material
export const createFretboardMaterial = (): THREE.MeshStandardMaterial => {
  return new THREE.MeshStandardMaterial({
    color: FRETBOARD_MATERIALS.fretboard.color,
    roughness: FRETBOARD_MATERIALS.fretboard.roughness,
    metalness: FRETBOARD_MATERIALS.fretboard.metalness,
  });
};

// Create fret material
export const createFretMaterial = (): THREE.MeshStandardMaterial => {
  return new THREE.MeshStandardMaterial({
    color: FRETBOARD_MATERIALS.frets.color,
    roughness: FRETBOARD_MATERIALS.frets.roughness,
    metalness: FRETBOARD_MATERIALS.frets.metalness,
  });
};

// Create string material
export const createStringMaterial = (): THREE.MeshStandardMaterial => {
  return new THREE.MeshStandardMaterial({
    color: FRETBOARD_MATERIALS.strings.color,
    roughness: FRETBOARD_MATERIALS.strings.roughness,
    metalness: FRETBOARD_MATERIALS.strings.metalness,
  });
};

// Create inlay material
export const createInlayMaterial = (): THREE.MeshStandardMaterial => {
  return new THREE.MeshStandardMaterial({
    color: FRETBOARD_MATERIALS.inlays.color,
    roughness: FRETBOARD_MATERIALS.inlays.roughness,
    metalness: FRETBOARD_MATERIALS.inlays.metalness,
    transparent: true,
    opacity: FRETBOARD_MATERIALS.inlays.opacity,
  });
};

// Opacity calculation for upcoming notes (gradual fading)
export const calculateNoteOpacity = (
  noteIndex: number,
  maxUpcomingNotes = 4,
): number => {
  if (noteIndex === 0) return 1.0; // Current note is fully opaque
  if (noteIndex > maxUpcomingNotes) return 0.0; // Notes beyond range are invisible

  // Gradual fade: 5th note at 20% opacity, increasing as it approaches current
  const baseOpacity = 0.2;
  const opacityIncrement = (1.0 - baseOpacity) / maxUpcomingNotes;

  return 1.0 - noteIndex * opacityIncrement;
};
