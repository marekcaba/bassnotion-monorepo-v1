import React, { useState, useEffect } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { useToast } from '@/shared/hooks/use-toast';
import { Save, X, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import type {
  DatabaseExercise as Exercise,
  ExerciseNote,
  ExerciseDifficulty,
  TechniqueType,
  CreateExerciseRequest,
  UpdateExerciseRequest,
} from '@bassnotion/contracts';

export interface ExercisePropertyEditorProps {
  exercise?: Exercise;
  isEditing: boolean;
  onSave: (
    data: CreateExerciseRequest | UpdateExerciseRequest,
  ) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
  mode: 'create' | 'edit';
}

// Remove unused interface - Epic 4 properties are already in ExerciseNote

export function ExercisePropertyEditor({
  exercise,
  isEditing: _isEditing,
  onSave,
  onCancel,
  isLoading = false,
  mode,
}: ExercisePropertyEditorProps) {
  // Basic Properties
  const [title, setTitle] = useState(exercise?.title || '');
  const [description, setDescription] = useState(exercise?.description || '');
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>(
    exercise?.difficulty || 'beginner',
  );
  const [duration, setDuration] = useState(exercise?.duration || 60000);
  const [bpm, setBpm] = useState(exercise?.bpm || 120);
  const [key, setKey] = useState(exercise?.key || 'C');

  // Epic 3 YouTube Integration Properties
  const [youtubeVideoId, setYoutubeVideoId] = useState(
    exercise?.youtube_video_id || '',
  );
  const [startTimestamp, setStartTimestamp] = useState(
    exercise?.start_timestamp || 0,
  );
  const [endTimestamp, setEndTimestamp] = useState(
    exercise?.end_timestamp || 0,
  );
  const [teachingSummary, setTeachingSummary] = useState(
    exercise?.teaching_summary || '',
  );

  // Epic 3 Chord Progression
  const [chordProgression, setChordProgression] = useState<string[]>(
    exercise?.chord_progression || [],
  );
  const [newChord, setNewChord] = useState('');

  // Epic 4 Notes Management
  const [notes, setNotes] = useState<ExerciseNote[]>(exercise?.notes || []);
  const [_selectedNoteIndex, _setSelectedNoteIndex] = useState<number | null>(
    null,
  );
  const [showAdvancedProperties, setShowAdvancedProperties] = useState(false);

  // Admin Metadata
  const [isActive, setIsActive] = useState(exercise?.is_active ?? true);

  const { toast } = useToast();

  // Update state when exercise prop changes
  useEffect(() => {
    if (exercise) {
      setTitle(exercise.title);
      setDescription(exercise.description || '');
      setDifficulty(exercise.difficulty);
      setDuration(exercise.duration);
      setBpm(exercise.bpm);
      setKey(exercise.key);
      setYoutubeVideoId(exercise.youtube_video_id || '');
      setStartTimestamp(exercise.start_timestamp || 0);
      setEndTimestamp(exercise.end_timestamp || 0);
      setTeachingSummary(exercise.teaching_summary || '');
      setChordProgression(exercise.chord_progression || []);
      setNotes(exercise.notes || []);
      setIsActive(exercise.is_active);
    }
  }, [exercise]);

  const handleAddChord = () => {
    if (newChord.trim() && !chordProgression.includes(newChord.trim())) {
      setChordProgression([...chordProgression, newChord.trim()]);
      setNewChord('');
    }
  };

  const handleRemoveChord = (index: number) => {
    setChordProgression(chordProgression.filter((_, i) => i !== index));
  };

  const handleNotePropertyChange = (
    index: number,
    property: keyof ExerciseNote,
    value: any,
  ) => {
    const updatedNotes = [...notes];
    const currentNote = updatedNotes[index];
    if (currentNote) {
      updatedNotes[index] = { ...currentNote, [property]: value };
      setNotes(updatedNotes);
    }
  };

  const handleTechniqueToggle = (
    noteIndex: number,
    technique: TechniqueType,
  ) => {
    const updatedNotes = [...notes];
    const note = updatedNotes[noteIndex];
    if (!note) return;

    const techniques = note.techniques || [];

    if (techniques.includes(technique)) {
      note.techniques = techniques.filter((t) => t !== technique);
    } else {
      note.techniques = [...techniques, technique];
    }

    setNotes(updatedNotes);
  };

  const handleAddNote = () => {
    const newNote: ExerciseNote = {
      id: `note-${Date.now()}`,
      fret: 0,
      string: 1,
      timestamp: 0,
      duration: 500,
      note: 'C',
      color: 'blue',
    };
    setNotes([...notes, newNote]);
  };

  const handleRemoveNote = (index: number) => {
    setNotes(notes.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      const exerciseData = {
        title,
        description: description || undefined,
        difficulty,
        duration,
        bpm,
        key,
        youtube_video_id: youtubeVideoId || undefined,
        start_timestamp: startTimestamp || undefined,
        end_timestamp: endTimestamp || undefined,
        teaching_summary: teachingSummary || undefined,
        chord_progression:
          chordProgression.length > 0 ? chordProgression : undefined,
        notes,
        ...(mode === 'edit' && { is_active: isActive }),
      };

      await onSave(exerciseData);
      toast({
        title: mode === 'create' ? 'Exercise Created' : 'Exercise Updated',
        description: `"${title}" has been ${mode === 'create' ? 'created' : 'updated'} successfully.`,
      });
    } catch {
      toast({
        title: 'Error',
        description: `Failed to ${mode === 'create' ? 'create' : 'update'} exercise. Please try again.`,
        variant: 'destructive',
      });
    }
  };

  const isValid = title.trim().length > 0 && notes.length > 0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          {mode === 'create'
            ? 'Create New Exercise'
            : `Edit Exercise: ${exercise?.title}`}
        </h2>
        <div className="flex gap-2">
          <Button onClick={onCancel} variant="outline" disabled={isLoading}>
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!isValid || isLoading}>
            <Save className="w-4 h-4 mr-2" />
            {isLoading
              ? 'Saving...'
              : mode === 'create'
                ? 'Create Exercise'
                : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Basic Properties */}
      <Card>
        <CardHeader>
          <CardTitle>Basic Properties</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Exercise title..."
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="difficulty">Difficulty</Label>
              <select
                id="difficulty"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(e.target.value as ExerciseDifficulty)
                }
                disabled={isLoading}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <textarea
              id="description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (ms)</Label>
              <Input
                id="duration"
                type="number"
                min="1000"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 60000)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bpm">BPM</Label>
              <Input
                id="bpm"
                type="number"
                min="40"
                max="300"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value) || 120)}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="C"
                disabled={isLoading}
              />
            </div>
          </div>

          {mode === 'edit' && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is-active"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                disabled={isLoading}
              />
              <Label htmlFor="is-active">Exercise is active</Label>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Epic 3 YouTube Integration */}
      <Card>
        <CardHeader>
          <CardTitle>YouTube Integration (Epic 3)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="youtube-video-id">YouTube Video ID</Label>
            <Input
              id="youtube-video-id"
              value={youtubeVideoId}
              onChange={(e) => setYoutubeVideoId(e.target.value)}
              placeholder="dQw4w9WgXcQ"
              disabled={isLoading}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-timestamp">Start Timestamp (seconds)</Label>
              <Input
                id="start-timestamp"
                type="number"
                min="0"
                value={startTimestamp}
                onChange={(e) =>
                  setStartTimestamp(parseInt(e.target.value) || 0)
                }
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-timestamp">End Timestamp (seconds)</Label>
              <Input
                id="end-timestamp"
                type="number"
                min="0"
                value={endTimestamp}
                onChange={(e) => setEndTimestamp(parseInt(e.target.value) || 0)}
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="teaching-summary">Teaching Summary</Label>
            <textarea
              id="teaching-summary"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
              value={teachingSummary}
              onChange={(e) => setTeachingSummary(e.target.value)}
              placeholder="Key teaching points and takeaways..."
              disabled={isLoading}
            />
          </div>

          {/* Chord Progression */}
          <div className="space-y-2">
            <Label>Chord Progression</Label>
            <div className="flex gap-2">
              <Input
                value={newChord}
                onChange={(e) => setNewChord(e.target.value)}
                placeholder="Add chord..."
                disabled={isLoading}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddChord}
                disabled={!newChord.trim() || isLoading}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {chordProgression.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {chordProgression.map((chord, index) => (
                  <Badge
                    key={index}
                    variant="secondary"
                    className="cursor-pointer"
                    onClick={() => handleRemoveChord(index)}
                  >
                    {chord} ×
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Epic 4 Notes Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Notes Management (Epic 4 Compatible)</CardTitle>
            <div className="flex gap-2">
              <Button
                onClick={() =>
                  setShowAdvancedProperties(!showAdvancedProperties)
                }
                variant="outline"
                size="sm"
              >
                {showAdvancedProperties ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
                {showAdvancedProperties ? 'Hide' : 'Show'} Advanced
              </Button>
              <Button onClick={handleAddNote} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Add Note
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {notes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No notes added yet. Click "Add Note" to get started.
            </div>
          ) : (
            <div className="space-y-4">
              {notes.map((note, index) => (
                <div key={note.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Note {index + 1}</h4>
                    <Button
                      onClick={() => handleRemoveNote(index)}
                      variant="outline"
                      size="sm"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Basic Note Properties */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div>
                      <Label>Fret</Label>
                      <Input
                        type="number"
                        min="0"
                        max="24"
                        value={note.fret}
                        onChange={(e) =>
                          handleNotePropertyChange(
                            index,
                            'fret',
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>String</Label>
                      <Input
                        type="number"
                        min="1"
                        max="6"
                        value={note.string}
                        onChange={(e) =>
                          handleNotePropertyChange(
                            index,
                            'string',
                            parseInt(e.target.value) || 1,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Time (ms)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={note.timestamp}
                        onChange={(e) =>
                          handleNotePropertyChange(
                            index,
                            'timestamp',
                            parseInt(e.target.value) || 0,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Duration (ms)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={note.duration}
                        onChange={(e) =>
                          handleNotePropertyChange(
                            index,
                            'duration',
                            parseInt(e.target.value) || 500,
                          )
                        }
                      />
                    </div>
                    <div>
                      <Label>Note</Label>
                      <Input
                        type="text"
                        value={note.note}
                        onChange={(e) =>
                          handleNotePropertyChange(
                            index,
                            'note',
                            e.target.value || 'C',
                          )
                        }
                        placeholder="C, D#, F..."
                      />
                    </div>
                  </div>

                  {/* Epic 4 Advanced Technique Properties */}
                  {showAdvancedProperties && (
                    <div className="border-t pt-3 space-y-3">
                      <h5 className="font-medium text-sm">Epic 4 Techniques</h5>

                      {/* Technique Toggles */}
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                        {[
                          'hammer_on',
                          'pull_off',
                          'slide_up',
                          'slide_down',
                          'bend',
                          'vibrato',
                          'slap',
                          'pop',
                          'tap',
                          'harmonic',
                        ].map((technique) => (
                          <div
                            key={technique}
                            className="flex items-center space-x-2"
                          >
                            <input
                              type="checkbox"
                              id={`${index}-${technique}`}
                              checked={
                                note.techniques?.includes(
                                  technique as TechniqueType,
                                ) || false
                              }
                              onChange={() =>
                                handleTechniqueToggle(
                                  index,
                                  technique as TechniqueType,
                                )
                              }
                            />
                            <Label
                              htmlFor={`${index}-${technique}`}
                              className="text-xs"
                            >
                              {technique.replace('_', ' ')}
                            </Label>
                          </div>
                        ))}
                      </div>

                      {/* Technique-specific Properties */}
                      {note.techniques?.includes('bend') && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Bend Target Pitch</Label>
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={note.bend_target_pitch || 'half_step'}
                              onChange={(e) =>
                                handleNotePropertyChange(
                                  index,
                                  'bend_target_pitch',
                                  e.target.value as 'half_step' | 'full_step',
                                )
                              }
                            >
                              <option value="half_step">Half Step</option>
                              <option value="full_step">Full Step</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {note.techniques?.includes('vibrato') && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Vibrato Intensity</Label>
                            <select
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              value={note.vibrato_intensity || 'light'}
                              onChange={(e) =>
                                handleNotePropertyChange(
                                  index,
                                  'vibrato_intensity',
                                  e.target.value as
                                    | 'light'
                                    | 'medium'
                                    | 'heavy',
                                )
                              }
                            >
                              <option value="light">Light</option>
                              <option value="medium">Medium</option>
                              <option value="heavy">Heavy</option>
                            </select>
                          </div>
                        </div>
                      )}

                      {(note.techniques?.includes('hammer_on') ||
                        note.techniques?.includes('pull_off') ||
                        note.techniques?.includes('slide_up') ||
                        note.techniques?.includes('slide_down')) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Target Note ID</Label>
                            <Input
                              value={note.target_note_id || ''}
                              onChange={(e) =>
                                handleNotePropertyChange(
                                  index,
                                  'target_note_id',
                                  e.target.value,
                                )
                              }
                              placeholder="Target note ID..."
                            />
                          </div>
                          {(note.techniques?.includes('slide_up') ||
                            note.techniques?.includes('slide_down')) && (
                            <div>
                              <Label>Slide to Fret</Label>
                              <Input
                                type="number"
                                min="0"
                                max="24"
                                value={note.slide_to_fret || 0}
                                onChange={(e) =>
                                  handleNotePropertyChange(
                                    index,
                                    'slide_to_fret',
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {note.techniques?.includes('harmonic') && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Harmonic Note</Label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                id={`${index}-is-harmonic`}
                                checked={note.is_harmonic || false}
                                onChange={(e) =>
                                  handleNotePropertyChange(
                                    index,
                                    'is_harmonic',
                                    e.target.checked,
                                  )
                                }
                              />
                              <Label
                                htmlFor={`${index}-is-harmonic`}
                                className="text-sm"
                              >
                                Enable harmonic
                              </Label>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
