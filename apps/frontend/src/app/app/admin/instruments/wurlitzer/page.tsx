'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import wurlitzerConfig from '@/domains/playback/data/instruments/wurlitzer/wurlitzer-piano.json';

interface VelocityRange {
  min: number;
  max: number;
  layer: string;
}

interface NoteConfig {
  note: string;
  ranges: VelocityRange[];
}

export default function WurlitzerAdminPage() {
  const [config, setConfig] = useState<NoteConfig[]>([]);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    // Load configuration from JSON
    const noteConfigs: NoteConfig[] = Object.entries(
      wurlitzerConfig.perNoteVelocityRanges as Record<string, VelocityRange[]>,
    ).map(([note, ranges]) => ({
      note,
      ranges: ranges.map((r) => ({ ...r })),
    }));
    setConfig(noteConfigs);
    if (noteConfigs.length > 0) {
      setSelectedNote(noteConfigs[0].note);
    }
  }, []);

  const selectedNoteConfig = config.find((c) => c.note === selectedNote);

  const updateVelocityRange = (
    layerIndex: number,
    field: 'min' | 'max',
    value: number,
  ) => {
    if (!selectedNote) return;

    setConfig((prev) =>
      prev.map((noteConfig) => {
        if (noteConfig.note === selectedNote) {
          const newRanges = [...noteConfig.ranges];
          newRanges[layerIndex] = {
            ...newRanges[layerIndex],
            [field]: Math.max(0, Math.min(127, value)),
          };
          return { ...noteConfig, ranges: newRanges };
        }
        return noteConfig;
      }),
    );
    setHasChanges(true);
  };

  const saveConfiguration = async () => {
    const configToSave = Object.fromEntries(
      config.map(({ note, ranges }) => [note, ranges]),
    );

    // Create downloadable JSON file
    const blob = new Blob([JSON.stringify(configToSave, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'wurlitzer-velocity-config.json';
    a.click();
    URL.revokeObjectURL(url);

    setHasChanges(false);
    alert(
      'Configuration downloaded! Replace the perNoteVelocityRanges in wurlitzer-piano.json',
    );
  };

  const resetToDefaults = () => {
    const noteConfigs: NoteConfig[] = Object.entries(
      wurlitzerConfig.perNoteVelocityRanges as Record<string, VelocityRange[]>,
    ).map(([note, ranges]) => ({
      note,
      ranges: ranges.map((r) => ({ ...r })),
    }));
    setConfig(noteConfigs);
    setHasChanges(false);
  };

  const getLayerColor = (layer: string) => {
    const colors: Record<string, string> = {
      v1: 'bg-blue-100 text-blue-800 border-blue-300',
      v2: 'bg-green-100 text-green-800 border-green-300',
      v3: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      v4: 'bg-orange-100 text-orange-800 border-orange-300',
      v5: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[layer] || 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const getNotesByOctave = () => {
    const octaves: Record<string, string[]> = {};
    config.forEach(({ note }) => {
      const octave = note.match(/\d+$/)?.[0] || '0';
      if (!octaves[octave]) octaves[octave] = [];
      octaves[octave].push(note);
    });
    return octaves;
  };

  const octaves = getNotesByOctave();

  return (
    <>
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">
            Wurlitzer Velocity Configuration
          </h1>
          <p className="text-gray-600">
            Fine-tune velocity thresholds for each note. Each note can have 3-5
            velocity layers.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Note Selector */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Select Note</CardTitle>
              <CardDescription>
                Choose a note to edit its velocity ranges
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {Object.entries(octaves)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .map(([octave, notes]) => (
                    <div key={octave}>
                      <div className="text-sm font-semibold text-gray-500 mb-2">
                        Octave {octave}
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {notes.map((note) => {
                          const noteConfig = config.find(
                            (c) => c.note === note,
                          );
                          const layerCount = noteConfig?.ranges.length || 0;
                          return (
                            <Button
                              key={note}
                              variant={
                                selectedNote === note ? 'default' : 'outline'
                              }
                              size="sm"
                              onClick={() => setSelectedNote(note)}
                              className="relative"
                            >
                              {note}
                              <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                {layerCount}
                              </span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Velocity Range Editor */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                {selectedNote
                  ? `Velocity Ranges for ${selectedNote}`
                  : 'Select a note'}
              </CardTitle>
              <CardDescription>
                Adjust min/max values for each velocity layer (0-127)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedNoteConfig ? (
                <div className="space-y-6">
                  {/* Visual Velocity Bar */}
                  <div className="h-16 flex rounded overflow-hidden border-2 border-gray-300">
                    {selectedNoteConfig.ranges.map((range, idx) => {
                      const width = ((range.max - range.min + 1) / 128) * 100;
                      return (
                        <div
                          key={idx}
                          className={`flex items-center justify-center text-sm font-semibold ${getLayerColor(
                            range.layer,
                          )} border-r last:border-r-0`}
                          style={{ width: `${width}%` }}
                        >
                          {range.layer}
                          <br />
                          {range.min}-{range.max}
                        </div>
                      );
                    })}
                  </div>

                  {/* Range Inputs */}
                  <div className="space-y-4">
                    {selectedNoteConfig.ranges.map((range, idx) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-lg border-2 ${getLayerColor(range.layer)}`}
                      >
                        <div className="font-semibold mb-3 text-lg">
                          {range.layer.toUpperCase()}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor={`min-${idx}`}>
                              Minimum Velocity
                            </Label>
                            <Input
                              id={`min-${idx}`}
                              type="number"
                              min={0}
                              max={127}
                              value={range.min}
                              onChange={(e) =>
                                updateVelocityRange(
                                  idx,
                                  'min',
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              className="mt-1"
                            />
                          </div>
                          <div>
                            <Label htmlFor={`max-${idx}`}>
                              Maximum Velocity
                            </Label>
                            <Input
                              id={`max-${idx}`}
                              type="number"
                              min={0}
                              max={127}
                              value={range.max}
                              onChange={(e) =>
                                updateVelocityRange(
                                  idx,
                                  'max',
                                  parseInt(e.target.value) || 0,
                                )
                              }
                              className="mt-1"
                            />
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-gray-600">
                          Range span: {range.max - range.min + 1} velocity steps
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      onClick={saveConfiguration}
                      disabled={!hasChanges}
                      className="flex-1"
                    >
                      Download Configuration
                    </Button>
                    <Button
                      variant="outline"
                      onClick={resetToDefaults}
                      disabled={!hasChanges}
                      className="flex-1"
                    >
                      Reset to Defaults
                    </Button>
                  </div>

                  {hasChanges && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-3 text-sm text-yellow-800">
                      You have unsaved changes. Click "Download Configuration"
                      to export your settings.
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center text-gray-500 py-12">
                  Select a note from the left panel to edit its velocity ranges
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Info Panel */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Configuration Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">3-Layer Notes</h4>
                <p className="text-gray-600">
                  High register notes (C3, D4, F4, G4, G#4, and C5-C6) have
                  softer dynamics and use only 3 velocity layers.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">4-Layer Notes</h4>
                <p className="text-gray-600">
                  Mid-range notes with moderate dynamic range. Most common in
                  the middle octaves.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">5-Layer Notes</h4>
                <p className="text-gray-600">
                  Low register notes with the fullest dynamic range, capturing
                  subtle tonal variations.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
