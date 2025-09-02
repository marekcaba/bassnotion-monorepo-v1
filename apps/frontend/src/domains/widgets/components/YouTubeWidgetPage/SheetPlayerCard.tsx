'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Music, RotateCw, Upload, FileText } from 'lucide-react';
import { SyncedWidget } from '../base';
import type { SyncedWidgetRenderProps } from '../base';
import type {
  ExerciseNote,
  NoteDuration,
  Exercise,
} from '@bassnotion/contracts';
import { MusicXMLUpload } from '../shared/MusicXMLUpload';
import { MIDIUpload } from '../shared/MIDIUpload';

// VexFlow imports
import * as VF from 'vexflow';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// VexFlow utility functions
const convertNoteDurationToVexFlow = (
  duration: NoteDuration | undefined,
): string => {
  // Validate and provide default
  if (!duration) {
    return 'q';
  }

  switch (duration) {
    case 'whole':
      return 'w';
    case 'half':
      return 'h';
    case 'quarter':
      return 'q';
    case 'eighth':
      return '8';
    case 'sixteenth':
      return '16';
    case 'thirty-second':
      return '32';
    case 'sixty-fourth':
      return '64';
    case 'dotted-half':
      return 'hd';
    case 'dotted-quarter':
      return 'qd';
    case 'dotted-eighth':
      return '8d';
    case 'dotted-sixteenth':
      return '16d';
    case 'triplet-quarter':
      return 'q';
    case 'triplet-eighth':
      return '8';
    case 'triplet-sixteenth':
      return '16';
    case 'triplet-half':
      return 'h';
    case 'triplet-whole':
      return 'w';
    case 'dotted-whole':
      return 'wd';
    case 'tied':
      return 'q'; // Default to quarter for tied notes
    default:
      return 'q'; // Always return a valid duration
  }
};

const convertNoteToVexFlow = (note: ExerciseNote): string => {
  // Convert note name to VexFlow format (e.g., "A2" -> "a/2", "A#2" -> "a#/2")
  const noteName = note.note;
  const octave = getOctaveFromNote(noteName);

  // Handle sharps and flats
  let vexFlowNote = noteName.replace(/\d+$/, '').toLowerCase();

  // Convert flat notation to sharp for VexFlow
  if (vexFlowNote.includes('b')) {
    vexFlowNote = vexFlowNote.replace('b', 'b');
  }

  return `${vexFlowNote}/${octave}`;
};

const getOctaveFromNote = (noteName: string): number => {
  // Extract octave from note name (e.g., "A2" -> 2)
  const match = noteName.match(/\d+/);
  return match ? parseInt(match[0]) : 2;
};

const getDurationInQuarterNotes = (duration: NoteDuration): number => {
  switch (duration) {
    case 'whole':
      return 4;
    case 'dotted-whole':
      return 6;
    case 'half':
      return 2;
    case 'dotted-half':
      return 3;
    case 'quarter':
      return 1;
    case 'dotted-quarter':
      return 1.5;
    case 'eighth':
      return 0.5;
    case 'dotted-eighth':
      return 0.75;
    case 'sixteenth':
      return 0.25;
    case 'dotted-sixteenth':
      return 0.375;
    case 'thirty-second':
      return 0.125;
    case 'sixty-fourth':
      return 0.0625;
    case 'triplet-whole':
      return 8 / 3; // 2.67
    case 'triplet-half':
      return 4 / 3; // 1.33
    case 'triplet-quarter':
      return 2 / 3; // 0.67
    case 'triplet-eighth':
      return 1 / 3; // 0.33
    case 'triplet-sixteenth':
      return 1 / 6; // 0.17
    default:
      return 1; // Default to quarter
  }
};

