'use client';

import { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Loader2, X } from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { Button } from '@/shared/components/ui/button';

interface ThumbnailUploadProps {
  currentThumbnailUrl?: string;
  youtubeId?: string;
  onThumbnailChange: (newThumbnailUrl: string | null) => void;
  disabled?: boolean;
  tutorialId: string;
}

export function ThumbnailUpload({
  currentThumbnailUrl,
  youtubeId,
  onThumbnailChange,
  disabled = false,
  tutorialId,
}: ThumbnailUploadProps) {
  const { correlationId, logger } = useCorrelation('ThumbnailUpload');
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentThumbnailUrl || null,
  );
  const [imageError, setImageError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Generate YouTube thumbnail URL as fallback
  const youtubeThumbnailUrl = youtubeId
    ? `https://img.youtube.com/vi/${youtubeId}/maxresdefault.jpg`
    : null;

  // Update preview when prop changes
  useEffect(() => {
    setImageError(false);
    setPreviewUrl(currentThumbnailUrl || null);
  }, [currentThumbnailUrl]);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Invalid file type',
        description: 'Please select a JPG, PNG, WebP, or GIF image',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (5MB limit)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Please select an image smaller than 5MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);

    try {
      // Get auth session for the API call
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        toast({
          title: 'Session expired',
          description: 'Please refresh the page and try again.',
          variant: 'destructive',
        });
        throw new Error('No active session - please log in again');
      }

      logger.info('Uploading thumbnail via backend API', {
        tutorialId,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
      });

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('file', file);

      // Upload via backend API (uses service role key, bypasses RLS)
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(
        `${apiUrl}/api/v1/tutorials/${tutorialId}/upload-thumbnail`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'x-correlation-id': correlationId,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage =
          errorData.message || `Upload failed with status ${response.status}`;

        logger.error('Upload API error:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
        });

        if (response.status === 401 || response.status === 403) {
          toast({
            title: 'Permission denied',
            description:
              'You do not have permission to upload thumbnails. Admin role required.',
            variant: 'destructive',
          });
          throw new Error('Permission denied: Admin role required');
        }

        throw new Error(errorMessage);
      }

      const result = await response.json();

      logger.info('Thumbnail uploaded successfully', {
        publicUrl: result.publicUrl,
        filePath: result.filePath,
      });

      // Set preview and notify parent
      setPreviewUrl(result.publicUrl);
      setImageError(false);
      onThumbnailChange(result.publicUrl);

      toast({
        title: 'Thumbnail uploaded',
        description: 'Your custom thumbnail has been uploaded successfully.',
        variant: 'default',
      });
    } catch (error) {
      logger.error('Thumbnail upload error:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        error: error,
      });
      toast({
        title: 'Upload failed',
        description:
          error instanceof Error ? error.message : 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleClick = () => {
    if (disabled || isUploading) return;
    fileInputRef.current?.click();
  };

  const handleRemoveThumbnail = () => {
    setPreviewUrl(null);
    setImageError(false);
    onThumbnailChange(null);
    toast({
      title: 'Thumbnail removed',
      description: youtubeId
        ? 'Using YouTube auto-generated thumbnail.'
        : 'No thumbnail set.',
      variant: 'default',
    });
  };

  const handleImageError = () => {
    logger.error('[ThumbnailUpload] Image failed to load:', {
      previewUrl,
      tutorialId,
    });
    setImageError(true);
  };

  // Determine which thumbnail to display
  const displayUrl = previewUrl || youtubeThumbnailUrl;
  const isCustomThumbnail = !!previewUrl;

  return (
    <div className="space-y-3">
      <label className="block text-sm font-medium mb-1">
        Tutorial Thumbnail
      </label>

      {/* Thumbnail Preview */}
      <div className="relative aspect-video w-full max-w-md rounded-lg overflow-hidden border-2 border-dashed border-gray-300 bg-gray-100">
        {displayUrl && !imageError ? (
          <>
            <img
              src={displayUrl}
              alt="Tutorial Thumbnail"
              className="w-full h-full object-cover"
              onError={handleImageError}
            />
            {/* Badge showing source */}
            <div
              className={`absolute top-2 left-2 px-2 py-1 rounded text-xs font-medium ${
                isCustomThumbnail
                  ? 'bg-green-500 text-white'
                  : 'bg-blue-500 text-white'
              }`}
            >
              {isCustomThumbnail ? 'Custom' : 'YouTube'}
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-12 h-12 text-gray-400" />
          </div>
        )}

        {/* Upload overlay */}
        {isUploading && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2 flex-wrap">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClick}
          disabled={disabled || isUploading}
        >
          <Upload className="w-4 h-4 mr-2" />
          {isCustomThumbnail ? 'Replace Thumbnail' : 'Upload Custom Thumbnail'}
        </Button>

        {isCustomThumbnail && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleRemoveThumbnail}
            disabled={disabled || isUploading}
            className="text-red-500 hover:text-red-600"
          >
            <X className="w-4 h-4 mr-2" />
            Remove
          </Button>
        )}
      </div>

      {/* Help text */}
      <p className="text-xs text-gray-500">
        {isCustomThumbnail
          ? 'Custom thumbnail will be used instead of YouTube thumbnail.'
          : youtubeId
            ? 'Upload a custom thumbnail or use the auto-generated YouTube thumbnail.'
            : 'Upload a thumbnail image (recommended: 1280x720 pixels).'}
      </p>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
    </div>
  );
}
