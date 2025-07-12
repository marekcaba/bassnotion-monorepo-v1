/**
 * MusicXML Type Definitions for BassNotion
 *
 * Defines TypeScript interfaces for parsing MusicXML files and converting them
 * to BassNotion's Exercise format. Focuses on bass-specific notation and
 * compatibility with existing ExerciseNote and musical timing systems.
 */

import {
  NoteDuration,
  MusicalPosition,
  TimeSignature,
} from './musical-timing.js';
import { ExerciseNote, TechniqueType } from './exercise.js';

// ============================================================================
// Core MusicXML Document Structure
// ============================================================================

export interface MusicXMLDocument {
  scorePartwise?: ScorePartwise;
  scoreTimewise?: ScoreTimewise;
  version?: string;
}

export interface ScorePartwise {
  work?: Work;
  identification?: Identification;
  defaults?: Defaults;
  partList: PartList;
  part: Part[];
}

export interface ScoreTimewise {
  work?: Work;
  identification?: Identification;
  defaults?: Defaults;
  partList: PartList;
  measure: TimewiseMeasure[];
}

// ============================================================================
// Document Metadata
// ============================================================================

export interface Work {
  workTitle?: string;
  workNumber?: string;
  opus?: string;
}

export interface Identification {
  creator?: Creator[];
  rights?: string;
  encoding?: Encoding;
  source?: string;
  miscellaneous?: Miscellaneous[];
}

export interface Creator {
  text: string;
  type?: 'composer' | 'lyricist' | 'arranger' | string;
}

export interface Encoding {
  software?: string[];
  encodingDate?: string;
  supports?: Supports[];
}

export interface Supports {
  type: string;
  element: string;
  attribute?: string;
  value?: string;
}

export interface Miscellaneous {
  name: string;
  text: string;
}

// ============================================================================
// Part Structure
// ============================================================================

export interface PartList {
  scorePart: ScorePart[];
  partGroup?: PartGroup[];
}

export interface ScorePart {
  id: string;
  partName: string;
  partAbbreviation?: string;
  scoreInstrument?: ScoreInstrument[];
  midiInstrument?: MidiInstrument[];
}

export interface ScoreInstrument {
  id: string;
  instrumentName: string;
  instrumentAbbreviation?: string;
  instrumentSound?: string;
}

export interface MidiInstrument {
  id: string;
  midiChannel?: number;
  midiProgram?: number;
  volume?: number;
  pan?: number;
}

export interface PartGroup {
  type: 'start' | 'stop';
  number: string;
  groupName?: string;
  groupAbbreviation?: string;
  groupSymbol?: string;
  groupBarline?: string;
}

export interface Part {
  id: string;
  measure: Measure[];
}

// ============================================================================
// Measure and Musical Content
// ============================================================================

export interface Measure {
  number: string;
  attributes?: Attributes[];
  note?: Note[];
  backup?: Backup[];
  forward?: Forward[];
  direction?: Direction[];
  harmony?: Harmony[];
  sound?: Sound;
  barline?: Barline[];
  implicit?: boolean;
  width?: number;
}

export interface TimewiseMeasure {
  number: string;
  part: TimewisePart[];
}

export interface TimewisePart {
  id: string;
  attributes?: Attributes[];
  note?: Note[];
  backup?: Backup[];
  forward?: Forward[];
  direction?: Direction[];
  harmony?: Harmony[];
  sound?: Sound;
  barline?: Barline[];
}

// ============================================================================
// Musical Attributes
// ============================================================================

export interface Attributes {
  divisions?: number;
  key?: Key[];
  time?: Time[];
  staves?: number;
  clef?: Clef[];
  staffDetails?: StaffDetails[];
  transpose?: Transpose[];
  directive?: Directive[];
  measureStyle?: MeasureStyle[];
}

export interface Key {
  fifths: number;
  mode?:
    | 'major'
    | 'minor'
    | 'dorian'
    | 'phrygian'
    | 'lydian'
    | 'mixolydian'
    | 'aeolian'
    | 'ionian'
    | 'locrian';
  keyStep?: string;
  keyAlter?: number;
  keyOctave?: number;
}

export interface Time {
  beats: string;
  beatType: string;
  symbol?:
    | 'common'
    | 'cut'
    | 'single-number'
    | 'note'
    | 'dotted-note'
    | 'normal';
}