const convertDurationToRests = (duration: number): string[] => {
  const rests: string[] = [];
  let remaining = duration;
  const epsilon = 0.001; // Small tolerance for floating point comparisons

  // Break down duration into standard rest values - industry standard approach
  // Start with largest possible rest durations for proper visual representation
  while (remaining > epsilon) {
    if (remaining >= 3.75) {
      rests.push('w');
      remaining -= 4;
    } else if (remaining >= 1.75) {
      rests.push('h');
      remaining -= 2;
    } else if (remaining >= 0.875) {
      rests.push('q');
      remaining -= 1;
    } else if (remaining >= 0.4375) {
      rests.push('8');
      remaining -= 0.5;
    } else if (remaining >= 0.21875) {
      rests.push('16');
      remaining -= 0.25;
    } else if (remaining >= 0.109375) {
      rests.push('32');
      remaining -= 0.125;
    } else {
      // For very small remainders, round to smallest rest
      if (remaining > epsilon) {
        rests.push('32');
      }
      remaining = 0;
    }
  }

  // If no rests were added but duration was requested, add a quarter rest
  if (rests.length === 0 && duration > epsilon) {
    rests.push('q');
  }

  return rests;
};

export function SheetPlayerCard() {
  const { correlationId, logger } = useCorrelation('SheetPlayerCard');
  return (
    <SyncedWidget
      widgetId="sheet-player"
      widgetName="Sheet Music Player"
      syncOptions={{
        subscribeTo: ['PLAYBACK_STATE', 'TEMPO_CHANGE', 'TIMELINE_UPDATE'],
        debugMode: false,
      }}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <SheetPlayerCardContent syncProps={syncProps} />
      )}
    </SyncedWidget>
  );
}

interface SheetPlayerCardContentProps {
  syncProps: SyncedWidgetRenderProps;
}

interface SelectedNote {
  noteIndex: number;
  measureIndex: number;
  note?: ExerciseNote;
  isRest: boolean;
  vexFlowElement?: any;
}

