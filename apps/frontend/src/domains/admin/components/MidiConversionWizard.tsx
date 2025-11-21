'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useMidiParsing, type ParseMidiResponse } from '../hooks/useMidiParsing';
import { type GeneratedExerciseNote } from '../hooks/useMidiConversion';
import { ManualMeasurePlacer } from './ManualMeasurePlacer';
import { NoteListEditor } from './NoteListEditor';

interface MidiConversionWizardProps {
  /** Exercise ID (used for legacy mode or conversion API) */
  exerciseId: string;
  /** Callback when conversion is complete */
  onComplete: (notes: GeneratedExerciseNote[]) => void;
  /** Callback when wizard is cancelled */
  onCancel: () => void;
  /** Is wizard open */
  isOpen: boolean;
  /** Optional MIDI URL for stateless parsing (Story 4.4 - Task 4.3) */
  midiUrl?: string;
  /** Optional BPM for stateless parsing */
  bpm?: number;
  /** Optional time signature for stateless parsing */
  timeSignature?: { numerator: number; denominator: number };
  /** Optional total bars for stateless parsing */
  totalBars?: number;
  /** Bass type for conversion (4, 5, or 6 string) */
  bassType?: '4' | '5' | '6';
  /** Existing notes (if editing previously converted exercise) - skips parsing and goes directly to review */
  existingNotes?: GeneratedExerciseNote[];
}

type WizardStep = 'parsing' | 'manual-placement' | 'reviewing' | 'confirming';

/**
 * Multi-step wizard for converting MIDI files to fretboard positions
 *
 * Story 4.4 - Task 4.3: Now supports stateless MIDI parsing
 * - Can parse MIDI from temporary storage URLs (before exercise is saved)
 * - Falls back to exercise ID lookup for existing exercises
 *
 * NEW: Manual placement mode - Admin clicks fretboard to place each note
 * - Replaces automatic anchor-based conversion
 * - More control, more accurate placements
 */
