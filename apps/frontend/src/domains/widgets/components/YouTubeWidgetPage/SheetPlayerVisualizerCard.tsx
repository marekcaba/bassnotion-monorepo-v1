'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Music, RotateCw } from 'lucide-react';
import { SyncedWidget } from '../base/SyncedWidget.js';
import type { SyncedWidgetRenderProps } from '../base/SyncedWidget.js';

interface Note {
  id: number;
  pitch: string;
  position: number;
  isActive: boolean;
  type: 'quarter' | 'half' | 'whole' | 'eighth';
}

const mockNotes: Note[] = [
  { id: 1, pitch: 'E2', position: 1, isActive: false, type: 'quarter' },
  { id: 2, pitch: 'G2', position: 2, isActive: true, type: 'quarter' },
  { id: 3, pitch: 'A2', position: 3, isActive: false, type: 'half' },
  { id: 4, pitch: 'B2', position: 4, isActive: false, type: 'quarter' },
  { id: 5, pitch: 'C3', position: 5, isActive: false, type: 'quarter' },
  { id: 6, pitch: 'D3', position: 6, isActive: false, type: 'eighth' },
  { id: 7, pitch: 'E3', position: 7, isActive: false, type: 'quarter' },
  { id: 8, pitch: 'F3', position: 8, isActive: false, type: 'half' },
];

const staffLines = [
  { note: 'A2', yPosition: 80 },
  { note: 'F2', yPosition: 70 },
  { note: 'D2', yPosition: 60 },
  { note: 'B1', yPosition: 50 },
  { note: 'G1', yPosition: 40 },
];

export function SheetPlayerVisualizerCard() {
  return (
    <SyncedWidget
      widgetId="sheet-player"
      widgetName="Sheet Music Player"
      debugMode={process.env.NODE_ENV === 'development'}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <SheetPlayerVisualizerCardContent syncProps={syncProps} />
      )}
    </SyncedWidget>
  );
}

interface SheetPlayerVisualizerCardContentProps {
  syncProps: SyncedWidgetRenderProps;
}