function SheetPlayerCardContent({ syncProps }: SheetPlayerCardContentProps) {
  const [currentPosition, setCurrentPosition] = useState(2);
  const [isLooping, setIsLooping] = useState(true);
  const [tempo, setTempo] = useState(100);
  const [selectedNotes, setSelectedNotes] = useState<SelectedNote[]>([]);

  // Debug: Component mounted
  useEffect(() => {
    logger.error(
      '[SheetPlayer] Component mounted! If you see this, the fix is active.',
    );
    return () => logger.error('[SheetPlayer] Component unmounted!');
  }, []);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFormat, setUploadFormat] = useState<'musicxml' | 'midi'>(
    'musicxml',
  );
  const [importedExercise, setImportedExercise] = useState<Exercise | null>(
    null,
  );
  const [importSource, setImportSource] = useState<'musicxml' | 'midi' | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const savedScrollPosition = useRef<number>(0);
  const lastRenderedPosition = useRef<number>(-1);

  // Get exercise data from sync props or imported exercise
  const activeExercise = importedExercise || syncProps.selectedExercise;
  const exerciseNotes: ExerciseNote[] = activeExercise?.notes || [];
  const exerciseBpm = activeExercise?.bpm || 120;
  const exerciseKey = activeExercise?.key || 'C';
  const exerciseTitle = activeExercise?.title || 'No Exercise Selected';
  const timeSignature = activeExercise?.timeSignature || {
    numerator: 4,
    denominator: 4,
  };
  const isImported = !!importedExercise;

  // Handle MusicXML upload
  const handleMusicXMLUpload = (exercise: Exercise) => {
    setImportedExercise(exercise);
    setImportSource('musicxml');
    setShowUpload(false);
    setCurrentPosition(1);
    setUnifiedPosition(0);
  };

  // Handle MIDI upload
  const handleMIDIUpload = (exercise: Exercise) => {
    setImportedExercise(exercise);
    setImportSource('midi');
    setShowUpload(false);
    setCurrentPosition(1);
    setUnifiedPosition(0);
  };

  const handleUploadError = (error: string) => {
    logger.error('File upload error:', error);
  };

  const handleClearImported = () => {
    setImportedExercise(null);
    setImportSource(null);
    setCurrentPosition(1);
    setUnifiedPosition(0);
    setSelectedNotes([]);
  };

  // Handle note/rest selection and transport seeking
  const handleNoteClick = useCallback(
    (noteInfo: SelectedNote) => {
      logger.info('Note clicked:', noteInfo);

      // Update selected notes
      setSelectedNotes((prev) => {
        const existingIndex = prev.findIndex(
          (n) => n.unifiedIndex === noteInfo.unifiedIndex,
        );

        if (existingIndex >= 0) {
          // Deselect if already selected
          return prev.filter((_, index) => index !== existingIndex);
        } else {
          // Add to selection
          return [...prev, noteInfo];
        }
      });

      // Seek transport to clicked position
      if (noteInfo.unifiedIndex >= 0) {
        setUnifiedPosition(noteInfo.unifiedIndex);

        // Calculate time position for transport
        const beatPosition = noteInfo.unifiedIndex; // Each unified position represents a beat subdivision
        const timeInSeconds = (beatPosition * 60) / tempo / 4; // Convert to seconds based on tempo

        // Get EventBus and emit seek event
        const coreServices =
          (window as any).__coreServices ||
          (window as any).__globalCoreServices;
        if (coreServices && coreServices.getEventBus) {
          const eventBus = coreServices.getEventBus();
          if (eventBus) {
            // Calculate musical position
            const bar = Math.floor(beatPosition / 16);
            const beat = Math.floor((beatPosition % 16) / 4);
            const sixteenth = beatPosition % 4;

            const musicalPosition = {
              bars: bar,
              beats: beat,
              sixteenths: sixteenth,
              ticks: 0,
            };

            // Emit seek event that UnifiedTransport will handle
            eventBus.emit('transport:seek', {
              position: musicalPosition,
            });
          }
        }
      }
    },
    [tempo],
  );

  // Check if a note/rest is selected by unified index
  const isNoteSelected = (unifiedIndex: number): boolean => {
    return selectedNotes.some((n) => n.unifiedIndex === unifiedIndex);
  };

  // Sync with global playback state for timeline position
  useEffect(() => {
    // Only update position when actually playing
    if (!syncProps.isPlaying) return;

    const globalCurrentTime = syncProps.currentTime;
    if (globalCurrentTime >= 0 && exerciseNotes.length > 0) {
      // Convert time to sheet music position (simplified mapping)
      const maxPosition = exerciseNotes.length;
      const newPosition =
        Math.floor((globalCurrentTime % (maxPosition * 1000)) / 1000) + 1;
      if (newPosition !== currentPosition && newPosition <= maxPosition) {
        setCurrentPosition(newPosition);
      }
    }
  }, [
    syncProps.currentTime,
    currentPosition,
    exerciseNotes.length,
    syncProps.isPlaying,
  ]);

  // Sync tempo with global state and exercise BPM
  useEffect(() => {
    const globalTempo = syncProps.tempo || exerciseBpm;
    if (globalTempo && globalTempo !== tempo) {
      setTempo(globalTempo);
    }
  }, [syncProps.tempo, exerciseBpm, tempo]);

  // Emit timeline events when position changes
  useEffect(() => {
    if (syncProps.isPlaying) {
      // Emit timeline update for synchronization
      syncProps.sync.actions.emitEvent(
        'TIMELINE_UPDATE',
        { currentTime: (currentPosition - 1) * 1000 },
        'high',
      );
    }
  }, [currentPosition, syncProps.isPlaying, syncProps.sync.actions]);

  // VexFlow rendering effect - Industry best practices approach
  useEffect(() => {
    if (!containerRef.current || exerciseNotes.length === 0) return;

    logger.warn('[SheetPlayer] VexFlow render triggered:', {
      isPlaying: syncProps.isPlaying,
      currentPosition,
      lastRenderedPosition: lastRenderedPosition.current,
      savedScrollPosition: savedScrollPosition.current,
      timestamp: Date.now(),
    });

    // Skip re-rendering if paused and position hasn't changed
    if (
      !syncProps.isPlaying &&
      lastRenderedPosition.current === currentPosition
    ) {
      logger.warn(
        '[SheetPlayer] Skipping re-render - position unchanged while paused',
      );
      return;
    }

    // Save current scroll position before clearing (only when paused)
    if (scrollContainerRef.current && !syncProps.isPlaying) {
      savedScrollPosition.current = scrollContainerRef.current.scrollLeft;
      logger.warn(
        '[SheetPlayer] Saved scroll position before render:',
        savedScrollPosition.current,
      );
    }

    // Update last rendered position
    lastRenderedPosition.current = currentPosition;

    // Clear previous rendering
    containerRef.current.innerHTML = '';

    // Debug: Log the actual note durations and beat calculations
    logger.info(
      'Exercise Notes with durations:',
      exerciseNotes.map((note, idx) => ({
        index: idx,
        note: note.note,
        duration: note.duration,
        durationInBeats: getDurationInQuarterNotes(note.duration || 'quarter'),
        vexFlowDuration: convertNoteDurationToVexFlow(
          note.duration || 'quarter',
        ),
        position: note.position,
        fret: note.fret,
        string: note.string,
      })),
    );

    logger.info(
      'Time signature:',
      timeSignature,
      'Beats per measure:',
      beatsPerMeasure,
    );

    try {
      // Industry best practice: Build data model first, then render
      const processedNotes = processNotesForDisplay(
        exerciseNotes,
        timeSignature,
        beatsPerMeasure,
      );
      renderSimpleNotation(
        processedNotes,
        containerRef.current,
        timeSignature,
        beatsPerMeasure,
        exerciseNotes,
        isNoteSelected,
        handleNoteClick,
        currentPosition,
        selectedNotes,
      );

      // Restore scroll position after rendering if not playing
      if (
        !syncProps.isPlaying &&
        scrollContainerRef.current &&
        savedScrollPosition.current > 0
      ) {
        logger.warn(
          '[SheetPlayer] Attempting to restore scroll position:',
          savedScrollPosition.current,
        );
        // Use requestAnimationFrame to ensure DOM is updated before restoring scroll
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            const beforeScroll = scrollContainerRef.current.scrollLeft;
            scrollContainerRef.current.scrollLeft = savedScrollPosition.current;
            logger.warn('[SheetPlayer] Restored scroll position:', {
              before: beforeScroll,
              after: scrollContainerRef.current.scrollLeft,
              saved: savedScrollPosition.current,
            });
          }
        });
      }
    } catch (error) {
      logger.error('VexFlow rendering error:', error);
    }
  }, [exerciseNotes, timeSignature, currentPosition, syncProps.isPlaying]);

  // Calculate beats per measure for processing
  const beatsPerMeasure = timeSignature.numerator;

  // Industry standard: Separate data processing from rendering - Proper MIDI timing approach
  const processNotesForDisplay = (
    notes: ExerciseNote[],
    timeSignature: any,
    beatsPerMeasure: number,
  ) => {
    // Quantize and validate notes first (industry best practice)
    const validatedNotes = notes.filter((note) => {
      if (!note || !note.note) return false;

      // Ensure we have a valid duration
      const duration = note.duration || 'quarter';
      const vexFlowDuration = convertNoteDurationToVexFlow(duration);
      return vexFlowDuration && vexFlowDuration !== '';
    });

    // Group notes into measures using actual MIDI measure positions
    const measureMap = new Map<number, ExerciseNote[]>();

    // Group notes by their actual measure position from MIDI data
    for (const note of validatedNotes) {
      const measureNumber = note.position?.measure || 1;

      if (!measureMap.has(measureNumber)) {
        measureMap.set(measureNumber, []);
      }
      measureMap.get(measureNumber)!.push(note);
    }

    // Convert to array and ensure measures are in order
    const measures = [];
    const measureNumbers = Array.from(measureMap.keys()).sort((a, b) => a - b);

    logger.info('Found measures:', measureNumbers);
    logger.info('Measure map:', Array.from(measureMap.entries()));

    for (const measureNumber of measureNumbers) {
      const measureNotes = measureMap.get(measureNumber) || [];
      // Sort notes within each measure by beat position
      measureNotes.sort((a, b) => {
        const beatA = a.position?.beat || 1;
        const beatB = b.position?.beat || 1;
        const subdivA = a.position?.subdivision || 0;
        const subdivB = b.position?.subdivision || 0;

        if (beatA !== beatB) return beatA - beatB;
        return subdivA - subdivB;
      });

      measures.push(measureNotes);
    }

    // Ensure we have at least one measure
    if (measures.length === 0) {
      measures.push([]);
    }

    logger.info(
      'Final measures array:',
      measures.map((measure, idx) => ({
        measureIndex: idx,
        noteCount: measure.length,
        notes: measure.map((note) => ({
          note: note.note,
          measure: note.position?.measure,
          beat: note.position?.beat,
          subdivision: note.position?.subdivision,
          duration: note.duration,
        })),
      })),
    );

    return measures;
  };

  // Industry standard: Simple, robust rendering with continuous staff
  const renderSimpleNotation = (
    measures: ExerciseNote[][],
    container: HTMLDivElement,
    timeSignature: any,
    beatsPerMeasure: number,
    exerciseNotes: ExerciseNote[],
    isNoteSelected: (noteIndex: number, measureIndex: number) => boolean,
    handleNoteClick: (noteInfo: SelectedNote) => void,
  ) => {
    try {
      // Get actual parent container width dynamically
      const containerWidth = container.parentElement?.clientWidth || 600;

      // Use EXACT same dimensions as working FretboardCard
      const svgHeight = 120; // Optimal height for staff display (from FretboardCard)
      const baseMeasureWidth = 180; // Base width for regular measures
      const firstMeasureWidth = 220; // Wider first measure for clef + time signature
      const totalStaffWidth =
        firstMeasureWidth + baseMeasureWidth * (measures.length - 1);
      const svgWidth = Math.max(containerWidth, totalStaffWidth + 40); // Ensure scrollability

      // Create renderer following VexFlow best practices
      const renderer = new VF.Renderer(container, VF.Renderer.Backends.SVG);
      renderer.resize(svgWidth, svgHeight);
      const context = renderer.getContext();
      context.setFont('Arial', 10);

      // Store reference to SVG element for click handling
      const svgElement = renderer.ctx.svg as SVGElement;

      // Use EXACT same approach as working FretboardCard
      const rowY = 0; // No top padding (from FretboardCard)
      const rowStartX = Math.max(20, (svgWidth - totalStaffWidth) / 2); // Center horizontally

      // Create staves for all measures in a single row with proper widths
      const staves = [];
      const measureWidths = [];
      let currentX = rowStartX;

      for (
        let measureIndex = 0;
        measureIndex < measures.length;
        measureIndex++
      ) {
        // First measure is wider to accommodate clef and time signature
        const currentMeasureWidth =
          measureIndex === 0 ? firstMeasureWidth : baseMeasureWidth;
        measureWidths.push(currentMeasureWidth);

        const stave = new VF.Stave(currentX, rowY, currentMeasureWidth);

        // Add bass clef and time signature to first measure only
        if (measureIndex === 0) {
          stave.addClef('bass');
          stave.addTimeSignature(
            `${timeSignature.numerator}/${timeSignature.denominator}`,
          );
        }

        stave.setContext(context).draw();
        staves.push(stave);
        currentX += currentMeasureWidth;
      }

      // Convert notes to VexFlow format - EXACT same approach as FretboardCard
      const vexFlowMeasures = [];
      for (let i = 0; i < measures.length; i++) {
        const measureNotes = measures[i];

        // Create a timeline-based approach for proper rhythm placement
        const timeline: Array<{
          type: 'note';
          startBeat: number;
          endBeat: number;
          note: ExerciseNote;
          duration: number;
        }> = [];

        // Add all notes to timeline with their exact beat positions
        measureNotes?.forEach((note) => {
          const beatPosition =
            (note.position?.beat || 1) -
            1 +
            (note.position?.subdivision || 0) / 16;
          const noteDuration = getDurationInQuarterNotes(
            note.duration || 'quarter',
          );

          timeline.push({
            type: 'note',
            startBeat: beatPosition,
            endBeat: beatPosition + noteDuration,
            note: note,
            duration: noteDuration,
          });
        });

        // Sort timeline by start position
        timeline.sort((a, b) => a.startBeat - b.startBeat);

        // Fill gaps with rests to create complete rhythm
        const completeTimeline: Array<{
          type: 'note' | 'rest';
          startBeat: number;
          endBeat: number;
          note?: ExerciseNote;
          duration: number | string;
        }> = [];
        let currentBeat = 0;

        for (const item of timeline) {
          // Add rest if there's a gap before this note
          if (item.startBeat > currentBeat + 0.001) {
            const restDuration = item.startBeat - currentBeat;
            const restDurations = convertDurationToRests(restDuration);

            restDurations.forEach((restDur) => {
              completeTimeline.push({
                type: 'rest',
                duration: restDur,
                startBeat: currentBeat,
                endBeat: currentBeat,
              });
              // Update currentBeat based on rest duration
              const restBeats =
                restDur === 'w'
                  ? 4
                  : restDur === 'h'
                    ? 2
                    : restDur === 'q'
                      ? 1
                      : restDur === '8'
                        ? 0.5
                        : restDur === '16'
                          ? 0.25
                          : restDur === '32'
                            ? 0.125
                            : 1;
              currentBeat += restBeats;
            });
          }

          // Add the note
          completeTimeline.push(item);
          currentBeat = Math.max(currentBeat, item.endBeat);
        }

        // Add final rest to complete the measure if needed
        if (currentBeat < beatsPerMeasure - 0.001) {
          const finalRestDuration = beatsPerMeasure - currentBeat;
          const restDurations = convertDurationToRests(finalRestDuration);

          restDurations.forEach((restDur) => {
            completeTimeline.push({
              type: 'rest',
              duration: restDur,
              startBeat: currentBeat,
              endBeat: currentBeat,
            });
          });
        }

        // Convert timeline to VexFlow notes with unified position tracking
        let globalUnifiedIndex = 0; // Track position across all measures
        for (let prevMeasure = 0; prevMeasure < i; prevMeasure++) {
          globalUnifiedIndex += vexFlowMeasures[prevMeasure]?.length || 0;
        }

        const vexFlowNotes = completeTimeline.map((item, itemIndex) => {
          const currentUnifiedIndex = globalUnifiedIndex + itemIndex;

          if (item.type === 'note' && item.note) {
            const noteKey = convertNoteToVexFlow(item.note);
            const duration = convertNoteDurationToVexFlow(
              item.note.duration || 'quarter',
            );

            const staveNote = new VF.StaveNote({
              clef: 'bass',
              keys: [noteKey],
              duration: duration,
            });

            // Add current note highlighting based on unified position
            if (currentUnifiedIndex + 1 === currentPosition) {
              staveNote.setStyle({
                fillStyle: '#3b82f6',
                strokeStyle: '#3b82f6',
              });
            }

            // Add selection highlighting
            const noteIndex = exerciseNotes.indexOf(item.note);
            if (isNoteSelected(currentUnifiedIndex)) {
              staveNote.setStyle({
                fillStyle: '#10b981',
                strokeStyle: '#10b981',
              });
            }

            // Store metadata for click handling
            staveNote.setAttribute('data-note-index', noteIndex.toString());
            staveNote.setAttribute('data-measure-index', i.toString());
            staveNote.setAttribute('data-is-rest', 'false');
            staveNote.setAttribute(
              'data-unified-index',
              currentUnifiedIndex.toString(),
            );

            return staveNote;
          } else {
            // Create rest
            const staveRest = new VF.StaveNote({
              clef: 'bass',
              keys: ['d/3'],
              duration: item.duration + 'r',
            });

            // Add selection highlighting for rests
            if (isNoteSelected(currentUnifiedIndex)) {
              staveRest.setStyle({
                fillStyle: '#10b981',
                strokeStyle: '#10b981',
              });
            }

            // Store metadata for click handling
            staveRest.setAttribute('data-note-index', '-1');
            staveRest.setAttribute('data-measure-index', i.toString());
            staveRest.setAttribute('data-is-rest', 'true');
            staveRest.setAttribute(
              'data-unified-index',
              currentUnifiedIndex.toString(),
            );

            return staveRest;
          }
        });

        logger.info(
          `Measure ${i} timeline:`,
          completeTimeline.map((item) => ({
            type: item.type,
            startBeat: item.startBeat,
            duration:
              item.type === 'note' ? item.note?.duration : item.duration,
            note: item.type === 'note' ? item.note?.note : 'REST',
          })),
        );

        vexFlowMeasures.push(vexFlowNotes);
      }

      // Create voices for all measures - EXACT same approach as FretboardCard
      const voices = [];
      for (
        let measureIndex = 0;
        measureIndex < vexFlowMeasures.length;
        measureIndex++
      ) {
        if (measureIndex < vexFlowMeasures.length) {
          const voice = new VF.Voice({
            num_beats: beatsPerMeasure,
            beat_value: timeSignature.denominator,
          });

          // Use SOFT mode to handle incomplete measures
          voice.setMode(VF.Voice.Mode.SOFT);

          const measureNotes = vexFlowMeasures[measureIndex];
          if (measureNotes && measureNotes.length > 0) {
            voice.addTickables(measureNotes);
            voices.push(voice);
          }
        }
      }

      // Format each voice individually - EXACT same approach as FretboardCard
      if (voices.length > 0) {
        for (let i = 0; i < voices.length; i++) {
          const voice = voices[i];
          if (!voice) continue;

          // Create formatter with professional spacing settings
          const formatter = new VF.Formatter({ softmaxFactor: 5 });
          formatter.joinVoices([voice]);

          // Calculate available width for notes (account for clef/time signature in first measure)
          const measureWidth = measureWidths[i] || 0;
          const availableWidth =
            i === 0
              ? measureWidth - 80 // First measure: subtract space for clef + time signature
              : measureWidth - 20; // Other measures: just padding

          // Use industry-standard proportional spacing
          formatter.format([voice], availableWidth);
          const stave = staves[i];
          if (stave) {
            voice.draw(context, stave);
          }
        }

        // Add click handlers to rendered notes (moved into rendering phase)
        setTimeout(() => {
          const noteElements = svgElement.querySelectorAll(
            '[data-unified-index]',
          );
          noteElements.forEach((element) => {
            const svgEl = element as SVGElement;
            svgEl.style.cursor = 'pointer';

            svgEl.addEventListener('click', (event: Event) => {
              event.stopPropagation();

              const unifiedIndex = parseInt(
                svgEl.getAttribute('data-unified-index') || '-1',
              );
              const noteIndex = parseInt(
                svgEl.getAttribute('data-note-index') || '-1',
              );
              const measureIndex = parseInt(
                svgEl.getAttribute('data-measure-index') || '0',
              );
              const isRest = svgEl.getAttribute('data-is-rest') === 'true';

              if (unifiedIndex >= 0) {
                const noteInfo: SelectedNote = {
                  noteIndex,
                  measureIndex,
                  note:
                    isRest || noteIndex < 0
                      ? undefined
                      : exerciseNotes[noteIndex],
                  isRest,
                  unifiedIndex,
                };

                handleNoteClick(noteInfo);
              }
            });
          });
        }, 100); // Small delay to ensure DOM is ready
      }

      // SVG element is now handled in the rendering phase above
    } catch (error) {
      logger.error('Failed to render notation:', error);

      // Ultimate fallback: display error message
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: #666;">Unable to display sheet music</div>`;
    }
  };

  return (
    <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                isImported ? 'bg-green-500' : 'bg-blue-500'
              }`}
            >
              {isImported ? (
                <FileText className="w-5 h-5 text-white" />
              ) : (
                <Music className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">
                {isImported ? '📝' : '🎼'} {exerciseTitle}
              </CardTitle>
              <p className="text-slate-400">
                Key: {exerciseKey} • {exerciseNotes.length} notes
                {isImported && (
                  <span className="ml-2 text-green-400">
                    • Imported from{' '}
                    {importSource === 'midi' ? 'MIDI' : 'MusicXML'}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* MusicXML Upload Controls */}
            <div className="flex items-center gap-2 mr-4">
              <Button
                size="sm"
                variant="ghost"
                className="text-slate-300 hover:text-white"
                onClick={() => setShowUpload(!showUpload)}
              >
                <Upload className="w-4 h-4 mr-1" />
                Import
              </Button>
              {isImported && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-slate-300 hover:text-red-400"
                  onClick={handleClearImported}
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Playback Controls */}
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <Music className="w-4 h-4" />
              <span>♩ = {tempo}</span>
              <Button
                size="sm"
                variant="ghost"
                className={`text-slate-300 hover:text-white ${isLooping ? 'text-blue-400' : ''}`}
                onClick={() => setIsLooping(!isLooping)}
              >
                <RotateCw className="w-4 h-4" />
              </Button>
              <span className="text-xs">Loop</span>
            </div>
          </div>
        </div>

        {/* Selected Notes Display */}
        {selectedNotes.length > 0 && (
          <div className="mt-2 text-sm text-slate-300">
            <span className="text-green-400">Selected:</span>{' '}
            {selectedNotes.map((sel, idx) => (
              <span key={idx} className="mr-2">
                {sel.isRest ? '🎵 Rest' : `🎵 ${sel.note?.note || 'Note'}`}
                {idx < selectedNotes.length - 1 && ', '}
              </span>
            ))}
            <Button
              size="sm"
              variant="ghost"
              className="ml-2 text-xs text-slate-400 hover:text-slate-200"
              onClick={() => setSelectedNotes([])}
            >
              Clear
            </Button>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 bg-white rounded-lg">
        {/* File Upload Interface */}
        {showUpload && (
          <div className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                Import Sheet Music
              </h3>

              {/* Format Selection Tabs */}
              <div className="flex space-x-1 bg-gray-100 rounded-lg p-1 mb-4">
                <button
                  onClick={() => setUploadFormat('musicxml')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    uploadFormat === 'musicxml'
                      ? 'bg-white text-gray-900 shadow'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  MusicXML
                </button>
                <button
                  onClick={() => setUploadFormat('midi')}
                  className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                    uploadFormat === 'midi'
                      ? 'bg-white text-gray-900 shadow'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  MIDI
                </button>
              </div>
            </div>

            {/* Upload Components */}
            {uploadFormat === 'musicxml' ? (
              <MusicXMLUpload
                onFileUploaded={handleMusicXMLUpload}
                onError={handleUploadError}
                className="max-w-lg"
              />
            ) : (
              <MIDIUpload
                onFileUploaded={handleMIDIUpload}
                onError={handleUploadError}
                className="max-w-lg"
              />
            )}
          </div>
        )}

        {/* VexFlow Sheet Music - EXACT same styling as FretboardCard */}
        {exerciseNotes.length > 0 ? (
          <div
            ref={(el) => {
              scrollContainerRef.current = el;

              // Add MutationObserver to detect unexpected scroll changes
              if (el && !syncProps.isPlaying) {
                const observer = new MutationObserver(() => {
                  if (el.scrollLeft === 0 && savedScrollPosition.current > 0) {
                    logger.error(
                      '[SheetPlayer] SCROLL RESET DETECTED! Stack:',
                      new Error().stack,
                    );
                  }
                });
                observer.observe(el, {
                  attributes: true,
                  childList: true,
                  subtree: true,
                });

                // Clean up observer after 10 seconds
                setTimeout(() => observer.disconnect(), 10000);
              }
            }}
            className="w-full overflow-x-auto scrollbar-hide"
            style={{ maxHeight: '250px' }}
            onScroll={(e) => {
              // Save scroll position when user scrolls manually
              const scrollLeft = e.currentTarget.scrollLeft;
              savedScrollPosition.current = scrollLeft;

              // Debug logging
              logger.warn('[SheetPlayer] Manual scroll detected:', {
                scrollLeft,
                isPlaying: syncProps.isPlaying,
                currentPosition,
                timestamp: Date.now(),
              });
            }}
          >
            <div
              ref={containerRef}
              className="min-w-full"
              style={{ minHeight: '120px' }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 flex-col gap-4">
            <span className="text-slate-500 text-sm">No exercise selected</span>
            {!showUpload && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowUpload(true)}
                className="text-slate-600 hover:text-slate-800"
              >
                <Upload className="w-4 h-4 mr-2" />
                Import Music
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
