import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  Volume2,
  Heart,
  SkipBack,
  SkipForward,
  Star,
  Music,
  RotateCw,
  Upload,
  FileText,
} from 'lucide-react';
import { TempoKnob } from './TempoKnob';
import { LooperKnob } from './LooperKnob';
import { LoopGridStrip } from './LoopGridStrip';
import { SheetPlayerToolbar } from './SheetPlayerToolbar';
import type { LoopRegion } from './LoopGridStrip';
import type {
  MusicalExercise as Exercise,
  ExerciseNote,
  NoteDuration,
} from '@bassnotion/contracts';
import { MIDIFileParser } from '@bassnotion/contracts';
import { Button } from '@/shared/components/ui/button';

// VexFlow imports for sheet music
import * as VF from 'vexflow';

// VexFlow utility functions for sheet music
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

interface GlobalControlsProps {
  isPlaying: boolean;
  currentTime: number;
  tempo: number;
  masterVolume: number;
  syncEnabled: boolean;
  selectedExercise?: Exercise;
  duration: number;
  isLoopEnabled?: boolean;
  loopRegion?: LoopRegion | null;
  onTogglePlayback: () => void;
  onCurrentTimeChange: (time: number) => void;
  onTempoChange: (tempo: number) => void;
  onVolumeChange: (volume: number) => void;
  onLoopRegionChange?: (region: LoopRegion | null) => void;
  onToggleLoop?: () => void;
}

