import * as THREE from 'three';

// Note representation for fretboard visualization
export interface ExerciseNote {
  id: string;
  timestamp: number; // milliseconds from start
  string: number; // 1-4 (E, A, D, G)
  fret: number; // 0-24
  duration: number; // milliseconds
  note: string; // Note name (e.g., "E2", "A2")
  color?: string; // Optional custom color
  // Epic 4 preparation
  technique?: TechniqueTypes;
  velocity?: number;
}

// String color coding as specified in story
export const STRING_COLORS = {
  E: '#FF6B6B', // Red - E string (lowest)
  A: '#4ECDC4', // Teal - A string
  D: '#45B7D1', // Blue - D string
  G: '#96CEB4', // Green - G string (highest)
} as const;

// Epic 4 technique types preparation
export type TechniqueTypes =
  | 'basic'
  | 'hammer_on'
  | 'pull_off'
  | 'slide'
  | 'bend'
  | 'harmonic';

// Fretboard dimensions as specified in story
export interface FretboardDimensions {
  scaleLength: number; // 864mm (34 inches)
  fretCount: number; // 24 frets
  stringSpacing: number; // 19mm between strings
  stringCount: number; // 4 strings for bass
}

// Camera control state
export interface CameraState {
  position: THREE.Vector3;
  target: THREE.Vector3;
  zoom: number;
  enablePan: boolean;
  enableZoom: boolean;
  enableRotate: boolean;
}

// Fretboard visualizer state
export interface FretboardState {
  isPlaying: boolean;
  currentTime: number; // Current playback time in milliseconds
  notes: ExerciseNote[];
  bpm: number;
  camera: CameraState;
  performance: {
    fps: number;
    frameTime: number;
  };
}

// Note renderer interface for Epic 4 modular system
export interface NoteRenderer {
  renderBasicNote(note: ExerciseNote, scene: THREE.Scene): THREE.Object3D;
  renderTechnique?(
    technique: TechniqueTypes,
    note: ExerciseNote,
    scene: THREE.Scene,
  ): THREE.Object3D;
  cleanup(object: THREE.Object3D): void;
}

// Technique renderer interface for Epic 4
export interface TechniqueRenderer {
  canRender(technique: TechniqueTypes): boolean;
  render(note: ExerciseNote, scene: THREE.Scene): THREE.Object3D;
  cleanup(): void;
}

// Fretboard geometry configuration
export interface FretboardGeometry {
  fretboard: THREE.BufferGeometry;
  frets: THREE.BufferGeometry[];
  strings: THREE.BufferGeometry[];
  inlays: THREE.BufferGeometry[];
}

// Performance optimization settings
export interface PerformanceSettings {
  targetFPS: number; // 60fps as specified
  maxNotes: number; // Maximum notes to render simultaneously
  lodLevels: {
    desktop: number;
    tablet: number;
    mobile: number;
  };
}