export interface Clef {
  sign: 'G' | 'F' | 'C' | 'percussion' | 'TAB' | 'jianpu' | 'none';
  line?: number;
  clefOctaveChange?: number;
  number?: number;
}

export interface StaffDetails {
  number?: number;
  staffType?: string;
  staffLines?: number;
  staffTuning?: StaffTuning[];
  capo?: number;
  staffSize?: number;
}

export interface StaffTuning {
  line: number;
  tuningStep: string;
  tuningOctave: number;
  tuningAlter?: number;
}

// ============================================================================
// Notes and Musical Elements
// ============================================================================

export interface Note {
  // Core note properties
  pitch?: Pitch;
  rest?: Rest;
  unpitched?: Unpitched;

  // Duration and timing
  duration: number;
  type?: NoteType;
  dot?: Dot[];
  timeModification?: TimeModification;

  // Staff and voice
  voice?: string;
  staff?: number;

  // Articulations and techniques
  articulations?: Articulations[];
  technical?: Technical[];
  ornaments?: Ornaments[];
  dynamics?: Dynamics[];

  // Ties and slurs
  tie?: Tie[];
  slur?: Slur[];

  // Visual properties
  stem?: Stem;
  notehead?: Notehead;
  beam?: Beam[];
  accidental?: Accidental;

  // Lyrics and text
  lyric?: Lyric[];

  // Chord notation
  chord?: boolean;

  // Grace notes
  grace?: Grace;
  cue?: boolean;

  // Tablature (important for bass)
  fret?: number;
  string?: number;

  // Positioning
  defaultX?: number;
  defaultY?: number;
  relativeX?: number;
  relativeY?: number;
}

export interface Pitch {
  step: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G';
  alter?: number;
  octave: number;
}

export interface Rest {
  measure?: boolean;
  displayStep?: string;
  displayOctave?: number;
}

export interface Unpitched {
  displayStep?: string;
  displayOctave?: number;
}

export type NoteType =
  | 'maxima'
  | 'long'
  | 'breve'
  | 'whole'
  | 'half'
  | 'quarter'
  | 'eighth'
  | '16th'
  | '32nd'
  | '64th'
  | '128th'
  | '256th'
  | '512th'
  | '1024th';

// eslint-disable-next-line @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type
export interface Dot {
  // Empty interface - dots are just markers in MusicXML notation
  // This represents a dot after a note that increases its duration by half
}

export interface TimeModification {
  actualNotes: number;
  normalNotes: number;
  normalType?: NoteType;
  normalDot?: Dot[];
}

// ============================================================================
// Bass-Specific Techniques and Articulations
// ============================================================================

export interface Technical {
  upBow?: boolean;
  downBow?: boolean;
  harmonic?: Harmonic;
  openString?: boolean;
  thumbPosition?: boolean;
  fingering?: Fingering;
  pluck?: string;
  doubleTongue?: boolean;
  tripleTongue?: boolean;
  stopped?: boolean;
  snapPizzicato?: boolean;
  fret?: number;
  string?: number;
  hammerOn?: HammerOn;
  pullOff?: PullOff;
  bend?: Bend;
  tap?: boolean;
  heel?: boolean;
  toe?: boolean;
  fingernails?: boolean;
  other?: OtherTechnical;
}

export interface Harmonic {
  natural?: boolean;
  artificial?: boolean;
  basePitch?: Pitch;
  touchingPitch?: Pitch;
  soundingPitch?: Pitch;
}

export interface Fingering {
  text: string;
  substitution?: boolean;
  alternate?: boolean;
}

export interface HammerOn {
  type: 'start' | 'stop';
  number?: string;
  text?: string;
}

export interface PullOff {
  type: 'start' | 'stop';
  number?: string;
  text?: string;
}

export interface Bend {
  bendAlter: number;
  preBend?: boolean;
  release?: boolean;
  withBar?: boolean;
}

export interface OtherTechnical {
  text: string;
}

export interface Articulations {
  accent?: boolean;
  strongAccent?: boolean;
  staccato?: boolean;
  tenuto?: boolean;
  detachedLegato?: boolean;
  staccatissimo?: boolean;
  spiccato?: boolean;
  scoop?: boolean;
  plop?: boolean;
  doit?: boolean;
  falloff?: boolean;
  breathMark?: boolean;
  caesura?: boolean;
  stress?: boolean;
  unstress?: boolean;
  softAccent?: boolean;
  other?: OtherArticulation;
}