export const GlobalControls: React.FC<GlobalControlsProps> = ({
  isPlaying,
  currentTime,
  tempo,
  masterVolume,
  syncEnabled,
  selectedExercise,
  duration,
  isLoopEnabled = false,
  loopRegion,
  onTogglePlayback,
  onCurrentTimeChange,
  onTempoChange,
  onVolumeChange,
  onLoopRegionChange,
  onToggleLoop,
}) => {
  // Sheet music state
  const [currentPosition, setCurrentPosition] = useState(2);
  const [isLooping, setIsLooping] = useState(true);
  const [importedExercise, setImportedExercise] = useState<Exercise | null>(
    null,
  );
  const [importSource, setImportSource] = useState<'musicxml' | 'midi' | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get exercise data from imported exercise or selected exercise
  const activeExercise = importedExercise || selectedExercise;
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
    setCurrentPosition(1);
  };

  // Handle MIDI upload
  const handleMIDIUpload = (exercise: Exercise) => {
    setImportedExercise(exercise);
    setImportSource('midi');
    setCurrentPosition(1);
  };

  const handleUploadError = (error: string) => {
    console.error('File upload error:', error);
  };

  const handleClearImported = () => {
    setImportedExercise(null);
    setImportSource(null);
    setCurrentPosition(2);
  };

  // Handle file input change
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();

    if (fileExtension === 'xml' || fileExtension === 'musicxml') {
      // Process MusicXML file
      try {
        const text = await file.text();
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, 'text/xml');

        // Create a mock exercise from the MusicXML (simplified version)
        const exercise: Exercise = {
          id: `imported-${Date.now()}`,
          title: file.name.replace(/\.(xml|musicxml)$/i, ''),
          notes: [], // This would need proper MusicXML parsing
          bpm: 120,
          timeSignature: { numerator: 4, denominator: 4 },
          key: 'C',
          difficulty: 'intermediate',
          duration: 0,
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        handleMusicXMLUpload(exercise);
      } catch (error) {
        handleUploadError('Failed to parse MusicXML file');
      }
    } else if (fileExtension === 'mid' || fileExtension === 'midi') {
      // Process MIDI file using the actual MIDI parser
      try {
        const arrayBuffer = await file.arrayBuffer();
        const parser = new MIDIFileParser();

        const parsingResult = await parser.parseFile(arrayBuffer, file.name);

        if (!parsingResult.success) {
          throw new Error(
            `MIDI parsing failed: ${parsingResult.errors.join(', ')}`,
          );
        }

        if (!parsingResult.exercise) {
          throw new Error(
            'No bass track found in MIDI file. Try a MIDI file with bass content.',
          );
        }

        handleMIDIUpload(parsingResult.exercise);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to parse MIDI file';
        handleUploadError(errorMessage);
      }
    } else {
      handleUploadError(`Unsupported file format: ${fileExtension}`);
    }

    // Clear the input value so the same file can be selected again
    event.target.value = '';
  };

  // Sync with global playback state for timeline position
  useEffect(() => {
    const globalCurrentTime = currentTime;
    if (globalCurrentTime >= 0 && exerciseNotes.length > 0) {
      // Convert time to sheet music position (simplified mapping)
      const maxPosition = exerciseNotes.length;
      const newPosition =
        Math.floor((globalCurrentTime % (maxPosition * 1000)) / 1000) + 1;
      if (newPosition !== currentPosition && newPosition <= maxPosition) {
        setCurrentPosition(newPosition);
      }
    }
  }, [currentTime, currentPosition, exerciseNotes.length]);

  // Sync tempo with global state and exercise BPM
  useEffect(() => {
    const globalTempo = tempo || exerciseBpm;
    if (globalTempo && globalTempo !== tempo) {
      // Update local tempo state if needed
    }
  }, [tempo, exerciseBpm]);

  // Calculate beats per measure for processing
  const beatsPerMeasure = timeSignature.numerator;

  // VexFlow rendering effect - Industry best practices approach
  useEffect(() => {
    if (!containerRef.current || exerciseNotes.length === 0) return;

    // Clear previous rendering
    containerRef.current.innerHTML = '';

    try {
      // Industry best practice: Build data model first, then render
      const processedNotes = processNotesForDisplay(
        exerciseNotes,
        timeSignature,
        beatsPerMeasure,
      );
      renderSimpleNotation(processedNotes, containerRef.current, timeSignature);
    } catch (error) {
      console.error('VexFlow rendering error:', error);
    }
  }, [exerciseNotes, timeSignature, currentPosition]);

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

    return measures;
  };

  // Industry standard: Simple, robust rendering with continuous staff
  const renderSimpleNotation = (
    measures: ExerciseNote[][],
    container: HTMLDivElement,
    timeSignature: any,
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

      // Set black colors for notes and staff
      context.setFillStyle('#000000'); // Black for notes
      context.setStrokeStyle('#000000'); // Black for lines

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

        // Set black colors for the stave
        stave.setContext(context);
        context.setFillStyle('#000000');
        context.setStrokeStyle('#000000');
        stave.draw();
        staves.push(stave);
        currentX += currentMeasureWidth;
      }

      // Convert notes to VexFlow format - EXACT same approach as FretboardCard
      const vexFlowMeasures = [];
      for (let i = 0; i < measures.length; i++) {
        const measureNotes = measures[i];

        // Add null safety check for measureNotes
        if (!measureNotes) {
          vexFlowMeasures.push([]);
          continue;
        }

        // Define timeline item type for proper TypeScript support
        interface TimelineItem {
          type: 'note' | 'rest';
          startBeat: number;
          endBeat?: number;
          note?: ExerciseNote;
          duration: number | string;
        }

        // Create a timeline-based approach for proper rhythm placement
        const timeline: TimelineItem[] = [];

        // Add all notes to timeline with their exact beat positions
        measureNotes.forEach((note) => {
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
        const completeTimeline: TimelineItem[] = [];
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
          currentBeat = Math.max(currentBeat, item.endBeat || item.startBeat);
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
            });
          });
        }

        // Convert timeline to VexFlow notes
        const vexFlowNotes = completeTimeline.map((item) => {
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

            // Add current note highlighting or default black color
            if (exerciseNotes.indexOf(item.note) + 1 === currentPosition) {
              staveNote.setStyle({
                fillStyle: '#3b82f6',
                strokeStyle: '#3b82f6',
              });
            } else {
              staveNote.setStyle({
                fillStyle: '#000000',
                strokeStyle: '#000000',
              });
            }

            return staveNote;
          } else {
            // Create rest
            const restNote = new VF.StaveNote({
              clef: 'bass',
              keys: ['d/3'],
              duration: item.duration + 'r',
            });

            restNote.setStyle({
              fillStyle: '#000000',
              strokeStyle: '#000000',
            });

            return restNote;
          }
        });

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
      }
    } catch (error) {
      console.error('Failed to render notation:', error);

      // Ultimate fallback: display error message
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: #666;">Unable to display sheet music</div>`;
    }
  };

  // Determine if loop is actually enabled based on loopRegion
  const isLoopActive = loopRegion !== null;

  // Looper knob state - track selected bars
  const [selectedLooperBars, setSelectedLooperBars] = React.useState<
    number | null
  >(null);

  // Sheet Player Toolbar Handlers
  const handleToolbarImport = () => {
    fileInputRef.current?.click();
  };

  const handleToolbarSave = async () => {
    if (!activeExercise) return;

    try {
      // TODO: Implement save to backend/library functionality
      console.log('Saving exercise:', activeExercise.title);
      // This would call an API to save the exercise to the database
      alert(
        'Save functionality will be implemented - exercise would be saved to library',
      );
    } catch (error) {
      console.error('Error saving exercise:', error);
      alert('Failed to save exercise');
    }
  };

  const handleToolbarExportPDF = () => {
    if (!containerRef.current || !activeExercise) return;

    try {
      // Get the SVG element from VexFlow
      const svgElement = containerRef.current.querySelector('svg');
      if (!svgElement) {
        alert('No sheet music to export');
        return;
      }

      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Please allow popups for PDF export');
        return;
      }

      // Create a print-friendly HTML document
      const svgData = new XMLSerializer().serializeToString(svgElement);
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>${activeExercise.title} - Sheet Music</title>
            <style>
              body { margin: 0; padding: 20px; background: white; }
              .header { text-align: center; margin-bottom: 20px; }
              .sheet-music { text-align: center; }
              svg { max-width: 100%; height: auto; }
              @media print {
                body { margin: 0; }
                .header { margin-bottom: 10px; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>${activeExercise.title}</h1>
              <p>Tempo: ${activeExercise.bpm} BPM | Key: ${activeExercise.key} | Time: ${activeExercise.timeSignature?.numerator}/${activeExercise.timeSignature?.denominator}</p>
            </div>
            <div class="sheet-music">
              ${svgData}
            </div>
          </body>
        </html>
      `;

      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Trigger print dialog
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
      }, 250);
    } catch (error) {
      console.error('Error exporting PDF:', error);
      alert('Failed to export PDF');
    }
  };

  const handleToolbarReset = () => {
    setImportedExercise(null);
    setImportSource(null);
    setCurrentPosition(2);
  };

  // Looper knob handler
  const handleLooperBarSelect = (bars: number | null) => {
    setSelectedLooperBars(bars);

    if (bars === null) {
      // Turn off looper
      if (onLoopRegionChange) {
        onLoopRegionChange(null);
      }
    } else {
      // Set loop region for selected number of bars
      if (onLoopRegionChange) {
        onLoopRegionChange({
          startMeasure: 1,
          endMeasure: bars,
          startBeat: 1,
          endBeat: selectedExercise?.timeSignature?.numerator || 4,
        });
      }
    }

    // Call the toggle function if provided
    if (onToggleLoop) {
      onToggleLoop();
    }
  };

  // Handle loop toggle - set 1 bar loop when enabled
  const handleLoopToggle = () => {
    if (!isLoopActive) {
      // Enable loop with 1 bar selected
      if (onLoopRegionChange) {
        onLoopRegionChange({
          startMeasure: 1,
          endMeasure: 1,
          startBeat: 1,
          endBeat: selectedExercise?.timeSignature?.numerator || 4,
        });
      }
    } else {
      // Disable loop
      if (onLoopRegionChange) {
        onLoopRegionChange(null);
      }
    }

    // Always call the toggle function if provided
    if (onToggleLoop) {
      onToggleLoop();
    }
  };

  // Handle preset buttons
  const handlePresetClick = (bars: number) => {
    if (onLoopRegionChange) {
      onLoopRegionChange({
        startMeasure: 1,
        endMeasure: bars,
        startBeat: 1,
        endBeat: selectedExercise?.timeSignature?.numerator || 4,
      });
    }
  };

  return (
    <>
      <style jsx>{`
        .slider-thumb {
          --webkit-appearance: none;
          appearance: none;
        }
        .slider-thumb::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 12px;
          height: 12px;
          background: #475569;
          border-radius: 50%;
          cursor: pointer;
          box-shadow:
            2px 2px 4px rgba(0, 0, 0, 0.5),
            -2px -2px 4px rgba(255, 255, 255, 0.1);
          transition: all 0.15s ease;
        }
        .slider-thumb::-webkit-slider-thumb:hover {
          transform: scale(1.1);
          box-shadow:
            inset 1px 1px 2px rgba(0, 0, 0, 0.5),
            inset -1px -1px 2px rgba(255, 255, 255, 0.1);
        }
        .slider-thumb::-moz-range-thumb {
          width: 12px;
          height: 12px;
          background: #475569;
          border-radius: 50%;
          cursor: pointer;
          border: none;
          box-shadow:
            2px 2px 4px rgba(0, 0, 0, 0.5),
            -2px -2px 4px rgba(255, 255, 255, 0.1);
          transition: all 0.15s ease;
        }
        .slider-thumb::-moz-range-thumb:hover {
          transform: scale(1.1);
          box-shadow:
            inset 1px 1px 2px rgba(0, 0, 0, 0.5),
            inset -1px -1px 2px rgba(255, 255, 255, 0.1);
        }
      `}</style>

      {/* Global Controls - Neumorphic style matching subwidgets */}
      <div className="bg-slate-800 rounded-2xl p-4 shadow-[inset_2px_2px_5px_rgba(0,0,0,0.5),inset_-2px_-2px_5px_rgba(255,255,255,0.1)]">
        {/* Compact Player Layout */}
        <div className="flex items-center gap-4">
          {/* Left Side - Tempo Knob */}
          <div className="flex justify-center items-center min-w-[5rem] py-2">
            <TempoKnob
              value={tempo}
              onChange={onTempoChange}
              min={60}
              max={200}
              size={50}
            />
          </div>

          {/* Center - Controls */}
          <div className="flex-1 flex flex-col gap-2">
            {/* Control Buttons Row */}
            <div className="flex items-center justify-center gap-4">
              <button className="p-2 rounded-full bg-slate-800 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200">
                <Heart className="w-4 h-4 text-slate-400" />
              </button>
              <button className="p-2 rounded-full bg-slate-800 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200">
                <SkipBack className="w-4 h-4 text-slate-300" />
              </button>
              <button
                onClick={onTogglePlayback}
                className="rounded-full bg-blue-500 shadow-[4px_4px_8px_rgba(0,0,0,0.5),-4px_-4px_8px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200 flex items-center justify-center"
                style={{ width: '78px', height: '78px' }}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 text-white" />
                ) : (
                  <Play className="w-5 h-5 ml-0.5 text-white" />
                )}
              </button>
              <button className="p-2 rounded-full bg-slate-800 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200">
                <SkipForward className="w-4 h-4 text-slate-300" />
              </button>
              <button className="p-2 rounded-full bg-slate-800 shadow-[3px_3px_6px_rgba(0,0,0,0.5),-3px_-3px_6px_rgba(255,255,255,0.1)] hover:shadow-[inset_2px_2px_4px_rgba(0,0,0,0.5),inset_-2px_-2px_4px_rgba(255,255,255,0.1)] transition-all duration-200">
                <Star className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Right Side - Looper Knob */}
          <div className="flex justify-center items-center min-w-[5rem] py-2">
            <LooperKnob
              selectedBars={selectedLooperBars}
              onBarSelect={handleLooperBarSelect}
              size={50}
            />
            {/* Hidden file input for sheet player toolbar */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.musicxml,.mid,.midi"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </div>
        </div>

        {/* Loop Grid Strip - Below all controls */}
        <div className="mt-4">
          <LoopGridStrip
            exercise={selectedExercise}
            currentTime={currentTime}
            duration={duration}
            loopRegion={loopRegion}
            onLoopRegionChange={onLoopRegionChange || (() => undefined)}
            className="[&>div]:bg-transparent [&>div]:shadow-none [&>div]:p-0"
          />
        </div>

        {/* Sheet Music Section - Integrated within the same panel */}
        <div className="mt-4 border-t border-slate-700/30 pt-4">
          {/* VexFlow Sheet Music */}
          {exerciseNotes.length > 0 ? (
            <div
              className="w-full overflow-x-auto scrollbar-hide"
              style={{
                maxHeight: '250px',
                borderRadius: '28px',
                background: 'linear-gradient(135deg, #bfbfbf 0%, #d1d1d1 100%)',
                boxShadow:
                  'inset 5px 5px 10px #b3b3b3, inset -5px -5px 10px #dfdfdf',
              }}
            >
              <div
                ref={containerRef}
                className="min-w-full p-4"
                style={{ minHeight: '120px' }}
              />
            </div>
          ) : (
            <div
              className="flex items-center justify-center h-32 flex-col gap-4"
              style={{
                borderRadius: '28px',
                background: 'linear-gradient(135deg, #bfbfbf 0%, #d1d1d1 100%)',
                boxShadow:
                  'inset 5px 5px 10px #b3b3b3, inset -5px -5px 10px #dfdfdf',
              }}
            >
              <span className="text-slate-600 text-sm">
                No exercise selected
              </span>
            </div>
          )}

          {/* Sheet Player Toolbar */}
          <SheetPlayerToolbar
            exercise={activeExercise}
            onImport={handleToolbarImport}
            onSave={handleToolbarSave}
            onExportPDF={handleToolbarExportPDF}
            onReset={handleToolbarReset}
            disabled={false}
          />
        </div>
      </div>
    </>
  );
};
