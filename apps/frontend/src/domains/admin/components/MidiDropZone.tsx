'use client';

import React, { useState, useCallback, useRef } from 'react';
import { Upload, Music, Check, X, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';

interface MidiDropZoneProps {
  track: 'metronome' | 'drums' | 'bass' | 'harmony';
  exerciseId: string;
  onUpload?: (file: File, track: string) => Promise<void>;
  hasExistingFile?: boolean;
  className?: string;
}

export function MidiDropZone({
  track,
  exerciseId,
  onUpload,
  hasExistingFile = false,
  className = '',
}: MidiDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle');
  const [fileName, setFileName] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const validateMidiFile = (file: File): boolean => {
    const validExtensions = ['.mid', '.midi'];
    const extension = file.name
      .toLowerCase()
      .substring(file.name.lastIndexOf('.'));
    return validExtensions.includes(extension);
  };

  const processFile = async (file: File) => {
    if (!validateMidiFile(file)) {
      setUploadStatus('error');
      setFileName('Invalid file type. Please upload a MIDI file.');
      setTimeout(() => {
        setUploadStatus('idle');
        setFileName('');
      }, 3000);
      return;
    }

    setIsUploading(true);
    setFileName(file.name);
    setUploadStatus('idle');

    try {
      if (onUpload) {
        await onUpload(file, track);
      }
      setUploadStatus('success');
      setTimeout(() => {
        setUploadStatus('idle');
      }, 3000);
    } catch (error) {
      console.error('Upload failed:', error);
      setUploadStatus('error');
      setFileName('Upload failed. Please try again.');
      setTimeout(() => {
        setUploadStatus('idle');
        setFileName('');
      }, 3000);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        await processFile(files[0]);
      }
    },
    [onUpload, track],
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        await processFile(files[0]);
      }
    },
    [onUpload, track],
  );

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const getTrackLabel = () => {
    return track.charAt(0).toUpperCase() + track.slice(1);
  };

  const getTrackIcon = () => {
    switch (track) {
      case 'metronome':
        return '🎚️';
      case 'drums':
        return '🥁';
      case 'bass':
        return '🎸';
      case 'harmony':
        return '🎹';
      default:
        return '🎵';
    }
  };

  return (
    <Card
      className={`midi-drop-zone ${isDragging ? 'ring-2 ring-blue-500' : ''} ${className}`}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getTrackIcon()}</span>
            <h3 className="font-semibold">{getTrackLabel()}</h3>
          </div>
          {hasExistingFile && uploadStatus !== 'success' && (
            <Badge variant="success" className="bg-green-600">
              <Check className="w-3 h-3 mr-1" />
              Uploaded
            </Badge>
          )}
          {uploadStatus === 'success' && (
            <Badge variant="success" className="bg-green-600">
              <Check className="w-3 h-3 mr-1" />
              Success
            </Badge>
          )}
          {uploadStatus === 'error' && (
            <Badge variant="destructive">
              <X className="w-3 h-3 mr-1" />
              Error
            </Badge>
          )}
        </div>

        <div
          className={`
            border-2 border-dashed rounded-lg p-4 text-center cursor-pointer
            transition-colors
            ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-gray-600'}
            ${isUploading ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400'}
          `}
          onClick={!isUploading ? handleClick : undefined}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".mid,.midi"
            onChange={handleFileSelect}
            className="hidden"
            disabled={isUploading}
          />

          {isUploading ? (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-sm text-gray-400">Uploading...</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Upload className="w-8 h-8 text-gray-400" />
              <p className="text-sm text-gray-400">
                Drop MIDI file or click to browse
              </p>
              <p className="text-xs text-gray-500">
                Supports .mid and .midi files
              </p>
            </div>
          )}
        </div>

        {fileName && !isUploading && (
          <p className="text-sm mt-2 text-gray-400 truncate">{fileName}</p>
        )}
      </CardContent>
    </Card>
  );
}
