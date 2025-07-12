'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Upload, Music, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface MusicXMLUploadProps {
  onFileUploaded: (exercise: any) => void;
  onError: (error: string) => void;
  disabled?: boolean;
  className?: string;
}

interface UploadState {
  status: 'idle' | 'parsing' | 'success' | 'error';
  progress: number;
  message: string;
  fileName?: string;
}

export function MusicXMLUpload({
  onFileUploaded,
  onError,
  disabled = false,
  className = '',
}: MusicXMLUploadProps) {
  const [uploadState, setUploadState] = useState<UploadState>({
    status: 'idle',
    progress: 0,
    message: 'Click to upload or drag and drop',
  });

  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): boolean => {
    // Check file extension
    const validExtensions = ['.xml', '.musicxml', '.mxl'];
    const fileExtension = file.name.toLowerCase();
    const hasValidExtension = validExtensions.some((ext) =>
      fileExtension.endsWith(ext),
    );

    if (!hasValidExtension) {
      onError('Please select a MusicXML file (.xml, .musicxml, or .mxl)');
      return false;
    }

    // Check file size (10MB limit for MusicXML files)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      onError('Please select a MusicXML file smaller than 10MB');
      return false;
    }

    return true;
  };

  const processFile = async (file: File) => {
    if (!validateFile(file)) return;

    setUploadState({
      status: 'parsing',
      progress: 10,
      message: 'Reading file...',
      fileName: file.name,
    });

    try {
      // For now, just simulate processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      setUploadState({
        status: 'success',
        progress: 100,
        message: 'MusicXML import functionality coming soon!',
        fileName: file.name,
      });

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
        return <Music className="w-8 h-8 text-gray-400" />;
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
      return `${baseClasses} border-blue-400 bg-blue-50 scale-[1.02]`;
    }

    return `${baseClasses} border-gray-300 hover:border-gray-400 hover:bg-gray-50 cursor-pointer`;
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
            {uploadState.fileName || 'MusicXML File Upload'}
          </p>
          <p className="text-sm text-gray-500">{uploadState.message}</p>
        </div>

        {/* Progress Bar */}
        {uploadState.status === 'parsing' && (
          <div className="w-full max-w-xs mb-4">
            <div className="bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
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
            <Upload className="w-5 h-5 mr-2 text-gray-500" />
            <span className="text-sm text-gray-600">
              Choose file or drag here
            </span>
          </div>
        )}

        {/* File Format Info */}
        {uploadState.status === 'idle' && (
          <p className="text-xs text-gray-400 mt-4">
            Supports .xml, .musicxml, and .mxl files (max 10MB)
          </p>
        )}

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".xml,.musicxml,.mxl"
          onChange={handleFileSelect}
          className="hidden"
          disabled={disabled || uploadState.status === 'parsing'}
        />
      </div>
    </div>
  );
}
