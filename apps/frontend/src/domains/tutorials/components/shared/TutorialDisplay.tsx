'use client';

import React from 'react';
import { Tutorial } from '@/domains/tutorials/entities/tutorial.entity';
import { Badge } from '@/shared/components/ui/badge';
import { Play } from 'lucide-react';

interface TutorialDisplayProps {
  tutorial: Tutorial;
  editable?: boolean;
  onUpdate?: (field: keyof Tutorial, value: any) => void;
  className?: string;
}

export function TutorialDisplay({
  tutorial,
  editable = false,
  onUpdate,
  className = '',
}: TutorialDisplayProps) {
  const handleFieldUpdate = (field: keyof Tutorial, value: string) => {
    if (editable && onUpdate) {
      onUpdate(field, value);
    }
  };

  if (editable) {
    return (
      <div className={`tutorial-display-editable ${className}`}>
        <div className="mb-6">
          <input
            type="text"
            className="text-3xl font-bold bg-transparent border-b-2 border-gray-300 focus:border-blue-500 outline-none w-full"
            value={tutorial.title}
            onChange={(e) => handleFieldUpdate('title', e.target.value)}
            placeholder="Tutorial Title"
          />
        </div>

        <div className="mb-4">
          <textarea
            className="text-gray-300 bg-transparent border border-gray-600 rounded p-2 w-full resize-none"
            value={tutorial.description}
            onChange={(e) => handleFieldUpdate('description', e.target.value)}
            placeholder="Tutorial Description"
            rows={3}
          />
        </div>

        <div className="flex items-center gap-4 mb-4">
          <input
            type="text"
            className="text-sm bg-transparent border border-gray-600 rounded px-2 py-1"
            value={tutorial.youtubeId}
            onChange={(e) => handleFieldUpdate('youtubeId', e.target.value)}
            placeholder="YouTube Video ID"
          />

          <select
            className="text-sm bg-gray-800 border border-gray-600 rounded px-2 py-1"
            value={tutorial.level.value}
            onChange={(e) => handleFieldUpdate('level', e.target.value)}
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <input
            type="text"
            className="text-sm bg-transparent border border-gray-600 rounded px-2 py-1"
            value={tutorial.authorName}
            onChange={(e) => handleFieldUpdate('authorName', e.target.value)}
            placeholder="Author Name"
          />
        </div>

        <div className="flex gap-2">
          {tutorial.tags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
          {editable && (
            <button className="text-xs text-blue-400 hover:text-blue-300">
              + Add Tag
            </button>
          )}
        </div>
      </div>
    );
  }

  // Read-only display (student view)
  return (
    <div className={`tutorial-display ${className}`}>
      <h1 className="text-3xl font-bold mb-4">{tutorial.title}</h1>
      <p className="text-gray-300 mb-4">{tutorial.description}</p>

      <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
        <span className="flex items-center gap-1">
          <Play className="w-4 h-4" />
          {tutorial.getDurationFormatted()}
        </span>
        <span>By {tutorial.authorName}</span>
        <Badge variant="outline" className="text-xs">
          {tutorial.level.value}
        </Badge>
      </div>

      {tutorial.tags.length > 0 && (
        <div className="flex gap-2">
          {tutorial.tags.map((tag, index) => (
            <Badge key={index} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}