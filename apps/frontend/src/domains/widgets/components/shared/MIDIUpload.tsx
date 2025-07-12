'use client';

import React, { useState, useRef, useCallback } from 'react';
import {
  Upload,
  Music,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileAudio,
} from 'lucide-react';
import {
  MIDIFileParser,
  DEFAULT_MIDI_UPLOAD_CONFIG,
  type MIDIFileParsingResult,
  type Exercise,
} from '@bassnotion/contracts';

interface MIDIUploadProps {
  onFileUploaded: (exercise: Exercise) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

interface UploadState {
  status: 'idle' | 'parsing' | 'success' | 'error';
  progress: number;
  message: string;
  fileName?: string;
  parsingResult?: MIDIFileParsingResult;
}

export function MIDIUpload({
  onFileUploaded,
  onError,
  disabled = false,
  className = '',
}: MIDIUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    message: 'Click to upload or drag and drop',
  });

  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const midiParser = useRef(new MIDIFileParser());

  const validateFile = (file: File): boolean => {
    // Check file extension
    const validExtensions = DEFAULT_MIDI_UPLOAD_CONFIG.allowedExtensions;
    const fileExtension = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some((ext) =>
      fileExtension.endsWith(ext),
    );

    if (!hasValidExtension) {
      onError(`Please select a MIDI file (${validExtensions.join(', ')})`);
      return false;
    }

    // Check file size
    if (file.size > DEFAULT_MIDI_UPLOAD_CONFIG.maxFileSize) {
      const maxSizeMB = DEFAULT_MIDI_UPLOAD_CONFIG.maxFileSize / (1024 * 1024);
      onError(`Please select a MIDI file smaller than ${maxSizeMB}MB`);
      return false;
    }

    return true;
  };

  const processFile = async (file: File) => {
    if (!validateFile(file)) return;

    setUploadState({
      status: 'parsing',
      progress: 10,
      message: 'Reading MIDI file...',
      fileName: file.name,
    });

    try {
      // Read file as ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();

      setUploadState((prev) => ({
        ...prev,
        progress: 30,
        message: 'Parsing MIDI structure...',
      }));

      // Parse MIDI file
      const parsingResult = await midiParser.current.parseFile(
        arrayBuffer,
        file.name,
      );

      if (!parsingResult.success) {
        throw new Error(
          `MIDI parsing failed: ${parsingResult.errors.join(', ')}`,
        );
      }

      setUploadState((prev) => ({
        ...prev,
        progress: 60,
        message: 'Converting to bass exercise...',
        parsingResult,
      }));

      // Check if we have a bass exercise
      if (!parsingResult.exercise) {
        throw new Error(
          'No bass track found in MIDI file. Try a MIDI file with bass content.',
        );
      }

      setUploadState((prev) => ({
        ...prev,
        progress: 90,
        message: 'Finalizing conversion...',
      }));

      // Success!
      setUploadState({
        status: 'success',
        progress: 100,
        message: `Successfully converted MIDI file! Found ${parsingResult.exercise.notes.length} notes.`,
        fileName: file.name,
        parsingResult,
      });

      // Notify parent component
      onFileUploaded(parsingResult.exercise);

      // Reset state after a delay
      setTimeout(() => {
        setUploadState({
          status: 'idle',
          progress: 0,
          message: 'Click to upload or drag and drop',
        });
      }, 3000);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';

      setUploadState({
        status: 'error',
        progress: 0,
        message: errorMessage,
        fileName: file.name,
      });

      onError(errorMessage);

      // Reset state after a delay
      setTimeout(() => {
        setUploadState({
          status: 'idle',
          progress: 0,
          message: 'Click to upload or drag and drop',
        });
      }, 5000);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleClick = () => {
    if (disabled || uploadState.status === 'parsing') return;
    fileInputRef.current?.click();
  };

  // Drag and drop handlers
  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!disabled && uploadState.status !== 'parsing') {
        setIsDragOver(true);
      }
    },
    [disabled, uploadState.status],
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      if (disabled || uploadState.status === 'parsing') return;

      const files = Array.from(e.dataTransfer.files);
      const file = files[0];

      if (file) {
        processFile(file);
      }
    },
    [disabled, uploadState.status],
  );

  const getIcon = () => {
    switch (uploadState.status) {
      case 'parsing':
        return <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-8 h-8 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-8 h-8 text-red-500" />;
      default:
        return <FileAudio className="w-8 h-8 text-purple-400" />;
    }
  };

  const getContainerClasses = () => {
    const baseClasses = `
      relative w-full min-h-[200px] border-2 border-dashed rounded-lg 
      flex flex-col items-center justify-center p-6 text-center
      transition-all duration-200 ease-in-out
    `;

    if (disabled) {
      return `${baseClasses} border-gray-200 bg-gray-50 cursor-not-allowed opacity-50`;
    }

    if (uploadState.status === 'parsing') {
      return `${baseClasses} border-blue-300 bg-blue-50 cursor-wait`;
    }

    if (uploadState.status === 'success') {
      return `${baseClasses} border-green-300 bg-green-50`;
    }

    if (uploadState.status === 'error') {
      return `${baseClasses} border-red-300 bg-red-50`;
    }

    if (isDragOver) {
      return `${baseClasses} border-purple-400 bg-purple-50 scale-[1.02]`;
    }

    return `${baseClasses} border-purple-300 hover:border-purple-400 hover:bg-purple-50 cursor-pointer`;
  };

  const renderFileDetails = () => {
    const { parsingResult } = uploadState;
    if (!parsingResult || uploadState.status !== 'success') return null;

    return (
      <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200 text-left">
        <h4 className="font-semibold text-gray-800 mb-2">MIDI File Details</h4>
        <div className="grid grid-cols-2 gap-2 text-sm text-gray-600">
          <div>Format: {parsingResult.metadata.format.toUpperCase()}</div>
          <div>Tracks: {parsingResult.metadata.trackCount}</div>
          <div>
            Duration: {Math.round(parsingResult.metadata.durationSeconds)}s
          </div>
          <div>Notes: {parsingResult.conversionStats.convertedNotes}</div>
          {parsingResult.bassTrack && (
            <>
              <div className="col-span-2 font-medium mt-2">
                Bass Track Found:
              </div>
              <div>Channel: {parsingResult.bassTrack.channel}</div>
              <div>
                Confidence:{' '}
                {Math.round(parsingResult.bassTrack.confidence * 100)}%
              </div>
            </>
          )}
        </div>
        {parsingResult.warnings.length > 0 && (
          <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <div className="text-xs font-semibold text-yellow-800">
              Warnings:
            </div>
            {parsingResult.warnings.map((warning, index) => (
              <div key={index} className="text-xs text-yellow-700">
                {warning}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      <div
        className={getContainerClasses()}
        onClick={handleClick}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {/* Upload Icon */}
        <div className="mb-4">{getIcon()}</div>

        {/* Upload Message */}
        <div className="mb-4">
          <p className="text-lg font-medium text-gray-700 mb-2">
            {uploadState.fileName || 'MIDI File Upload'}
          </p>
          <p className="text-sm text-gray-500">{uploadState.message}</p>
        </div>

        {/* Progress Bar */}
        {uploadState.status === 'parsing' && (
          <div className="w-full max-w-xs mb-4">
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadState.progress}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {uploadState.progress}%
            </p>
          </div>
        )}

        {/* Upload Button */}
        {uploadState.status === 'idle' && (
          <div className="flex items-center justify-center">
            <Upload className="w-5 h-5 mr-2 text-purple-500" />
            <span className="text-sm text-purple-600">
              Choose MIDI file or drag here
            </span>
          </div>
        )}

        {/* File Format Info */}
        {uploadState.status === 'idle' && (
          <p className="text-xs text-gray-400 mt-4">
            Supports .mid and .midi files (max{' '}
            {DEFAULT_MIDI_UPLOAD_CONFIG.maxFileSize / (1024 * 1024)}MB)
          </p>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={DEFAULT_MIDI_UPLOAD_CONFIG.allowedExtensions.join(',')}
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploadState.status === 'parsing'}
        />
      </div>

      {/* File Details */}
      {renderFileDetails()}
    </div>
  );
}