function SheetPlayerVisualizerCardContent({
  syncProps,
}: SheetPlayerVisualizerCardContentProps) {
  const [currentPosition, setCurrentPosition] = useState(2);
  const [isLooping, setIsLooping] = useState(true);
  const [tempo] = useState(100);

  // Sync with global playback state for timeline position
  useEffect(() => {
    const globalCurrentTime = syncProps.currentTime;
    if (globalCurrentTime >= 0) {
      // Convert time to sheet music position (simplified mapping)
      const newPosition = Math.floor((globalCurrentTime % 8000) / 1000) + 1;
      if (newPosition !== currentPosition) {
        setCurrentPosition(newPosition);
      }
    }
  }, [syncProps.currentTime, currentPosition]);

  // Sync tempo with global state
  useEffect(() => {
    const globalTempo = syncProps.tempo;
    if (globalTempo && globalTempo !== tempo) {
      console.log(`🎼 SheetPlayer: Tempo synced to ${globalTempo} BPM`);
      // Update local tempo state if needed
    }
  }, [syncProps.tempo, tempo]);

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

  const getNoteYPosition = (pitch: string) => {
    // Simple mapping for bass clef positions
    const noteMap: { [key: string]: number } = {
      E2: 85,
      G2: 75,
      A2: 70,
      B2: 65,
      C3: 60,
      D3: 55,
      E3: 50,
      F3: 45,
    };
    return noteMap[pitch] || 60;
  };

  const getNoteSymbol = (type: string) => {
    switch (type) {
      case 'whole':
        return '○';
      case 'half':
        return '♩';
      case 'quarter':
        return '♪';
      case 'eighth':
        return '♫';
      default:
        return '♪';
    }
  };

  return (
    <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
              <Music className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">
                🎼 Sheet Music Player
              </CardTitle>
              <p className="text-slate-400">
                Music notation and tablature display
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 text-slate-300 text-sm">
              <Music className="w-4 h-4" />
              <span>♩ = {tempo}</span>
              <Button
                size="sm"
                variant="ghost"
                className={`text-slate-300 hover:text-white ${isLooping ? 'text-blue-400' : ''}`}
                // TODO: Review non-null assertion - consider null safety
                onClick={() => setIsLooping(!isLooping)}
              >
                <RotateCw className="w-4 h-4" />
              </Button>
              <span className="text-xs">Loop</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-6">
        {/* Sheet Music Container */}
        <div className="bg-gradient-to-b from-slate-900/40 to-slate-800/60 rounded-xl p-6 border border-slate-600/30">
          {/* Staff Container */}
          <div className="relative h-32 mb-6">
            {/* Staff Lines */}
            {staffLines.map((line, index) => (
              <div
                key={index}
                className="absolute w-full h-px bg-slate-400/60"
                style={{ top: `${line.yPosition}%` }}
              />
            ))}

            {/* Bass Clef Symbol */}
            <div className="absolute left-2 top-1/2 transform -translate-y-1/2">
              <div className="text-3xl text-slate-300 font-bold">𝄢</div>
            </div>

            {/* Notes */}
            <div className="absolute inset-0 ml-16">
              {mockNotes.map((note, index) => (
                <div
                  key={note.id}
                  className="absolute transition-all duration-200"
                  style={{
                    left: `${index * 12 + index * 2}%`,
                    top: `${getNoteYPosition(note.pitch)}%`,
                    transform: 'translateY(-50%)',
                  }}
                >
                  {/* Note Head */}
                  <div
                    className={`
                      w-6 h-4 rounded-full flex items-center justify-center text-lg font-bold
                      transition-all duration-300
                      ${
                        note.position === currentPosition
                          ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/50 scale-110'
                          : note.isActive
                            ? 'bg-slate-600 text-slate-200'
                            : 'bg-slate-700 text-slate-400'
                      }
                    `}
                  >
                    {getNoteSymbol(note.type)}
                  </div>

                  {/* Note Stem (for quarter and eighth notes) */}
                  {(note.type === 'quarter' || note.type === 'eighth') && (
                    <div
                      className={`
                        absolute w-px h-6 left-1/2 transform -translate-x-1/2
                        ${
                          note.position === currentPosition
                            ? 'bg-blue-500'
                            : 'bg-slate-400'
                        }
                      `}
                      style={{ top: '-24px' }}
                    />
                  )}

                  {/* Note Label */}
                  <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2">
                    <span className="text-xs text-slate-400 font-mono">
                      {note.pitch}
                    </span>
                  </div>
                </div>
              ))}

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 w-px bg-red-500 shadow-lg shadow-red-500/50 transition-all duration-300"
                style={{
                  left: `${(currentPosition - 1) * 12 + (currentPosition - 1) * 2 + 3}%`,
                }}
              />
            </div>
          </div>

          {/* Tablature Section */}
          <div className="border-t border-slate-600/30 pt-4">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-sm font-semibold text-slate-300">
                Tablature
              </span>
              <div className="flex-1 h-px bg-slate-600/30" />
            </div>

            {/* Tab Lines (4 strings for bass) */}
            <div className="relative h-16">
              {[0, 1, 2, 3].map((string) => (
                <div
                  key={string}
                  className="absolute w-full h-px bg-slate-500/40"
                  style={{ top: `${string * 25 + 12}%` }}
                />
              ))}

              {/* String Labels */}
              <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-around text-xs text-slate-400 font-mono pr-4">
                <span>G</span>
                <span>D</span>
                <span>A</span>
                <span>E</span>
              </div>

              {/* Fret Numbers */}
              <div className="absolute inset-0 ml-8">
                {mockNotes.map((note, index) => (
                  <div
                    key={note.id}
                    className="absolute"
                    style={{
                      left: `${index * 12 + index * 2}%`,
                      top: '37%', // Position on A string for demo
                    }}
                  >
                    <div
                      className={`
                        w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                        ${
                          note.position === currentPosition
                            ? 'bg-red-500 text-white'
                            : 'bg-slate-600 text-slate-200'
                        }
                      `}
                    >
                      {(index % 12) + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-4">
            <Button
              size="sm"
              className="bg-blue-500 hover:bg-blue-600"
              onClick={() =>
                setCurrentPosition((prev) => Math.max(1, prev - 1))
              }
            >
              Previous
            </Button>
            <Button
              size="sm"
              className="bg-blue-500 hover:bg-blue-600"
              onClick={() =>
                setCurrentPosition((prev) =>
                  Math.min(mockNotes.length, prev + 1),
                )
              }
            >
              Next
            </Button>
          </div>

          <div className="text-sm text-slate-400">
            Position: {currentPosition} / {mockNotes.length}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
