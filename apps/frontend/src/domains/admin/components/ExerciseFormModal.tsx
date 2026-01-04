'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Exercise } from '@/domains/exercises/entities/exercise.entity';
import { ExerciseId } from '@/domains/exercises/value-objects/exercise-id.vo';
import { Difficulty } from '@/domains/exercises/value-objects/difficulty.vo';
import { Upload, X, FileAudio, CheckCircle2, Wand2, LayoutGrid } from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { MidiConversionWizard } from './MidiConversionWizard';
import { DrumPatternEditorModal } from './DrumPatternEditor/DrumPatternEditorModal.js';
import type { PatternMetadata } from './DrumPatternEditor/types.js';
import type {
  GeneratedExerciseNote,
  ConfidenceLevel,
} from '../hooks/useMidiConversion';
import type {
  DrumHit,
  DrumPatternStats,
  DrumPatternValidation,
} from '@bassnotion/contracts';

interface ExerciseFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (exercise: Partial<Exercise>) => void;
  exercise?: Exercise | null;
  tutorialId: string;
}

export function ExerciseFormModal({
  isOpen,
  onClose,
  onSave,
  exercise,
  tutorialId,
}: ExerciseFormModalProps) {
  const { correlationId, logger } = useCorrelation('ExerciseFormModal');

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    bpm: 120,
    duration: 60,
    durationMeasures: 4,
    durationBeats: 0,
    difficulty: 'beginner',
    key: 'C',
    timeSignatureNumerator: 4,
    timeSignatureDenominator: 4,
    bassType: '4' as '4' | '5' | '6',
    harmonyInstrument: '' as '' | 'grandpiano' | 'rhodes' | 'wurlitzer' | 'pad',
  });

  const [midiFiles, setMidiFiles] = useState<{
    drummer?: File;
    bassline?: File;
    harmony?: File;
    metronome?: File;
  }>({});

  const [midiUrls, setMidiUrls] = useState<{
    drummerMidiUrl?: string;
    basslineMidiUrl?: string;
    harmonyMidiUrl?: string;
    metronomeMidiUrl?: string;
  }>({});

  // Track temporary MIDI file paths for Task 4.1 (Story 4.4)
  const [tempMidiPaths, setTempMidiPaths] = useState<{
    drummer?: string;
    bassline?: string;
    harmony?: string;
    metronome?: string;
  }>({});

  const [uploadingMidi, setUploadingMidi] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generatedNotes, setGeneratedNotes] = useState<any[]>([]);

  // Drum pattern state (similar to bass notes)
  const [drumPattern, setDrumPattern] = useState<DrumHit[]>([]);
  const [drumPatternStats, setDrumPatternStats] =
    useState<DrumPatternStats | null>(null);
  const [drumPatternValidation, setDrumPatternValidation] =
    useState<DrumPatternValidation | null>(null);
  const [showDrumGridEditor, setShowDrumGridEditor] = useState(false);
  const [isConvertingDrums, setIsConvertingDrums] = useState(false);

  // Harmony notes state (similar to bass/drum patterns)
  const [harmonyNotes, setHarmonyNotes] = useState<any[]>([]);
  const [harmonyControlChanges, setHarmonyControlChanges] = useState<any[]>([]);
  const [harmonyAnalysis, setHarmonyAnalysis] = useState<any | null>(null);
  const [isConvertingHarmony, setIsConvertingHarmony] = useState(false);

  // Simple state: show wizard XOR show form (never both)
  const [showMidiWizard, setShowMidiWizard] = useState(false);

  useEffect(() => {
    if (exercise) {
      // Read total_bars directly (primary field)
      const measures = exercise.total_bars || 4;

      setFormData({
        title: exercise.title,
        description: exercise.description,
        bpm: exercise.bpm,
        duration: exercise.duration,
        durationMeasures: measures,
        durationBeats: 0, // No partial measures - always work in full bars
        difficulty: exercise.difficulty.value,
        key: exercise.key,
        timeSignatureNumerator: exercise.timeSignature?.numerator || 4,
        timeSignatureDenominator: exercise.timeSignature?.denominator || 4,
        bassType: (exercise as any).bassType || '4', // Default to 4-string if not set
        harmonyInstrument: exercise.harmonyInstrument || 'grandpiano',
      });
      // Set existing MIDI URLs
      setMidiUrls({
        drummerMidiUrl: exercise.drummerMidiUrl,
        basslineMidiUrl: exercise.basslineMidiUrl,
        harmonyMidiUrl: exercise.harmonyMidiUrl,
        metronomeMidiUrl: exercise.metronomeMidiUrl,
      });

      // Load existing notes if they exist (so wizard can display them)
      if (exercise.notes && exercise.notes.length > 0) {
        console.log('[ExerciseFormModal] Loading existing notes for editing', {
          noteCount: exercise.notes.length,
          exerciseId: exercise.id.value,
        });
        setGeneratedNotes(exercise.notes);
      } else {
        setGeneratedNotes([]);
      }

      // Load existing harmony notes if they exist
      if (exercise.harmonyNotes && exercise.harmonyNotes.length > 0) {
        console.log(
          '[ExerciseFormModal] Loading existing harmony notes for editing',
          {
            noteCount: exercise.harmonyNotes.length,
            exerciseId: exercise.id.value,
          },
        );
        setHarmonyNotes(exercise.harmonyNotes);
      } else {
        setHarmonyNotes([]);
      }

      // Load existing harmony control changes if they exist
      if (
        exercise.harmonyControlChanges &&
        exercise.harmonyControlChanges.length > 0
      ) {
        console.log(
          '[ExerciseFormModal] Loading existing harmony control changes for editing',
          {
            controlChangeCount: exercise.harmonyControlChanges.length,
            exerciseId: exercise.id.value,
          },
        );
        setHarmonyControlChanges(exercise.harmonyControlChanges);
      } else {
        setHarmonyControlChanges([]);
      }

      // Load existing drum pattern if it exists
      if (exercise.drumPattern && exercise.drumPattern.length > 0) {
        console.log(
          '[ExerciseFormModal] Loading existing drum pattern for editing',
          {
            hitCount: exercise.drumPattern.length,
            exerciseId: exercise.id.value,
          },
        );
        setDrumPattern(exercise.drumPattern);
      } else {
        setDrumPattern([]);
      }
    } else {
      // Reset form for new exercise
      setFormData({
        title: '',
        description: '',
        bpm: 120,
        duration: 60,
        durationMeasures: 4,
        durationBeats: 0,
        difficulty: 'beginner',
        key: 'C',
        timeSignatureNumerator: 4,
        timeSignatureDenominator: 4,
        bassType: '4',
        harmonyInstrument: 'grandpiano',
      });
      setMidiFiles({});
      setMidiUrls({});
      setTempMidiPaths({});
      setGeneratedNotes([]);
      setDrumPattern([]);
      setHarmonyNotes([]);
      setHarmonyControlChanges([]);
    }
  }, [exercise]);

  // Auto-calculate duration in seconds when measures, beats, or BPM changes
  useEffect(() => {
    // Calculate duration based on measures, beats, BPM, and time signature
    const beatsPerMeasure = formData.timeSignatureNumerator;
    const totalBeats =
      formData.durationMeasures * beatsPerMeasure + formData.durationBeats;
    const secondsPerBeat = 60 / formData.bpm; // Convert BPM to seconds per beat
    const calculatedDuration = Math.round(totalBeats * secondsPerBeat);

    setFormData((prev) => ({
      ...prev,
      duration: calculatedDuration,
    }));
  }, [
    formData.durationMeasures,
    formData.durationBeats,
    formData.bpm,
    formData.timeSignatureNumerator,
  ]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (formData.bpm < 40 || formData.bpm > 200) {
      newErrors.bpm = 'BPM must be between 40 and 200';
    }

    if (formData.durationMeasures < 1) {
      newErrors.durationMeasures = 'Duration must be at least 1 measure';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleMidiFileChange = async (
    type: 'drummer' | 'bassline' | 'harmony' | 'metronome',
    file: File | null,
  ) => {
    if (!file) {
      // Remove the file
      setMidiFiles((prev) => {
        const updated = { ...prev };
        delete updated[type];
        return updated;
      });
      return;
    }

    // Validate file type
    if (!file.type.includes('midi') && !file.name.endsWith('.mid')) {
      setErrors((prev) => ({
        ...prev,
        [type]: 'Please select a valid MIDI file (.mid)',
      }));
      return;
    }

    // Clear any previous error for this type
    setErrors((prev) => {
      const updated = { ...prev };
      delete updated[type];
      return updated;
    });

    setMidiFiles((prev) => ({ ...prev, [type]: file }));

    // Story 4.4 - Task 4.1: Upload to temp storage immediately (don't wait for save)
    // This enables the seamless "upload → convert → save" workflow
    await uploadMidiFile(type, file);
  };

  const uploadMidiFile = async (
    type: 'drummer' | 'bassline' | 'harmony' | 'metronome',
    file: File,
  ): Promise<string | null> => {
    try {
      setUploadingMidi(type);
      logger.info(
        `Uploading ${type} MIDI file to temporary storage (Story 4.4 - Task 4.1)`,
        {
          fileName: file.name,
          correlationId,
        },
      );

      // Get auth session for backend API call
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('You must be logged in to upload MIDI files');
      }

      // Use new temporary storage endpoint (Task 2 from Story 4.4)
      // This allows upload BEFORE exercise is saved to database
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/storage/upload-temp`,
        {
          method: 'POST',
          body: formData,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'X-Correlation-ID': correlationId,
          },
          credentials: 'include',
        },
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Upload failed' }));
        throw new Error(
          errorData.message || `Upload failed with status ${response.status}`,
        );
      }

      const { temporaryUrl, tempPath } = await response.json();

      // Store temp path for later migration to permanent storage (Task 3)
      setTempMidiPaths((prev) => ({ ...prev, [type]: tempPath }));

      // Store temporary URL for immediate MIDI parsing (Task 4.2)
      setMidiUrls((prev) => ({ ...prev, [`${type}MidiUrl`]: temporaryUrl }));

      logger.info(
        `Successfully uploaded ${type} MIDI file to temporary storage`,
        {
          tempPath,
          temporaryUrl,
          correlationId,
        },
      );

      // Auto-trigger drum conversion for drummer MIDI
      if (type === 'drummer' && temporaryUrl) {
        await convertDrummerMidi(temporaryUrl);
      }

      // Auto-trigger harmony conversion for harmony MIDI
      if (type === 'harmony' && temporaryUrl) {
        await convertHarmonyMidi(temporaryUrl);
      }

      return temporaryUrl;
    } catch (error) {
      console.error(`Temporary MIDI upload error for ${type}:`, error);
      logger.error(
        `Error uploading ${type} MIDI file to temporary storage`,
        error as Error,
        { correlationId },
      );
      setErrors((prev) => ({
        ...prev,
        [type]: `Failed to upload ${type} MIDI file`,
      }));
      return null;
    } finally {
      setUploadingMidi(null);
    }
  };

  /**
   * Convert drummer MIDI to drum pattern
   * Called automatically after drummer MIDI upload
   */
  const convertDrummerMidi = async (drummerMidiUrl: string) => {
    try {
      setIsConvertingDrums(true);
      logger.info('Converting drummer MIDI to drum pattern', {
        drummerMidiUrl,
        correlationId,
      });

      // Get auth session for backend API call
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('You must be logged in');
      }

      // Call drum conversion endpoint
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/midi/convert-drums`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            'X-Correlation-ID': correlationId,
          },
          credentials: 'include',
          body: JSON.stringify({
            exerciseId: exercise?.id || 'new',
            drummerMidiUrl,
          }),
        },
      );

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ message: 'Conversion failed' }));
        throw new Error(errorData.message || 'Failed to convert drum MIDI');
      }

      const result = await response.json();

      logger.info('Drummer MIDI converted successfully', {
        totalHits: result.stats.totalHits,
        unknownCount: result.stats.unknownCount,
        correlationId,
      });

      // Store converted drum pattern
      setDrumPattern(result.drumPattern);
      setDrumPatternStats(result.stats);
      setDrumPatternValidation(result.validation);

      // DIAGNOSTIC: Verify drum pattern was stored
      logger.info('Drum pattern stored in state after conversion', {
        drumPatternHits: result.drumPattern.length,
        drumPatternSample: result.drumPattern[0],
        stats: result.stats,
        correlationId,
      });

      // Show grid editor for review/editing
      setShowDrumGridEditor(true);
    } catch (error) {
      console.error('Drum conversion error:', error);
      logger.error('Failed to convert drummer MIDI', error as Error, {
        correlationId,
      });
      setErrors((prev) => ({
        ...prev,
        drummer: `Failed to convert drum MIDI: ${(error as Error).message}`,
      }));
    } finally {
      setIsConvertingDrums(false);
    }
  };

  /**
   * Handle save from drum grid editor
   */
  const handleGridEditorSave = (pattern: DrumHit[], _metadata: PatternMetadata) => {
    logger.info('Grid editor save', {
      hitCount: pattern.length,
      correlationId,
    });
    setDrumPattern(pattern);
    setShowDrumGridEditor(false);
  };

  /**
   * Convert harmony MIDI to harmony notes
   * Called automatically after harmony MIDI upload
   */
  const convertHarmonyMidi = async (harmonyMidiUrl: string) => {
    try {
      setIsConvertingHarmony(true);
      logger.info('Converting harmony MIDI to harmony notes', {
        harmonyMidiUrl,
        harmonyInstrument: formData.harmonyInstrument,
        correlationId,
      });

      // Get auth session for backend API call
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('You must be logged in');
      }

      // Step 1: Parse MIDI file
      const parseResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/midi/parse`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            'X-Correlation-ID': correlationId,
          },
          credentials: 'include',
          body: JSON.stringify({
            midiUrl: harmonyMidiUrl,
            bpm: formData.bpm,
            timeSignature: {
              numerator: formData.timeSignatureNumerator,
              denominator: formData.timeSignatureDenominator,
            },
            totalBars: formData.durationMeasures,
          }),
        },
      );

      if (!parseResponse.ok) {
        const errorData = await parseResponse
          .json()
          .catch(() => ({ message: 'Parse failed' }));
        throw new Error(errorData.message || 'Failed to parse harmony MIDI');
      }

      const parseResult = await parseResponse.json();

      // Diagnostic logging to see what's in the parsed measures
      logger.info('📊 Parse result details', {
        measureCount: parseResult.measures.length,
        firstMeasure: parseResult.measures[0],
        firstMeasureNoteCount: parseResult.measures[0]?.notes?.length || 0,
        allMeasureNoteCounts: parseResult.measures.map((m: any, i: number) => ({
          measure: i + 1,
          noteCount: m.notes?.length || 0,
        })),
        correlationId,
      });

      logger.info('Harmony MIDI parsed successfully', {
        measureCount: parseResult.measures.length,
        correlationId,
      });

      // Step 2: Convert parsed measures to harmony notes
      const convertResponse = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/midi/convert-harmony`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
            'X-Correlation-ID': correlationId,
          },
          credentials: 'include',
          body: JSON.stringify({
            measures: parseResult.measures,
            instrumentType: formData.harmonyInstrument,
            controlChanges: parseResult.controlChanges, // Include control changes from parser
          }),
        },
      );

      if (!convertResponse.ok) {
        const errorData = await convertResponse
          .json()
          .catch(() => ({ message: 'Conversion failed' }));
        throw new Error(errorData.message || 'Failed to convert harmony MIDI');
      }

      const result = await convertResponse.json();

      logger.info('Harmony MIDI converted successfully', {
        totalNotes: result.notes.length,
        uniquePitches: result.analysis.uniquePitches.length,
        velocityLayers: result.analysis.requiredVelocityLayers.length,
        isPolyphonic: result.analysis.isPolyphonic,
        correlationId,
      });

      // Store converted harmony notes and control changes
      setHarmonyNotes(result.notes);
      setHarmonyControlChanges(result.controlChanges || []);
      setHarmonyAnalysis(result.analysis);

      logger.info('Harmony notes stored in state after conversion', {
        harmonyNotesCount: result.notes.length,
        harmonyControlChangesCount: result.controlChanges?.length || 0,
        harmonyNotesSample: result.notes[0],
        analysis: result.analysis,
        correlationId,
      });
    } catch (error) {
      console.error('Harmony conversion error:', error);
      logger.error('Failed to convert harmony MIDI', error as Error, {
        correlationId,
      });
      setErrors((prev) => ({
        ...prev,
        harmony: `Failed to convert harmony MIDI: ${(error as Error).message}`,
      }));
    } finally {
      setIsConvertingHarmony(false);
    }
  };

  const handleConvertMidi = () => {
    // Story 4.4 - Task 4.4: No longer requires exercise to be saved!
    // Just check if bassline MIDI is uploaded (either in temp or permanent storage)
    if (!midiFiles.bassline && !midiUrls.basslineMidiUrl) {
      setErrors((prev) => ({
        ...prev,
        bassline: 'Please upload a bassline MIDI file first',
      }));
      return;
    }

    setShowMidiWizard(true);
  };

  const handleWizardComplete = (notes: GeneratedExerciseNote[]) => {
    console.log(
      '[ExerciseForm] Wizard complete - saving',
      notes.length,
      'notes',
    );

    // Convert GeneratedExerciseNote[] to ExerciseNote[] format
    // Preserve musical timing data (position, noteDuration, durationTicks)
    const exerciseNotes = notes.map((note) => ({
      id: note.id,
      string: note.string,
      fret: note.fret,
      note: note.note,
      color: '#3b82f6',
      techniques: note.warnings?.map((w) => w.type) || [],

      // Musical timing (480 PPQ standard)
      position: note.position,
      noteDuration: note.noteDuration,
      durationTicks: note.durationTicks,
    }));

    setGeneratedNotes(exerciseNotes);
    setShowMidiWizard(false); // Go back to form

    logger.info('MIDI conversion completed', {
      noteCount: exerciseNotes.length,
      hasMusicalTiming: exerciseNotes[0]?.position !== undefined,
      correlationId,
    });
  };

  const handleWizardCancel = () => {
    setShowMidiWizard(false); // Go back to form
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    // Story 4.4 - Task 4.1: MIDI files are now uploaded immediately on selection
    // This code is kept for backward compatibility but should be a no-op
    // (files are already uploaded to temp storage in handleMidiFileChange)
    const uploadedUrls: Record<string, string> = {};

    for (const [type, file] of Object.entries(midiFiles)) {
      // Skip if already uploaded (check if we have a temp path)
      const typeKey = type as 'drummer' | 'bassline' | 'harmony' | 'metronome';
      if (file && !tempMidiPaths[typeKey]) {
        const url = await uploadMidiFile(typeKey, file);
        if (url) {
          // Store in camelCase for Exercise entity (will be converted to snake_case by toDTO())
          uploadedUrls[`${type}MidiUrl`] = url;
        }
      }
    }

    // Save total_bars directly (primary field for musical time)
    const totalBars = formData.durationMeasures;
    const beatsPerMeasure = formData.timeSignatureNumerator;
    const totalBeats = totalBars * beatsPerMeasure; // Calculated for backward compatibility

    const exerciseData = {
      id: exercise?.id || ExerciseId.create(),
      tutorialId: tutorialId,
      title: formData.title,
      description: formData.description,
      bpm: formData.bpm,
      duration: formData.duration, // DEPRECATED: for backward compatibility
      total_bars: totalBars, // PRIMARY: Total measures/bars (musicians think in bars!)
      duration_beats: totalBeats, // DEPRECATED: Calculated for backward compatibility
      timeSignature: {
        numerator: formData.timeSignatureNumerator,
        denominator: formData.timeSignatureDenominator,
      },
      difficulty: Difficulty.fromString(formData.difficulty),
      key: formData.key,
      notes: generatedNotes.length > 0 ? generatedNotes : [],
      drumPattern: drumPattern, // FIXED: camelCase for Exercise entity (will be converted to snake_case in toDTO)
      drum_pattern: drumPattern, // ALSO keep snake_case for direct API submission
      harmonyNotes: harmonyNotes.length > 0 ? harmonyNotes : [], // Harmony notes from MIDI conversion
      harmony_notes: harmonyNotes.length > 0 ? harmonyNotes : [], // Also keep snake_case for direct API submission
      harmonyControlChanges:
        harmonyControlChanges.length > 0 ? harmonyControlChanges : [], // Control changes (sustain pedal, etc.)
      harmony_control_changes:
        harmonyControlChanges.length > 0 ? harmonyControlChanges : [], // Also keep snake_case for direct API submission
      harmonyInstrument: formData.harmonyInstrument || null, // Harmony instrument type (null when cleared)
      harmony_instrument: formData.harmonyInstrument || null, // Also keep snake_case for direct API submission
      tags: [],
      isActive: true,
      // Include existing MIDI URLs (already camelCase) and any newly uploaded ones (also camelCase now)
      ...midiUrls,
      ...uploadedUrls,
      // Add temp MIDI paths for backend to migrate to permanent storage (Story 4.4 - Task 3)
      temp_bassline_midi_path: tempMidiPaths.bassline,
      temp_drummer_midi_path: tempMidiPaths.drummer,
      temp_harmony_midi_path: tempMidiPaths.harmony,
      temp_metronome_midi_path: tempMidiPaths.metronome,
    };

    logger.info(
      'Exercise form submitting with temp MIDI paths (Story 4.4 - Task 4.1)',
      {
        title: exerciseData.title,
        bpm: exerciseData.bpm,
        hasTempBassline: !!tempMidiPaths.bassline,
        hasTempDrummer: !!tempMidiPaths.drummer,
        hasTempHarmony: !!tempMidiPaths.harmony,
        hasTempMetronome: !!tempMidiPaths.metronome,
        hasGeneratedNotes: generatedNotes.length > 0,
        // DIAGNOSTIC: Check drum pattern data
        hasDrumPattern: drumPattern.length > 0,
        drumPatternHits: drumPattern.length,
        drumPatternSample: drumPattern[0],
        // DIAGNOSTIC: Check harmony data
        hasHarmonyNotes: harmonyNotes.length > 0,
        harmonyNotesCount: harmonyNotes.length,
        harmonyControlChangesCount: harmonyControlChanges.length,
        harmonyInstrument: formData.harmonyInstrument,
        harmonyAnalysis: harmonyAnalysis,
      },
    );

    onSave(exerciseData);
    onClose();
  };

  const handleFieldChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // When wizard is active, DON'T render the Dialog at all - just the wizard
  if (showMidiWizard && isOpen) {
    // Convert ExerciseNote[] to GeneratedExerciseNote[] format for wizard
    const existingNotesForWizard: GeneratedExerciseNote[] | undefined =
      generatedNotes.length > 0
        ? generatedNotes.map((note) => ({
            id: note.id,
            string: note.string,
            fret: note.fret,
            note: note.note,
            position: note.position || { measure: 1, beat: 1, subdivision: 0 },
            noteDuration: note.noteDuration || 'quarter',
            durationTicks: note.durationTicks || 480,
            pitch: 0, // Not stored in ExerciseNote
            velocity: 100, // Default velocity
            measureNumber: note.position?.measure || 1,
            confidence: 'high' as ConfidenceLevel,
            alternatives: [],
            warnings: note.techniques?.map((t) => ({
              type: t as any,
              message: t,
              severity: 'info' as const,
            })),
            score: 1.0,
          }))
        : undefined;

    return createPortal(
      <MidiConversionWizard
        exerciseId={exercise?.id?.value || 'temp-exercise'}
        isOpen={true}
        onComplete={handleWizardComplete}
        onCancel={handleWizardCancel}
        midiUrl={midiUrls.basslineMidiUrl}
        bpm={formData.bpm}
        timeSignature={{
          numerator: formData.timeSignatureNumerator,
          denominator: formData.timeSignatureDenominator,
        }}
        totalBars={formData.durationMeasures}
        bassType={formData.bassType}
        existingNotes={existingNotesForWizard}
      />,
      document.body,
    );
  }

  // Otherwise render the form Dialog
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto border-gray-200 shadow-2xl z-[60] bg-gradient-to-br from-blue-50 via-blue-100 to-indigo-100">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle>
            {exercise ? 'Edit Exercise' : 'Create New Exercise'}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => handleFieldChange('title', e.target.value)}
              placeholder="Exercise title"
              className={errors.title ? 'border-red-500' : ''}
            />
            {errors.title && (
              <p className="text-sm text-red-500">{errors.title}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              placeholder="Brief description of the exercise"
              rows={3}
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="bpm">BPM *</Label>
              <Input
                id="bpm"
                type="number"
                min={40}
                max={200}
                value={formData.bpm}
                onChange={(e) =>
                  handleFieldChange('bpm', parseInt(e.target.value) || 120)
                }
                className={errors.bpm ? 'border-red-500' : ''}
              />
              {errors.bpm && (
                <p className="text-sm text-red-500">{errors.bpm}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="difficulty">Difficulty *</Label>
              <Select
                value={formData.difficulty}
                onValueChange={(value) =>
                  handleFieldChange('difficulty', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="bassType">Bass Type *</Label>
              <Select
                value={formData.bassType}
                onValueChange={(value: '4' | '5' | '6') =>
                  handleFieldChange('bassType', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4-String Bass (E1-B4)</SelectItem>
                  <SelectItem value="5">5-String Bass (B0-B4)</SelectItem>
                  <SelectItem value="6">6-String Bass (B0-C5)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Select the bass type for this exercise. This determines the
                valid note range for MIDI conversion.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="harmonyInstrument">
                <span className="flex items-center gap-2">
                  Step 1: Select Harmony Instrument *
                  <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                    1 of 2
                  </span>
                </span>
              </Label>
              <Select
                value={formData.harmonyInstrument}
                onValueChange={(
                  value: '' | 'grandpiano' | 'rhodes' | 'wurlitzer' | 'pad',
                ) => handleFieldChange('harmonyInstrument', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose harmony instrument first..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="grandpiano">
                    Grand Piano (7 velocity layers)
                  </SelectItem>
                  <SelectItem value="rhodes">
                    Rhodes Electric Piano (4 velocity layers)
                  </SelectItem>
                  <SelectItem value="wurlitzer">
                    Wurlitzer (5 velocity layers)
                  </SelectItem>
                  <SelectItem value="pad">
                    Synth Pad (4 velocity layers)
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Choose the instrument type before uploading MIDI. This
                determines velocity layer optimization for sample preloading.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="measures">Duration (Measures)</Label>
              <Input
                id="measures"
                type="number"
                min={1}
                value={formData.durationMeasures}
                onChange={(e) =>
                  handleFieldChange(
                    'durationMeasures',
                    parseInt(e.target.value) || 4,
                  )
                }
                className={errors.durationMeasures ? 'border-red-500' : ''}
              />
              {errors.durationMeasures && (
                <p className="text-sm text-red-500">
                  {errors.durationMeasures}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="beats">Additional Beats</Label>
              <Input
                id="beats"
                type="number"
                min={0}
                max={3}
                value={formData.durationBeats}
                onChange={(e) =>
                  handleFieldChange(
                    'durationBeats',
                    parseInt(e.target.value) || 0,
                  )
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="key">Key</Label>
              <Select
                value={formData.key}
                onValueChange={(value) => handleFieldChange('key', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="C">C Major</SelectItem>
                  <SelectItem value="G">G Major</SelectItem>
                  <SelectItem value="D">D Major</SelectItem>
                  <SelectItem value="A">A Major</SelectItem>
                  <SelectItem value="E">E Major</SelectItem>
                  <SelectItem value="B">B Major</SelectItem>
                  <SelectItem value="F">F Major</SelectItem>
                  <SelectItem value="Bb">Bb Major</SelectItem>
                  <SelectItem value="Eb">Eb Major</SelectItem>
                  <SelectItem value="Ab">Ab Major</SelectItem>
                  <SelectItem value="Db">Db Major</SelectItem>
                  <SelectItem value="Gb">Gb Major</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Time Signature</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={16}
                  value={formData.timeSignatureNumerator}
                  onChange={(e) =>
                    handleFieldChange(
                      'timeSignatureNumerator',
                      parseInt(e.target.value) || 4,
                    )
                  }
                  className="w-16"
                />
                <span>/</span>
                <Select
                  value={formData.timeSignatureDenominator.toString()}
                  onValueChange={(value) =>
                    handleFieldChange(
                      'timeSignatureDenominator',
                      parseInt(value) || 4,
                    )
                  }
                >
                  <SelectTrigger className="w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2">2</SelectItem>
                    <SelectItem value="4">4</SelectItem>
                    <SelectItem value="8">8</SelectItem>
                    <SelectItem value="16">16</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* MIDI Files Section */}
          <div className="border-t pt-4 rounded-lg p-4 bg-gray-50">
            <h3 className="text-sm font-semibold mb-3 text-gray-700">
              MIDI Files (Optional)
            </h3>
            <div className="grid gap-3">
              {/* Drummer MIDI */}
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg transition-colors bg-white hover:bg-gray-50">
                <div className="flex items-center gap-3 flex-1">
                  <FileAudio className="h-5 w-5 text-gray-400" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Drummer Track</p>
                    {midiUrls.drummerMidiUrl && !midiFiles.drummer && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        File uploaded
                      </p>
                    )}
                    {midiFiles.drummer && (
                      <p className="text-xs text-gray-500">
                        {midiFiles.drummer.name}
                      </p>
                    )}
                    {isConvertingDrums && (
                      <p className="text-xs text-blue-600 flex items-center gap-1 mt-1">
                        <Wand2 className="h-3 w-3 animate-spin" />
                        Converting drum MIDI...
                      </p>
                    )}
                    {drumPattern.length > 0 && !isConvertingDrums && (
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          {drumPattern.length} drum hits converted
                        </p>
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs text-blue-600"
                          onClick={() => setShowDrumGridEditor(true)}
                        >
                          <LayoutGrid className="h-3 w-3 mr-1" />
                          Edit Pattern
                        </Button>
                      </div>
                    )}
                    {drumPattern.length === 0 && !isConvertingDrums && !midiFiles.drummer && !midiUrls.drummerMidiUrl && (
                      <Button
                        type="button"
                        variant="link"
                        size="sm"
                        className="h-auto p-0 text-xs text-blue-600 mt-1"
                        onClick={() => setShowDrumGridEditor(true)}
                      >
                        <LayoutGrid className="h-3 w-3 mr-1" />
                        Create Pattern from Scratch
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".mid,.midi,audio/midi"
                    onChange={(e) =>
                      handleMidiFileChange(
                        'drummer',
                        e.target.files?.[0] || null,
                      )
                    }
                    className="hidden"
                    id="drummer-midi"
                  />
                  <Label htmlFor="drummer-midi">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingMidi === 'drummer'}
                      asChild
                    >
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingMidi === 'drummer'
                          ? 'Uploading...'
                          : 'Upload'}
                      </span>
                    </Button>
                  </Label>
                  {(midiFiles.drummer || midiUrls.drummerMidiUrl || drumPattern.length > 0) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleMidiFileChange('drummer', null);
                        setMidiUrls((prev) => {
                          const updated = { ...prev };
                          delete updated.drummerMidiUrl;
                          return updated;
                        });
                        // Clear drum pattern data so it's removed from Supabase on save
                        setDrumPattern([]);
                        setDrumPatternStats(null);
                        setDrumPatternValidation(null);
                        setTempMidiPaths((prev) => {
                          const updated = { ...prev };
                          delete updated.drummer;
                          return updated;
                        });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Bassline MIDI */}
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg transition-colors bg-white hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <FileAudio className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">Bass Track</p>
                    {midiUrls.basslineMidiUrl && !midiFiles.bassline && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        File uploaded
                      </p>
                    )}
                    {midiFiles.bassline && (
                      <p className="text-xs text-gray-500">
                        {midiFiles.bassline.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".mid,.midi,audio/midi"
                    onChange={(e) =>
                      handleMidiFileChange(
                        'bassline',
                        e.target.files?.[0] || null,
                      )
                    }
                    className="hidden"
                    id="bassline-midi"
                  />
                  <Label htmlFor="bassline-midi">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingMidi === 'bassline'}
                      asChild
                    >
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingMidi === 'bassline'
                          ? 'Uploading...'
                          : 'Upload'}
                      </span>
                    </Button>
                  </Label>
                  {(midiFiles.bassline || midiUrls.basslineMidiUrl || generatedNotes.length > 0) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleMidiFileChange('bassline', null);
                        setMidiUrls((prev) => {
                          const updated = { ...prev };
                          delete updated.basslineMidiUrl;
                          return updated;
                        });
                        // Clear bass notes data so it's removed from Supabase on save
                        setGeneratedNotes([]);
                        setTempMidiPaths((prev) => {
                          const updated = { ...prev };
                          delete updated.bassline;
                          return updated;
                        });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Convert from MIDI button for bassline - Story 4.4 Task 4.4 */}
              {(midiUrls.basslineMidiUrl || midiFiles.bassline) && (
                <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleConvertMidi}
                    className="w-full bg-white hover:bg-blue-50"
                  >
                    <Wand2 className="h-4 w-4 mr-2" />
                    Convert MIDI to Fretboard Positions
                  </Button>
                  {generatedNotes.length > 0 && (
                    <p className="text-xs text-green-700 mt-2 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {generatedNotes.length} fretboard positions generated
                    </p>
                  )}
                  <p className="text-xs text-blue-700 mt-1">
                    Use the wizard to automatically generate fretboard positions
                    from your MIDI file
                  </p>
                </div>
              )}

              {/* Harmony MIDI */}
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg transition-colors bg-white hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <FileAudio className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      Harmony Track
                      <span className="text-xs font-normal text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                        Step 2 of 2
                      </span>
                    </p>
                    {!formData.harmonyInstrument && !midiFiles.harmony && (
                      <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                        <span className="inline-block w-3 h-3 text-center leading-3 border border-amber-600 rounded-full text-[10px]">
                          !
                        </span>
                        Select harmony instrument above first
                      </p>
                    )}
                    {midiUrls.harmonyMidiUrl && !midiFiles.harmony && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        File uploaded
                      </p>
                    )}
                    {midiFiles.harmony && (
                      <p className="text-xs text-gray-500">
                        {midiFiles.harmony.name}
                      </p>
                    )}
                    {isConvertingHarmony && (
                      <p className="text-xs text-blue-600 flex items-center gap-1">
                        <Wand2 className="h-3 w-3 animate-spin" />
                        Converting to {formData.harmonyInstrument} notes...
                      </p>
                    )}
                    {harmonyNotes.length > 0 && !isConvertingHarmony && (
                      <div className="mt-1 space-y-1">
                        <p className="text-xs text-green-600 flex items-center gap-1 font-semibold">
                          <CheckCircle2 className="h-4 w-4" />
                          Converted successfully!
                        </p>
                        <p className="text-xs text-gray-600">
                          {harmonyNotes.length} notes •{' '}
                          {harmonyAnalysis?.uniquePitches.length} unique pitches
                          • {harmonyAnalysis?.requiredVelocityLayers.length}{' '}
                          velocity layers
                        </p>
                        {harmonyAnalysis && (
                          <p className="text-xs text-blue-600">
                            Optimization:{' '}
                            {Math.round(
                              (1 -
                                (harmonyAnalysis.uniquePitches.length *
                                  harmonyAnalysis.requiredVelocityLayers
                                    .length) /
                                  (88 * 16)) *
                                100,
                            )}
                            % less samples to load
                          </p>
                        )}
                      </div>
                    )}
                    {errors.harmony && !isConvertingHarmony && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <X className="h-3 w-3" />
                        {errors.harmony}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".mid,.midi,audio/midi"
                    onChange={(e) =>
                      handleMidiFileChange(
                        'harmony',
                        e.target.files?.[0] || null,
                      )
                    }
                    className="hidden"
                    id="harmony-midi"
                    disabled={!formData.harmonyInstrument}
                  />
                  <Label
                    htmlFor="harmony-midi"
                    className={
                      !formData.harmonyInstrument
                        ? 'pointer-events-none cursor-not-allowed'
                        : 'cursor-pointer'
                    }
                  >
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={
                        uploadingMidi === 'harmony' ||
                        !formData.harmonyInstrument
                      }
                      className={
                        !formData.harmonyInstrument
                          ? 'opacity-50 bg-gray-200 text-gray-500 border-gray-300 cursor-not-allowed hover:bg-gray-200 hover:text-gray-500'
                          : ''
                      }
                      asChild
                    >
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingMidi === 'harmony'
                          ? 'Uploading...'
                          : 'Upload'}
                      </span>
                    </Button>
                  </Label>
                  {(midiFiles.harmony || midiUrls.harmonyMidiUrl || harmonyNotes.length > 0) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleMidiFileChange('harmony', null);
                        setMidiUrls((prev) => {
                          const updated = { ...prev };
                          delete updated.harmonyMidiUrl;
                          return updated;
                        });
                        // Clear harmony data so it's removed from Supabase on save
                        setHarmonyNotes([]);
                        setHarmonyControlChanges([]);
                        setHarmonyAnalysis(null);
                        setFormData((prev) => ({
                          ...prev,
                          harmonyInstrument: '' as '' | 'grandpiano' | 'rhodes' | 'wurlitzer' | 'pad',
                        }));
                        setTempMidiPaths((prev) => {
                          const updated = { ...prev };
                          delete updated.harmony;
                          return updated;
                        });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Metronome MIDI */}
              <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg transition-colors bg-white hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <FileAudio className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm font-medium">Metronome Track</p>
                    {midiUrls.metronomeMidiUrl && !midiFiles.metronome && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        File uploaded
                      </p>
                    )}
                    {midiFiles.metronome && (
                      <p className="text-xs text-gray-500">
                        {midiFiles.metronome.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".mid,.midi,audio/midi"
                    onChange={(e) =>
                      handleMidiFileChange(
                        'metronome',
                        e.target.files?.[0] || null,
                      )
                    }
                    className="hidden"
                    id="metronome-midi"
                  />
                  <Label htmlFor="metronome-midi">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingMidi === 'metronome'}
                      asChild
                    >
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        {uploadingMidi === 'metronome'
                          ? 'Uploading...'
                          : 'Upload'}
                      </span>
                    </Button>
                  </Label>
                  {(midiFiles.metronome || midiUrls.metronomeMidiUrl) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleMidiFileChange('metronome', null);
                        setMidiUrls((prev) => {
                          const updated = { ...prev };
                          delete updated.metronomeMidiUrl;
                          return updated;
                        });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Error messages for MIDI uploads */}
              {(errors.drummer ||
                errors.bassline ||
                errors.harmony ||
                errors.metronome) && (
                <div className="text-sm text-red-500 mt-2 p-2 bg-red-50 dark:bg-red-950/20 rounded">
                  {errors.drummer && <p>Drummer: {errors.drummer}</p>}
                  {errors.bassline && <p>Bass: {errors.bassline}</p>}
                  {errors.harmony && <p>Harmony: {errors.harmony}</p>}
                  {errors.metronome && <p>Metronome: {errors.metronome}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={uploadingMidi !== null}>
            {exercise ? 'Update' : 'Create'} Exercise
          </Button>
        </DialogFooter>
      </DialogContent>

      {/* Drum Pattern Grid Editor */}
      <DrumPatternEditorModal
        isOpen={showDrumGridEditor}
        onClose={() => setShowDrumGridEditor(false)}
        initialPattern={drumPattern}
        onSave={handleGridEditorSave}
        contextTempo={formData.bpm}
        contextTimeSignature={{
          numerator: formData.timeSignatureNumerator,
          denominator: formData.timeSignatureDenominator,
        }}
      />
    </Dialog>
  );
}