export function MidiConversionWizard({
  exerciseId,
  onComplete,
  onCancel,
  isOpen,
  midiUrl,
  bpm,
  timeSignature,
  totalBars,
  bassType = '4',
  existingNotes,
}: MidiConversionWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('parsing');
  const [parseResult, setParseResult] = useState<ParseMidiResponse | null>(null);
  const [convertedNotes, setConvertedNotes] = useState<GeneratedExerciseNote[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [hasAutoAdvanced, setHasAutoAdvanced] = useState(false); // Track if we've already auto-advanced

  const { parseMidi, loading: parsing, error: parseError } = useMidiParsing();

  // Memoize handleParse to prevent infinite re-renders
  const handleParse = useCallback(async () => {
    try {
      setCurrentStep('parsing');

      // Story 4.4 - Task 4.3: Use stateless parsing if midiUrl provided
      if (midiUrl) {
        console.log('[MidiConversionWizard] Using stateless MIDI parsing (Story 4.4)', {
          midiUrl,
          bpm,
          totalBars,
        });
        const result = await parseMidi(exerciseId, {
          midiUrl,
          bpm,
          timeSignature,
          totalBars,
        });
        setParseResult(result);
        setCurrentStep('manual-placement');
      } else {
        // Legacy mode: Parse from saved exercise
        console.log('[MidiConversionWizard] Using legacy MIDI parsing (exercise ID)', {
          exerciseId,
        });
        const result = await parseMidi(exerciseId);
        setParseResult(result);
        setCurrentStep('manual-placement');
      }
    } catch (err) {
      console.error('Failed to parse MIDI:', err);
    }
  }, [exerciseId, midiUrl, bpm, timeSignature, totalBars, parseMidi]);

  // Auto-parse MIDI when wizard opens
  useEffect(() => {
    if (isOpen && !parseResult) {
      handleParse();
    }
  }, [isOpen, parseResult, handleParse]);

  // Load existing notes after parsing completes (only once on initial load)
  useEffect(() => {
    if (isOpen && parseResult && existingNotes && existingNotes.length > 0 && !hasAutoAdvanced && currentStep === 'manual-placement') {
      console.log('[MidiConversionWizard] Loading existing notes (after parsing)', {
        noteCount: existingNotes.length,
        parseResultAvailable: !!parseResult,
      });
      setConvertedNotes(existingNotes);
      setCurrentStep('reviewing');
      setHasUnsavedChanges(false); // Existing notes are already saved
      setHasAutoAdvanced(true); // Mark that we've auto-advanced
    }
  }, [isOpen, parseResult, existingNotes, currentStep, hasAutoAdvanced]);

  // Handle manual placement completion
  const handleManualPlacementComplete = useCallback((notes: GeneratedExerciseNote[]) => {
    console.log('[MidiConversionWizard] Manual placement complete', {
      noteCount: notes.length,
    });
    setConvertedNotes(notes);
    setHasUnsavedChanges(true);
    setCurrentStep('reviewing');
  }, []);

  const handleNext = async () => {
    if (currentStep === 'reviewing') {
      setCurrentStep('confirming');
    }
  };

  const handleBack = () => {
    if (currentStep === 'reviewing') {
      // Go back to manual placement - existing notes will be pre-loaded
      setCurrentStep('manual-placement');
    } else if (currentStep === 'confirming') {
      setCurrentStep('reviewing');
    }
  };

  const handleConfirm = () => {
    console.log('[MidiWizard] Save Notes clicked - convertedNotes:', convertedNotes.length, 'notes');
    console.log('[MidiWizard] Calling onComplete with notes:', convertedNotes);

    // Save notes to parent and reset wizard state
    onComplete(convertedNotes);

    console.log('[MidiWizard] onComplete called, resetting wizard state');

    // Clear unsaved changes flag and reset wizard state
    setHasUnsavedChanges(false);
    setCurrentStep('parsing');
    setParseResult(null);
    setConvertedNotes([]);
    setHasAutoAdvanced(false); // Reset auto-advance flag

    console.log('[MidiWizard] Wizard state reset complete');
    // Note: Parent component (ExerciseFormModal) will close the wizard via onComplete
    // We don't call onCancel() here because that's for cancellation, not successful completion
  };

  const handleClose = () => {
    if (hasUnsavedChanges && currentStep !== 'parsing') {
      if (!confirm('You have unsaved changes. Are you sure you want to close?')) {
        return;
      }
    }
    setCurrentStep('parsing');
    setParseResult(null);
    setConvertedNotes([]);
    setHasUnsavedChanges(false);
    setHasAutoAdvanced(false); // Reset auto-advance flag
    onCancel();
  };

  const handleNotesChange = (notes: GeneratedExerciseNote[]) => {
    setConvertedNotes(notes);
    setHasUnsavedChanges(true);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Modal overlay */}
      <div className="fixed inset-0 bg-black/50 z-[100]" onClick={handleClose} />

      {/* Modal content */}
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b px-6 py-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">MIDI to Fretboard Conversion</h2>
              <button
                type="button"
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Step indicator */}
            <div className="mt-4">
              <StepIndicator currentStep={currentStep} />
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {currentStep === 'parsing' && (
              <div className="text-center py-12">
                {parsing && (
                  <>
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                    <p className="text-gray-600">Parsing MIDI file...</p>
                  </>
                )}
                {parseError && (
                  <div className="text-red-600">
                    <p className="font-semibold mb-2">Failed to parse MIDI file</p>
                    <p className="text-sm">{parseError.message}</p>
                    <button
                      type="button"
                      onClick={handleParse}
                      className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            )}

            {currentStep === 'manual-placement' && parseResult && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Step 1: Place Notes on Fretboard</h3>

                {/* Bass Type Display */}
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-blue-900">Bass Type:</span>
                    <span className="text-sm text-blue-700">
                      {bassType === '4' && '4-String Bass (G-D-A-E, MIDI 28-67)'}
                      {bassType === '5' && '5-String Bass (G-D-A-E-B, MIDI 23-67)'}
                      {bassType === '6' && '6-String Bass (C-G-D-A-E-B, MIDI 23-72)'}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-blue-600">
                    To change the bass type, close this wizard and update it in the exercise form.
                  </p>
                </div>

                {/* Manual Placement UI */}
                <ManualMeasurePlacer
                  measures={parseResult.measures}
                  bassType={bassType}
                  onComplete={handleManualPlacementComplete}
                  existingNotes={convertedNotes.length > 0 ? convertedNotes : undefined}
                />
              </div>
            )}

            {currentStep === 'reviewing' && (
              <div>
                <h3 className="text-lg font-semibold mb-4">Step 2: Review & Refine Notes</h3>
                <div className="mb-4 p-4 bg-green-50 rounded-lg border border-green-200">
                  <h4 className="font-semibold text-green-900 mb-2">Manual Placement Complete</h4>
                  <div className="text-sm text-green-800">
                    <div>✓ {convertedNotes.length} notes placed manually</div>
                    <div>✓ All placements are validated and accurate</div>
                    <div>✓ You can further refine positions below if needed</div>
                  </div>
                </div>
                <NoteListEditor notes={convertedNotes} onNotesChange={handleNotesChange} bassType={bassType} />
              </div>
            )}

            {currentStep === 'confirming' && (
              <div className="text-center py-12">
                <svg
                  className="w-16 h-16 text-green-500 mx-auto mb-4"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Ready to Save</h3>
                <p className="text-gray-600 mb-6">
                  {convertedNotes.length} notes will be saved to the exercise.
                </p>
                <div className="bg-gray-50 rounded-lg p-4 text-left max-w-md mx-auto">
                  <h4 className="font-semibold text-gray-700 mb-2">Summary:</h4>
                  <ul className="text-sm text-gray-600 space-y-1">
                    <li>• Total notes: {convertedNotes.length}</li>
                    <li>
                      • Placement method: Manual (100% accurate)
                    </li>
                    <li>
                      • All notes validated and playable
                    </li>
                  </ul>
                </div>
              </div>
            )}

          </div>

          {/* Footer */}
          <div className="border-t px-6 py-4 flex items-center justify-between">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>

            <div className="flex gap-2">
              {(currentStep === 'reviewing' || currentStep === 'confirming') && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Back
                </button>
              )}

              {/* Manual placement step - no footer button needed, handled in component */}

              {currentStep === 'reviewing' && (
                <button
                  type="button"
                  onClick={handleNext}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Continue
                </button>
              )}

              {currentStep === 'confirming' && (
                <button
                  type="button"
                  onClick={handleConfirm}
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  Save Notes
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Step indicator component
 */
function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const steps = [
    { id: 'parsing', label: 'Parse MIDI' },
    { id: 'manual-placement', label: 'Place Notes' },
    { id: 'reviewing', label: 'Review Notes' },
    { id: 'confirming', label: 'Confirm' },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-between">
      {steps.map((step, index) => {
        const isActive = index === currentStepIndex;
        const isComplete = index < currentStepIndex;

        return (
          <div key={step.id} className="flex items-center flex-1">
            <div className="flex items-center">
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold
                  ${isComplete ? 'bg-green-500 text-white' : ''}
                  ${isActive ? 'bg-blue-600 text-white' : ''}
                  ${!isActive && !isComplete ? 'bg-gray-200 text-gray-500' : ''}
                `}
              >
                {isComplete ? '✓' : index + 1}
              </div>
              <span
                className={`ml-2 text-sm ${isActive ? 'font-semibold text-gray-900' : 'text-gray-500'}`}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 h-px bg-gray-300 mx-4" />
            )}
          </div>
        );
      })}
    </div>
  );
}