export interface OtherArticulation {
  text: string;
}

// ============================================================================
// Supporting Musical Elements
// ============================================================================

export interface Tie {
  type: 'start' | 'stop' | 'continue';
  number?: string;
}

export interface Slur {
  type: 'start' | 'stop' | 'continue';
  number?: string;
}

export interface Stem {
  value: 'up' | 'down' | 'none' | 'double';
}

export interface Notehead {
  value:
    | 'slash'
    | 'triangle'
    | 'diamond'
    | 'square'
    | 'cross'
    | 'x'
    | 'circle-x'
    | 'inverted-triangle'
    | 'arrow-down'
    | 'arrow-up'
    | 'slashed'
    | 'back-slashed'
    | 'normal'
    | 'cluster'
    | 'circle-dot'
    | 'left-triangle'
    | 'rectangle'
    | 'none'
    | 'do'
    | 're'
    | 'mi'
    | 'fa'
    | 'fa-up'
    | 'so'
    | 'la'
    | 'ti';
  filled?: boolean;
  parentheses?: boolean;
}

export interface Beam {
  value: 'begin' | 'continue' | 'end' | 'forward-hook' | 'backward-hook';
  number?: string;
}

export interface Accidental {
  value:
    | 'sharp'
    | 'natural'
    | 'flat'
    | 'double-sharp'
    | 'sharp-sharp'
    | 'flat-flat'
    | 'natural-sharp'
    | 'natural-flat'
    | 'quarter-flat'
    | 'quarter-sharp'
    | 'three-quarters-flat'
    | 'three-quarters-sharp'
    | 'sharp-down'
    | 'sharp-up'
    | 'natural-down'
    | 'natural-up'
    | 'flat-down'
    | 'flat-up'
    | 'double-sharp-down'
    | 'double-sharp-up'
    | 'flat-flat-down'
    | 'flat-flat-up'
    | 'arrow-down'
    | 'arrow-up'
    | 'triple-sharp'
    | 'triple-flat'
    | 'slash-quarter-sharp'
    | 'slash-sharp'
    | 'slash-flat'
    | 'double-slash-flat'
    | 'sharp-1'
    | 'sharp-2'
    | 'sharp-3'
    | 'sharp-5'
    | 'flat-1'
    | 'flat-2'
    | 'flat-3'
    | 'flat-4'
    | 'sori'
    | 'koron';
  cautionary?: boolean;
  editorial?: boolean;
  parentheses?: boolean;
  bracket?: boolean;
  size?: 'cue' | 'full' | 'large';
}

export interface Grace {
  stealTimePrevious?: number;
  stealTimeFollowing?: number;
  makeTime?: number;
  slash?: boolean;
}

export interface Lyric {
  number?: string;
  name?: string;
  text?: LyricText[];
  syllabic?: 'single' | 'begin' | 'end' | 'middle';
  extend?: boolean;
}

export interface LyricText {
  text: string;
}

// ============================================================================
// Navigation and Structure
// ============================================================================

export interface Backup {
  duration: number;
}

export interface Forward {
  duration: number;
  voice?: string;
  staff?: number;
}

export interface Direction {
  directionType: DirectionType[];
  voice?: string;
  staff?: number;
  sound?: Sound;
  offset?: number;
  placement?: 'above' | 'below';
}

export interface DirectionType {
  rehearsal?: string;
  segno?: boolean;
  coda?: boolean;
  words?: Words;
  dynamics?: Dynamics;
  wedge?: Wedge;
  metronome?: Metronome;
  octaveShift?: OctaveShift;
  other?: OtherDirection;
}

export interface Words {
  text: string;
  justify?: 'left' | 'center' | 'right';
  defaultX?: number;
  defaultY?: number;
  relativeX?: number;
  relativeY?: number;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
}

export interface Dynamics {
  p?: boolean;
  pp?: boolean;
  ppp?: boolean;
  pppp?: boolean;
  ppppp?: boolean;
  pppppp?: boolean;
  f?: boolean;
  ff?: boolean;
  fff?: boolean;
  ffff?: boolean;
  fffff?: boolean;
  ffffff?: boolean;
  mp?: boolean;
  mf?: boolean;
  sf?: boolean;
  sfp?: boolean;
  sfpp?: boolean;
  fp?: boolean;
  rf?: boolean;
  rfz?: boolean;
  sfz?: boolean;
  sffz?: boolean;
  fz?: boolean;
  n?: boolean;
  pf?: boolean;
  sfzp?: boolean;
  other?: OtherDynamics;
}

