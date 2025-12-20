/**
 * Drum Pattern Editor - Types
 *
 * Type definitions for the grid-based drum pattern editor.
 * Uses 18 drum lanes with 5 velocity layers.
 */

import type { DrumHit, MidiDrumType, MusicalPosition } from '@bassnotion/contracts';

// Re-export contract types for convenience
export type { DrumHit, MidiDrumType, MusicalPosition };

/**
 * Grid resolution options for the drum editor
 */
export type GridResolution = '1/4' | '1/8' | '1/16' | '1/32';

/**
 * Edit mode for the drum grid
 */
export type EditMode = 'draw' | 'select' | 'velocity';

/**
 * Configuration for a single drum lane
 */
export interface DrumLaneConfig {
  /** Drum type identifier */
  drum: MidiDrumType;
  /** Display name shown in UI */
  displayName: string;
  /** Color for this lane (hex) */
  color: string;
  /** General MIDI note number */
  midiNote: number;
  /** Per-lane volume (0-1) */
  volume: number;
  /** Whether lane is muted */
  muted: boolean;
  /** Whether lane is collapsed in UI */
  collapsed: boolean;
}

/**
 * Pattern metadata for library storage
 */
export interface PatternMetadata {
  id: string;
  name: string;
  description?: string;
  genre?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  timeSignature: { numerator: number; denominator: number };
  bars: number;
  tempo?: number;
  tags?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Grid cell position (not musical time)
 */
export interface GridPosition {
  /** Row index (drum lane) */
  row: number;
  /** Column index (time division) */
  col: number;
}

/**
 * Grid cell data for rendering
 */
export interface GridCellData {
  /** Grid position */
  position: GridPosition;
  /** Corresponding musical position */
  musicalPosition: MusicalPosition;
  /** Hit at this position (if any) */
  hit: DrumHit | null;
  /** Whether cell is selected */
  isSelected: boolean;
  /** Whether this is the current playhead position */
  isPlayhead: boolean;
}

/**
 * Drum editor playback state
 */
export interface PlaybackState {
  isPlaying: boolean;
  isLooping: boolean;
  currentTick: number;
  tempo: number;
}

/**
 * Swing configuration
 */
export interface SwingConfig {
  /** Swing amount (0-100) */
  amount: number;
  /** Style of swing */
  style: 'even' | 'triplet';
}

/**
 * Editor state for Zustand store
 */
export interface DrumEditorState {
  // Pattern Data
  pattern: DrumHit[];
  patternId: string | null;
  patternName: string;
  bars: number;
  timeSignature: { numerator: number; denominator: number };

  // Grid Settings
  gridResolution: GridResolution;
  snapEnabled: boolean;
  zoomLevel: number;

  // Groove Settings
  swingAmount: number;

  // Selection & Editing
  selectedHitIds: string[];
  clipboard: DrumHit[];
  editMode: EditMode;

  // Playback Preview
  isPlaying: boolean;
  isLooping: boolean;
  previewTempo: number;
  currentPlayheadTick: number;

  // Lane Configuration
  lanes: DrumLaneConfig[];
  visibleLanes: MidiDrumType[];

  // History (Undo/Redo)
  history: DrumHit[][];
  historyIndex: number;

  // Dirty flag
  isDirty: boolean;
}

/**
 * Editor actions for Zustand store
 */
export interface DrumEditorActions {
  // Hit Management
  addHit: (drum: MidiDrumType, position: MusicalPosition, velocity?: number) => void;
  removeHit: (hitId: string) => void;
  toggleHit: (drum: MidiDrumType, position: MusicalPosition) => void;
  updateHitVelocity: (hitId: string, velocity: number) => void;
  moveHit: (hitId: string, newPosition: MusicalPosition) => void;

  // Settings
  setSwing: (amount: number) => void;
  setGridResolution: (resolution: GridResolution) => void;
  setBars: (bars: number) => void;
  setTempo: (bpm: number) => void;
  setEditMode: (mode: EditMode) => void;
  setZoomLevel: (zoom: number) => void;

