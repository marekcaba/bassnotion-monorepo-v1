'use client';

import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { AlertCircle, CheckCircle, Info, Trash2, Plus } from 'lucide-react';
import type {
  DrumHit,
  MidiDrumType,
  DrumPatternStats,
  DrumPatternValidation,
} from '@bassnotion/contracts';
import { DRUM_DISPLAY_NAMES, DRUM_COLORS } from '@bassnotion/contracts';

interface DrumPatternEditorProps {
  isOpen: boolean;
  onClose: () => void;
  drumPattern: DrumHit[];
  stats: DrumPatternStats;
  validation: DrumPatternValidation;
  onSave: (drumPattern: DrumHit[]) => void;
}

/**
 * Drum Pattern Editor Modal
 * Similar to bass fretboard editor but for drum patterns
 * Allows admin to review and edit auto-converted drum hits
 */
export function DrumPatternEditor({
  isOpen,
  onClose,
  drumPattern: initialPattern,
  stats,
  validation,
  onSave,
}: DrumPatternEditorProps) {
  const [drumPattern, setDrumPattern] = useState<DrumHit[]>(initialPattern);
  const [selectedHitId, setSelectedHitId] = useState<string | null>(null);

  // Group hits by measure for easier editing
  const hitsByMeasure = useMemo(() => {
    const grouped = new Map<number, DrumHit[]>();
    for (const hit of drumPattern) {
      const measure = hit.position.measure;
      if (!grouped.has(measure)) {
        grouped.set(measure, []);
      }
      grouped.get(measure)!.push(hit);
    }
    // Sort hits within each measure by beat and subdivision
    for (const [_, hits] of grouped) {
      hits.sort((a, b) => {
        if (a.position.beat !== b.position.beat) {
          return a.position.beat - b.position.beat;
        }
        return a.position.subdivision - b.position.subdivision;
      });
    }
    return grouped;
  }, [drumPattern]);

  // Update a drum hit's type
  const updateDrumType = useCallback((hitId: string, newDrum: MidiDrumType) => {
    setDrumPattern((prev) =>
      prev.map((hit) => (hit.id === hitId ? { ...hit, drum: newDrum } : hit)),
    );
  }, []);

  // Delete a drum hit
  const deleteHit = useCallback(
    (hitId: string) => {
      setDrumPattern((prev) => prev.filter((hit) => hit.id !== hitId));
      if (selectedHitId === hitId) {
        setSelectedHitId(null);
      }
    },
    [selectedHitId],
  );

  // Handle save
  const handleSave = useCallback(() => {
    onSave(drumPattern);
    onClose();
  }, [drumPattern, onSave, onClose]);

  // Drum type options for select
  const drumTypeOptions: MidiDrumType[] = [
    'kick',
    'snare',
    'snare_rimshot',
    'hihat_closed',
    'hihat_open',
    'hihat_pedal',
    'crash',
    'ride',
    'ride_bell',
    'tom_low',
    'tom_mid',
    'tom_high',
    'floor_tom',
    'cowbell',
    'tambourine',
    'clap',
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Review Drum Pattern</DialogTitle>
          <div className="text-sm text-muted-foreground">
            Auto-converted from MIDI. Review and adjust drum assignments if
            needed.
          </div>
        </DialogHeader>

        {/* Stats Bar */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
          <div>
            <div className="text-sm text-muted-foreground">Total Hits</div>
            <div className="text-2xl font-bold">{stats.totalHits}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Unique Drums</div>
            <div className="text-2xl font-bold">{stats.uniqueDrums}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Measures</div>
            <div className="text-2xl font-bold">{stats.measureCount}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Unknown</div>
            <div
              className={`text-2xl font-bold ${stats.unknownCount > 0 ? 'text-red-500' : 'text-green-500'}`}
            >
              {stats.unknownCount}
            </div>
          </div>
        </div>

        {/* Validation Warnings */}
        {validation.warnings.length > 0 && (
          <div className="space-y-2">
            {validation.warnings.map((warning, index) => (
              <div
                key={index}
                className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded"
              >
                <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">{warning}</div>
              </div>
            ))}
          </div>
        )}

        {/* Drum Hits Grid */}
        <div className="flex-1 pr-4 overflow-y-auto max-h-[500px]">
          <div className="space-y-6">
            {Array.from(hitsByMeasure.entries())
              .sort(([a], [b]) => a - b)
              .map(([measure, hits]) => (
                <div key={measure} className="space-y-2">
                  <div className="font-semibold text-lg">Measure {measure}</div>
                  <div className="grid gap-2">
                    {hits.map((hit) => (
                      <div
                        key={hit.id}
                        className={`flex items-center gap-3 p-3 rounded border transition-colors ${
                          selectedHitId === hit.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedHitId(hit.id)}
                      >
                        {/* Drum Color Indicator */}
                        <div
                          className="w-4 h-4 rounded-full flex-shrink-0"
                          style={{ backgroundColor: DRUM_COLORS[hit.drum] }}
                        />

                        {/* Position */}
                        <div className="text-sm text-muted-foreground w-32">
                          Beat {hit.position.beat}.{hit.position.subdivision}
                        </div>

                        {/* Drum Type Selector */}
                        <Select
                          value={hit.drum}
                          onValueChange={(value) =>
                            updateDrumType(hit.id, value as MidiDrumType)
                          }
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {drumTypeOptions.map((drumType) => (
                              <SelectItem key={drumType} value={drumType}>
                                <div className="flex items-center gap-2">
                                  <div
                                    className="w-3 h-3 rounded-full"
                                    style={{
                                      backgroundColor: DRUM_COLORS[drumType],
                                    }}
                                  />
                                  {DRUM_DISPLAY_NAMES[drumType]}
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Velocity */}
                        <div className="text-sm text-muted-foreground">
                          Velocity: {hit.velocity}
                        </div>

                        {/* MIDI Note Reference */}
                        <div className="text-xs text-muted-foreground ml-auto">
                          MIDI {hit.midiNote}
                        </div>

                        {/* Delete Button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHit(hit.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Save Drum Pattern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
