'use client';

import React from 'react';
import { Exercise } from '@/domains/exercises/entities/exercise.entity';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Play, Pause, Music, Clock, Activity } from 'lucide-react';

interface ExerciseCardProps {
  exercise: Exercise;
  isSelected?: boolean;
  isPlaying?: boolean;
  onSelect?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  editable?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
}

export function ExerciseCard({
  exercise,
  isSelected = false,
  isPlaying = false,
  onSelect,
  onPlay,
  onPause,
  editable = false,
  onEdit,
  onDelete,
  className = '',
}: ExerciseCardProps) {
  const handlePlayPause = () => {
    if (isPlaying && onPause) {
      onPause();
    } else if (onPlay) {
      onPlay();
    }
  };

  return (
    <Card
      className={`exercise-card cursor-pointer transition-all ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      } ${className}`}
      onClick={onSelect}
    >
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-lg">{exercise.title}</CardTitle>
          {editable && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit?.();
                }}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-500 hover:text-red-600"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
              >
                Delete
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 mb-3">{exercise.description}</p>

        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1">
            <Activity className="w-4 h-4" />
            <span>{exercise.bpm} BPM</span>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            <span>{exercise.getDurationInMinutes()} min</span>
          </div>

          <div className="flex items-center gap-1">
            <Music className="w-4 h-4" />
            <span>{exercise.key}</span>
          </div>
        </div>

        <div className="flex items-center justify-between mt-3">
          <Badge
            variant={
              exercise.difficulty.value === 'beginner' ? 'default' :
              exercise.difficulty.value === 'intermediate' ? 'secondary' :
              'destructive'
            }
          >
            {exercise.difficulty.value}
          </Badge>

          {(onPlay || onPause) && (
            <Button
              size="sm"
              variant={isSelected ? 'default' : 'outline'}
              onClick={(e) => {
                e.stopPropagation();
                handlePlayPause();
              }}
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4 mr-1" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-1" />
                  Play
                </>
              )}
            </Button>
          )}
        </div>

        {exercise.hasMidiFile() && (
          <div className="mt-2 text-xs text-green-600">
            ✓ MIDI file attached
          </div>
        )}
      </CardContent>
    </Card>
  );
}