export interface OtherDynamics {
  text: string;
}

export interface Wedge {
  type: 'crescendo' | 'diminuendo' | 'stop' | 'continue';
  number?: string;
  spread?: number;
  niente?: boolean;
}

export interface Metronome {
  beatUnit: NoteType;
  beatUnitDot?: Dot[];
  perMinute: number;
  metronomeNote?: MetronomeNote[];
}

export interface MetronomeNote {
  metronomeType: NoteType;
  metronomeDot?: Dot[];
}

export interface OctaveShift {
  type: 'up' | 'down' | 'stop' | 'continue';
  number?: string;
  size?: number;
}

export interface OtherDirection {
  text: string;
}

export interface Sound {
  tempo?: number;
  dynamics?: number;
  dacapo?: boolean;
  segno?: string;
  dalsegno?: string;
  coda?: string;
  tocoda?: string;
  divisions?: number;
  forwardRepeat?: boolean;
  fineEnding?: string;
  timeOnly?: string;
  pizzicato?: boolean;
  pan?: number;
  elevation?: number;
  damperPedal?: boolean;
  softPedal?: boolean;
  sostenutoPedal?: boolean;
  offset?: number;
  midiChannel?: number;
  midiName?: string;
  midiBank?: number;
  midiProgram?: number;
  midiUnpitched?: number;
  volume?: number;
  play?: Play[];
}

export interface Play {
  id?: string;
  midiChannel?: number;
  midiName?: string;
  midiBank?: number;
  midiProgram?: number;
  midiUnpitched?: number;
  volume?: number;
  pan?: number;
  elevation?: number;
  damperPedal?: boolean;
  softPedal?: boolean;
  sostenutoPedal?: boolean;
}

// ============================================================================
// Additional Elements
// ============================================================================

export interface Barline {
  location?: 'left' | 'middle' | 'right';
  barStyle?:
    | 'regular'
    | 'dotted'
    | 'dashed'
    | 'heavy'
    | 'light-light'
    | 'light-heavy'
    | 'heavy-light'
    | 'heavy-heavy'
    | 'tick'
    | 'short'
    | 'none';
  repeat?: Repeat;
  ending?: Ending;
  segno?: boolean;
  coda?: boolean;
  fermata?: Fermata[];
}

export interface Repeat {
  direction: 'forward' | 'backward';
  times?: number;
  winged?: 'none' | 'straight' | 'curved' | 'double-straight' | 'double-curved';
}

export interface Ending {
  number: string;
  type: 'start' | 'stop' | 'discontinue';
  text?: string;
}

export interface Fermata {
  type?: 'upright' | 'inverted';
  shape?: 'normal' | 'angled' | 'square';
}

export interface Harmony {
  root: Root;
  kind: HarmonyKind;
  bass?: Bass;
  degree?: Degree[];
  inversion?: number;
  function?: string;
  offset?: number;
  staff?: number;
}

export interface Root {
  rootStep: string;
  rootAlter?: number;
}

export interface HarmonyKind {
  value:
    | 'major'
    | 'minor'
    | 'augmented'
    | 'diminished'
    | 'dominant'
    | 'major-seventh'
    | 'minor-seventh'
    | 'diminished-seventh'
    | 'augmented-seventh'
    | 'half-diminished'
    | 'major-minor'
    | 'major-sixth'
    | 'minor-sixth'
    | 'dominant-ninth'
    | 'major-ninth'
    | 'minor-ninth'
    | 'dominant-11th'
    | 'major-11th'
    | 'minor-11th'
    | 'dominant-13th'
    | 'major-13th'
    | 'minor-13th'
    | 'suspended-second'
    | 'suspended-fourth'
    | 'Neapolitan'
    | 'Italian'
    | 'French'
    | 'German'
    | 'pedal'
    | 'power'
    | 'Tristan'
    | 'other'
    | 'none';
  text?: string;
  stackDegrees?: boolean;
  parenthesesDegrees?: boolean;
  bracketDegrees?: boolean;
  useSymbols?: boolean;
}

export interface Bass {
  bassStep: string;
  bassAlter?: number;
}

export interface Degree {
  degreeValue: number;
  degreeAlter: number;
  degreeType: 'add' | 'alter' | 'subtract';
}

