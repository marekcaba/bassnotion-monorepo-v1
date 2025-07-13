import type { SyncedWidgetRenderProps } from '../../../base';
import type { ExerciseNote } from '@bassnotion/contracts';

// Component Props
export interface FretboardCardContentProps {
  syncProps: SyncedWidgetRenderProps;
}

// Basic Types
export type StringCount = 4 | 5 | 6;
export type Fret = number | 'open';
export type PositionKey = string;
export type FretsArray = number[];
export type FretMarker = 3 | 5 | 7 | 9 | 12;

// Position and Coordinate Types
export interface FretboardPosition {
  stringIndex: number;
  fret: Fret;
}

export interface DotPosition {
  x: number;
  y: number;
}

export interface ConnectionLine {
  x: number;
  y: number;
  length: number;
  angle: number;
}

export interface Connection {
  pos1: FretboardPosition;
  pos2: FretboardPosition;
}

// State Types
export interface DraggedDot {
  stringIndex: number;
  fret: Fret;
  order: number;
}

export interface DragOverTarget {
  stringIndex: number;
  fret: Fret;
}

export type SelectedDotsMap = Map<string, number[]>;

export interface ExerciseState {
  exerciseNotes: ExerciseNote[];
  exerciseProgress: number;
  isExerciseMode: boolean;
}

export interface FretboardState {
  stringCount: StringCount;
  tiltAngle: number;
  maxFrets: number;
  selectedDots: SelectedDotsMap;
  selectionOrder: number;
  draggedDot: DraggedDot | null;
  dragOverTarget: DragOverTarget | null;
}

// Event Handler Types
export type DragStartHandler = (
  e: React.DragEvent,
  stringIndex: number,
  fret: Fret,
) => void;

export type DragOverHandler = (e: React.DragEvent) => void;

export type DragEnterHandler = (
  targetStringIndex: number,
  targetFret: Fret,
) => void;

export type DragLeaveHandler = () => void;

export type DragDropHandler = (
  e: React.DragEvent,
  targetStringIndex: number,
  targetFret: Fret,
) => void;

export type DragEndHandler = () => void;

export type DotClickHandler = (stringIndex: number, fret: Fret) => void;

export type ButtonClickHandler = () => void;

// Utility Function Types
export type AreDotsConnectedFunction = (
  pos1: FretboardPosition,
  pos2: FretboardPosition,
) => boolean;

export type GetConnectionLineFunction = (
  pos1: FretboardPosition,
  pos2: FretboardPosition,
) => ConnectionLine;

export type GetDotPositionFunction = (
  stringIndex: number,
  fret: Fret,
) => DotPosition;

export type IsDotSelectedFunction = (
  stringIndex: number,
  fret: Fret,
) => boolean;

export type GetDotOrderFunction = (stringIndex: number, fret: Fret) => number[];

export type IsExerciseNoteFunction = (
  stringIndex: number,
  fret: Fret,
) => boolean;

export type IsCurrentNoteFunction = (
  stringIndex: number,
  fret: Fret,
) => boolean;

// Line Highlighting Types
export type LineType = 'horizontal' | 'vertical' | 'diagonal';
export type DiagonalDirection =
  | 'right'
  | 'left'
  | 'up-right'
  | 'up-left'
  | 'down-right'
  | 'down-left';
export type CrossFretboardDirection =
  | 'down-right'
  | 'down-left'
  | 'up-right'
  | 'up-left';

export type ShouldHighlightLineFunction = (
  lineType: LineType,
  stringIndex: number,
  fret?: number,
  direction?: DiagonalDirection,
) => boolean;

export type ShouldHighlightLongDiagonalFunction = (
  stringIndex: number,
  fret: number,
  direction: DiagonalDirection,
) => boolean;

export type ShouldHighlightVerticalLongDiagonalFunction = (
  stringIndex: number,
  fret: number,
  direction: DiagonalDirection,
) => boolean;

export type ShouldHighlightDownDiagonalFunction = (
  stringIndex: number,
  fret: number,
  direction: CrossFretboardDirection,
) => boolean;

export type ShouldHighlightExtraLongDiagonalFunction = (
  stringIndex: number,
  fret: number,
  direction: DiagonalDirection,
) => boolean;

export type ShouldHighlight3String1FretDiagonalFunction = (
  stringIndex: number,
  fret: number,
  direction: DiagonalDirection,
) => boolean;

export type ShouldHighlight3x3DiagonalFunction = (
  stringIndex: number,
  fret: number,
  direction: CrossFretboardDirection,
) => boolean;

export type ShouldHighlightBasicCrossFretboardDiagonalAnyFretFunction = (
  stringIndex: number,
  fret: number,
  stringCount: StringCount,
  direction: 'down' | 'up',
  fretDirection: 'forward' | 'backward',
) => boolean;

export type ShouldHighlight4x2DiagonalFunction = (
  stringIndex: number,
  fret: number,
  direction: CrossFretboardDirection,
) => boolean;

export type ShouldHighlight3x2DiagonalFunction = (
  stringIndex: number,
  fret: number,
  direction: CrossFretboardDirection,
) => boolean;

export type ShouldHighlight2x3DiagonalFunction = (
  stringIndex: number,
  fret: number,
  direction: CrossFretboardDirection,
) => boolean;

// Audio Integration Types
export interface PlaybackPosition {
  isPlaying: boolean;
  currentNoteIndex: number;
}

export interface AudioFretboardIntegration {
  createNoteEvent: (stringIndex: number, fret: Fret) => any;
  triggerNote: (stringIndex: number, fret: Fret) => void;
  playbackIntegration: any;
  isAudioEnabled: boolean;
  audioError: string | null;
  stringConfigs: Record<StringCount, string[]>;
  playbackPosition: PlaybackPosition;
  isCurrentNote: IsCurrentNoteFunction;
}

// Bassline Data Types
export interface BasslineData {
  stringIndex: number;
  fret: Fret;
  order: number;
  note?: string;
}

export interface CustomBasslineEvent {
  bassline: BasslineData[];
  source: string;
  timestamp: number;
}

// Component Props Types
export interface RenderDotNumbersProps {
  stringIndex: number;
  fret: Fret;
}

export interface DragDetectionProps {
  stringIndex: number;
  fret: Fret;
}