  // Selection
  selectHit: (hitId: string, addToSelection?: boolean) => void;
  selectHitsInRange: (startPos: GridPosition, endPos: GridPosition) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => void;

  // Clipboard
  copySelection: () => void;
  pasteClipboard: (position: MusicalPosition) => void;

  // History
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;

  // Pattern Operations
  clearPattern: () => void;
  loadPattern: (pattern: DrumHit[], metadata?: Partial<PatternMetadata>) => void;
  resetToInitial: () => void;

  // Lane Management
  toggleLaneMute: (drum: MidiDrumType) => void;
  toggleLaneCollapse: (drum: MidiDrumType) => void;
  setLaneVolume: (drum: MidiDrumType, volume: number) => void;
  setVisibleLanes: (lanes: MidiDrumType[]) => void;

  // Playback
  play: () => void;
  stop: () => void;
  toggleLoop: () => void;
  setPlayheadTick: (tick: number) => void;
}

/**
 * Complete Zustand store type
 */
export type DrumEditorStore = DrumEditorState & DrumEditorActions;

/**
 * Props for DrumPatternEditorModal
 */
export interface DrumPatternEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Initial pattern to edit (for editing mode) */
  initialPattern?: DrumHit[];
  /** Initial metadata (for editing mode) */
  initialMetadata?: Partial<PatternMetadata>;
  /** Callback when pattern is saved */
  onSave: (pattern: DrumHit[], metadata: PatternMetadata) => void;
  /** Optional tempo from parent context */
  contextTempo?: number;
  /** Optional time signature from parent context */
  contextTimeSignature?: { numerator: number; denominator: number };
}

/**
 * Props for DrumGrid component
 */
export interface DrumGridProps {
  /** Number of bars to display */
  bars: number;
  /** Grid resolution */
  resolution: GridResolution;
  /** Time signature */
  timeSignature: { numerator: number; denominator: number };
  /** Zoom level (0.5-2.0) */
  zoomLevel: number;
  /** Whether snap is enabled */
  snapEnabled: boolean;
  /** Current playhead tick position */
  playheadTick: number;
  /** Callback to preview a drum hit sound */
  onPreviewHit?: (drum: MidiDrumType, velocity?: number) => void;
}

/**
 * Props for DrumLaneRow component
 */
export interface DrumLaneRowProps {
  /** Lane configuration */
  lane: DrumLaneConfig;
  /** Hits in this lane */
  hits: DrumHit[];
  /** Selected hit IDs */
  selectedHitIds: string[];
  /** Total columns in grid */
  totalColumns: number;
  /** Grid resolution */
  resolution: GridResolution;
  /** Zoom level */
  zoomLevel: number;
  /** Callback when cell is clicked */
  onCellClick: (position: MusicalPosition) => void;
  /** Callback when cell is right-clicked */
  onCellRightClick: (hitId: string | null, position: MusicalPosition) => void;
  /** Current playhead column */
  playheadColumn: number;
  /** Callback to preview a drum hit sound */
  onPreviewHit?: (velocity?: number) => void;
}

/**
 * Props for DrumCell component
 */
export interface DrumCellProps {
  /** Cell data */
  data: GridCellData;
  /** Lane color */
  color: string;
  /** Cell width in pixels */
  width: number;
  /** Cell height in pixels */
  height: number;
  /** Whether this is a beat boundary */
  isBeatBoundary: boolean;
  /** Whether this is a measure boundary */
  isMeasureBoundary: boolean;
  /** Click handler */
  onClick: () => void;
  /** Right-click handler */
  onRightClick: () => void;
}

/**
 * Props for DrumEditorTransport component
 */
export interface DrumEditorTransportProps {
  isPlaying: boolean;
  isLooping: boolean;
  tempo: number;
  onPlay: () => void;
  onStop: () => void;
  onToggleLoop: () => void;
  onTempoChange: (tempo: number) => void;
}