export interface Ornaments {
  trillMark?: boolean;
  turn?: boolean;
  delayedTurn?: boolean;
  invertedTurn?: boolean;
  delayedInvertedTurn?: boolean;
  verticalTurn?: boolean;
  shake?: boolean;
  wavyLine?: WavyLine;
  mordent?: boolean;
  invertedMordent?: boolean;
  schleifer?: boolean;
  tremolo?: Tremolo;
  other?: OtherOrnament;
  accidentalMark?: AccidentalMark[];
}

export interface WavyLine {
  type: 'start' | 'stop' | 'continue';
  number?: string;
}

export interface Tremolo {
  type?: 'start' | 'stop' | 'single' | 'unmeasured';
  marks?: number;
}

export interface OtherOrnament {
  text: string;
}

export interface AccidentalMark {
  value: string; // Same values as Accidental
}

export interface Defaults {
  scaling?: Scaling;
  layout?: Layout;
  appearance?: Appearance;
  musicFont?: MusicFont;
  wordFont?: WordFont;
  lyricFont?: LyricFont[];
  lyricLanguage?: LyricLanguage[];
}

export interface Scaling {
  millimeters: number;
  tenths: number;
}

export interface Layout {
  pageLayout?: PageLayout;
  systemLayout?: SystemLayout;
  staffLayout?: StaffLayout[];
}

export interface PageLayout {
  pageHeight?: number;
  pageWidth?: number;
  pageMargins?: PageMargins[];
}

export interface PageMargins {
  type?: 'odd' | 'even' | 'both';
  leftMargin: number;
  rightMargin: number;
  topMargin: number;
  bottomMargin: number;
}

export interface SystemLayout {
  systemMargins?: SystemMargins;
  systemDistance?: number;
  topSystemDistance?: number;
  systemDividers?: SystemDividers;
}

export interface SystemMargins {
  leftMargin: number;
  rightMargin: number;
}

export interface SystemDividers {
  leftDivider?: boolean;
  rightDivider?: boolean;
}

export interface StaffLayout {
  number?: number;
  staffDistance?: number;
}

export interface Appearance {
  lineWidth?: LineWidth[];
  noteSize?: NoteSize[];
  distance?: Distance[];
  glyph?: Glyph[];
  otherAppearance?: OtherAppearance[];
}

export interface LineWidth {
  type: string;
  value: number;
}

export interface NoteSize {
  type: 'cue' | 'grace' | 'large';
  value: number;
}

export interface Distance {
  type: string;
  value: number;
}

export interface Glyph {
  type: string;
  value: string;
}

export interface OtherAppearance {
  type: string;
  value: string;
}

export interface MusicFont {
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
}

export interface WordFont {
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
}

export interface LyricFont {
  number?: string;
  name?: string;
  fontFamily?: string;
  fontStyle?: 'normal' | 'italic';
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
}

export interface LyricLanguage {
  number?: string;
  name?: string;
  lang: string;
}

export interface Transpose {
  diatonic?: number;
  chromatic: number;
  octaveChange?: number;
  double?: boolean;
}

export interface Directive {
  text: string;
  lang?: string;
}

export interface MeasureStyle {
  number?: number;
  multipleRest?: MultipleRest;
  measureRepeat?: MeasureRepeat;
  beatRepeat?: BeatRepeat;
  slash?: Slash;
}

export interface MultipleRest {
  count: number;
  useSymbols?: boolean;
}

export interface MeasureRepeat {
  type: 'start' | 'stop';
  slashes?: number;
}

export interface BeatRepeat {
  type: 'start' | 'stop';
  slashes?: number;
  useDots?: boolean;
}

export interface Slash {
  type: 'start' | 'stop';
  useStems?: boolean;
  useDots?: boolean;
}

// ============================================================================
// BassNotion Conversion Types
// ============================================================================

/**
 * Extracted metadata from MusicXML for creating Exercise
 */
export interface MusicXMLMetadata {
  title?: string;
  composer?: string;
  arranger?: string;
  key?: string;
  timeSignature?: TimeSignature;
  tempo?: number; // BPM
  totalMeasures: number;
  totalDuration: number; // in milliseconds
  instruments: string[];
  bassPartId?: string; // ID of the bass part if found
}

/**
 * Intermediate representation for converting MusicXML notes to ExerciseNote
 */
