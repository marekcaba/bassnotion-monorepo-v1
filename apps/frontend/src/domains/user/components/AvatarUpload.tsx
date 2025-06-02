'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, User, Loader2 } from 'lucide-react';
import { supabase } from '@/infrastructure/supabase/client';
import { useToast } from '@/shared/hooks/use-toast';

interface AvatarUploadProps {
  currentAvatarUrl?: string;
  onAvatarChange: (newAvatarUrl: string | null) => void;
  disabled?: boolean;
  userId: string;
}

export function AvatarUpload({
  currentAvatarUrl,
  onAvatarChange,
  disabled = false,
  userId,
}: AvatarUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(
    currentAvatarUrl || null,
  );
  const [imageError, setImageError] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Detect mobile device and log avatar info for debugging
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      setIsMobile(mobile);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Debug logging for mobile avatar issues
    if (currentAvatarUrl) {
      console.log('[AvatarUpload] Mobile Debug:', {
        isMobile: window.innerWidth <= 768,
        userAgent: navigator.userAgent,
        currentAvatarUrl,
        userId,
        timestamp: new Date().toISOString()
      });
    }
    
    return () => window.removeEventListener('resize', checkMobile);
  }, [currentAvatarUrl, userId]);

  // Reset image error when URL changes
  useEffect(() => {
    setImageError(false);
    setPreviewUrl(currentAvatarUrl || null);
  }, [currentAvatarUrl]);

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please select an image file (JPG, PNG, GIF, etc.)',
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
      // Create a unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`; // Store in user-specific folder

      // Upload to Supabase storage
      const { data: _uploadData, error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', {
          message: uploadError.message,
          statusCode: uploadError.statusCode,
          error: uploadError.error,
        });

        // Handle specific error cases
        if (uploadError.message.includes('Bucket not found')) {
          // Try to create the bucket first
          const { error: bucketError } = await supabase.storage.createBucket(
            'avatars',
            {
              public: true,
              allowedMimeTypes: ['image/*'],
              fileSizeLimit: 5242880, // 5MB
            },
          );

          if (bucketError && !bucketError.message.includes('already exists')) {
            throw new Error(
              `Failed to create storage bucket: ${bucketError.message}`,
            );
          }

          // Retry upload after creating bucket
          const { data: _retryData, error: retryError } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
              cacheControl: '3600',
              upsert: false,
            });

          if (retryError) {
            throw retryError;
          }
        } else {
          throw uploadError;
        }
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      if (!urlData?.publicUrl) {
        throw new Error('Failed to get public URL for uploaded image');
      }

      // Set preview and notify parent
      setPreviewUrl(urlData.publicUrl);
      setImageError(false);
      onAvatarChange(urlData.publicUrl);

      toast({
        title: 'Avatar uploaded',
        description: 'Your profile picture has been updated successfully.',
        variant: 'success',
      });
    } catch (error) {
      console.error('Avatar upload error:', {
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

  const handleImageError = () => {
    console.error('[AvatarUpload] Image failed to load:', {
      previewUrl,
      isMobile,
      userAgent: navigator.userAgent,
      userId,
      timestamp: new Date().toISOString()
    });
    setImageError(true);
    setPreviewUrl(null);
  };

  const handleImageLoad = () => {
    console.log('[AvatarUpload] Image loaded successfully:', {
      previewUrl,
      isMobile,
      userId,
      timestamp: new Date().toISOString()
    });
    setImageError(false);
  };

  const _handleRemoveAvatar = useCallback(async () => {
    setPreviewUrl(null);
    setImageError(false);
    onAvatarChange(null);
  }, [onAvatarChange]);

  return (
    <div className="flex flex-col">
      {/* Avatar Display */}
      <div
        className={`relative w-20 h-20 rounded-full overflow-hidden border-4 border-gray-200 dark:border-gray-700 shadow-lg transition-all touch-target ${
          disabled || isUploading
            ? 'cursor-not-allowed opacity-50'
            : 'cursor-pointer hover:border-green-400 hover:shadow-xl'
        }`}
        onClick={handleClick}
      >
        {previewUrl && !imageError ? (
          <img
            src={previewUrl}
            alt="Profile Avatar"
            className="w-full h-full object-cover"
            onError={handleImageError}
            onLoad={handleImageLoad}
            crossOrigin="anonymous"
            loading="eager"
            style={{
              // Force image to load properly on mobile
              maxWidth: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <User className="w-8 h-8 text-gray-400" />
            {imageError && isMobile && (
              <div className="absolute inset-0 flex items-center justify-center text-xs text-red-500 bg-red-50 dark:bg-red-900/20">
                {/* Small error indicator for mobile debugging */}
              </div>
            )}
          </div>
        )}

        {/* Overlay for upload/loading state */}
        <div
          className={`absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center transition-opacity ${
            isUploading ? 'opacity-100' : 'opacity-0 hover:opacity-100'
          }`}
        >
          {isUploading ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : (
            <Camera className="w-6 h-6 text-white" />
          )}
        </div>
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled || isUploading}
      />
      
      {/* Mobile Debug Info (only in development) */}
      {process.env.NODE_ENV === 'development' && isMobile && (
        <div className="mt-2 text-xs text-gray-500">
          <div>Mobile: {isMobile ? 'Yes' : 'No'}</div>
          <div>URL: {previewUrl ? 'Set' : 'None'}</div>
          <div>Error: {imageError ? 'Yes' : 'No'}</div>
        </div>
      )}
    </div>
  );
}