export interface MusicXMLNoteData {
  // Original MusicXML data
  pitch?: Pitch;
  fret?: number;
  string?: number;
  duration: number; // MusicXML divisions
  type?: NoteType;
  voice?: string;
  staff?: number;
  measure: number;

  // Calculated BassNotion data
  calculatedFret?: number;
  calculatedString?: 1 | 2 | 3 | 4 | 5 | 6;
  calculatedNote?: string;
  position: MusicalPosition;
  bassNoteDuration: NoteDuration;

  // Techniques and articulations
  techniques?: TechniqueType[];
  targetNoteId?: string;

  // Visual properties
  color?: string;
}

/**
 * Configuration for MusicXML to BassNotion conversion
 */
export interface MusicXMLConversionConfig {
  // Bass tuning (default: standard 4-string bass E-A-D-G)
  tuning: readonly BassString[];

  // Fret range limits
  maxFret: number;

  // Default note color
  defaultColor: string;

  // Whether to include tablature information
  includeTablature: boolean;

  // Whether to convert articulations to techniques
  convertArticulations: boolean;

  // Target divisions per quarter note for timing calculations
  targetDivisions: number;
}

export interface BassString {
  stringNumber: 1 | 2 | 3 | 4 | 5 | 6;
  openNote: string; // e.g., "E", "A", "D", "G", "B", "E"
  openPitch: Pitch;
}

/**
 * Result of MusicXML parsing and conversion
 */
export interface MusicXMLConversionResult {
  success: boolean;
  metadata: MusicXMLMetadata;
  notes: ExerciseNote[];
  errors: string[];
  warnings: string[];
}

/**
 * Standard bass tunings for conversion
 */
export const BASS_TUNINGS = {
  STANDARD_4STRING: [
    {
      stringNumber: 1 as const,
      openNote: 'E',
      openPitch: { step: 'E' as const, octave: 1, alter: 0 },
    },
    {
      stringNumber: 2 as const,
      openNote: 'A',
      openPitch: { step: 'A' as const, octave: 1, alter: 0 },
    },
    {
      stringNumber: 3 as const,
      openNote: 'D',
      openPitch: { step: 'D' as const, octave: 2, alter: 0 },
    },
    {
      stringNumber: 4 as const,
      openNote: 'G',
      openPitch: { step: 'G' as const, octave: 2, alter: 0 },
    },
  ],
  STANDARD_5STRING: [
    {
      stringNumber: 1 as const,
      openNote: 'B',
      openPitch: { step: 'B' as const, octave: 0, alter: 0 },
    },
    {
      stringNumber: 2 as const,
      openNote: 'E',
      openPitch: { step: 'E' as const, octave: 1, alter: 0 },
    },
    {
      stringNumber: 3 as const,
      openNote: 'A',
      openPitch: { step: 'A' as const, octave: 1, alter: 0 },
    },
    {
      stringNumber: 4 as const,
      openNote: 'D',
      openPitch: { step: 'D' as const, octave: 2, alter: 0 },
    },
    {
      stringNumber: 5 as const,
      openNote: 'G',
      openPitch: { step: 'G' as const, octave: 2, alter: 0 },
    },
  ],
  STANDARD_6STRING: [
    {
      stringNumber: 1 as const,
      openNote: 'B',
      openPitch: { step: 'B' as const, octave: 0, alter: 0 },
    },
    {
      stringNumber: 2 as const,
      openNote: 'E',
      openPitch: { step: 'E' as const, octave: 1, alter: 0 },
    },
    {
      stringNumber: 3 as const,
      openNote: 'A',
      openPitch: { step: 'A' as const, octave: 1, alter: 0 },
    },
    {
      stringNumber: 4 as const,
      openNote: 'D',
      openPitch: { step: 'D' as const, octave: 2, alter: 0 },
    },
    {
      stringNumber: 5 as const,
      openNote: 'G',
      openPitch: { step: 'G' as const, octave: 2, alter: 0 },
    },
    {
      stringNumber: 6 as const,
      openNote: 'C',
      openPitch: { step: 'C' as const, octave: 3, alter: 0 },
    },
  ],
} as const;

export const DEFAULT_CONVERSION_CONFIG: MusicXMLConversionConfig = {
  tuning: BASS_TUNINGS.STANDARD_4STRING,
  maxFret: 24,
  defaultColor: 'blue',
  includeTablature: true,
  convertArticulations: true,
  targetDivisions: 1024, // High precision for timing
};
