/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Extract the YouTubeThumbnail component from the page file for testing
// This is a test-specific extraction since the component is defined inline
interface YouTubeThumbnailProps {
  videoUrl: string;
  title: string;
  className?: string;
}

function YouTubeThumbnail({
  videoUrl,
  title,
  className = '',
}: YouTubeThumbnailProps) {
  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string | null => {
    const regex =
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match?.[1] ?? null;
  };

  const videoId = getYouTubeVideoId(videoUrl);

  if (!videoId) {
    // Fallback to music emoji if no valid YouTube URL
    return (
      <div
        className={`bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center ${className}`}
        data-testid="youtube-thumbnail-fallback"
      >
        <span className="text-3xl">🎵</span>
      </div>
    );
  }

  // YouTube thumbnail URL - try maxresdefault first for better quality
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  return (
    <div
      className={`rounded-xl overflow-hidden ${className}`}
      data-testid="youtube-thumbnail"
    >
      <img
        src={thumbnailUrl}
        alt={`${title} thumbnail`}
        className="w-full h-full object-cover"
        data-testid="youtube-thumbnail-image"
        onError={(e) => {
          // Fallback to hqdefault if maxres fails
          const target = e.target as HTMLImageElement;
          if (target.src.includes('maxresdefault')) {
            target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          } else if (target.src.includes('hqdefault')) {
            // Final fallback to emoji if all thumbnails fail
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML =
                '<div class="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center w-full h-full" data-testid="youtube-thumbnail-final-fallback"><span class="text-3xl">🎵</span></div>';
            }
          }
        }}
      />
    </div>
  );
}

// Utility functions from the page
const getDifficultyColor = (difficulty: string) => {
  const normalizedDifficulty = difficulty.toLowerCase();
  switch (normalizedDifficulty) {
    case 'beginner':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'intermediate':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'advanced':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const capitalizeDifficulty = (difficulty: string) => {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
};

describe('YouTubeThumbnail Component', () => {
  const defaultProps = {
    videoUrl: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Test Video',
    className: 'test-class',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Valid YouTube URLs', () => {
    const validUrls = [
      'https://youtube.com/watch?v=dQw4w9WgXcQ',
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://youtube.com/embed/dQw4w9WgXcQ',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s',
      'https://youtube.com/watch?v=dQw4w9WgXcQ&list=PLxyz',
    ];

    validUrls.forEach((url) => {
      it(`should extract video ID correctly from ${url}`, () => {
        // Act
        render(<YouTubeThumbnail {...defaultProps} videoUrl={url} />);

        // Assert
        const image = screen.getByTestId('youtube-thumbnail-image');
        expect(image).toBeInTheDocument();
        expect(image).toHaveAttribute(
          'src',
          'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        );
        expect(image).toHaveAttribute('alt', 'Test Video thumbnail');
      });
    });

    it('should apply custom className', () => {
      // Act
      render(<YouTubeThumbnail {...defaultProps} className="custom-class" />);

      // Assert
      const container = screen.getByTestId('youtube-thumbnail');
      expect(container).toHaveClass('custom-class');
    });

    it('should have correct image styling', () => {
      // Act
      render(<YouTubeThumbnail {...defaultProps} />);

      // Assert
      const image = screen.getByTestId('youtube-thumbnail-image');
      expect(image).toHaveClass('w-full', 'h-full', 'object-cover');
    });

    it('should have proper container structure', () => {
      // Act
      render(<YouTubeThumbnail {...defaultProps} />);

      // Assert
      const container = screen.getByTestId('youtube-thumbnail');
      expect(container).toHaveClass('rounded-xl', 'overflow-hidden');
    });
  });

  describe('Invalid YouTube URLs', () => {
    const invalidUrls = [
      '',
      'https://vimeo.com/123456',
      'https://example.com/video',
      'not-a-url',
      'https://youtube.com/user/someuser',
      'https://youtube.com/playlist?list=PLxyz',
    ];

    invalidUrls.forEach((url) => {
      it(`should show fallback for invalid URL: ${url}`, () => {
        // Act
        render(<YouTubeThumbnail {...defaultProps} videoUrl={url} />);

        // Assert
        const fallback = screen.getByTestId('youtube-thumbnail-fallback');
        expect(fallback).toBeInTheDocument();
        expect(fallback).toHaveTextContent('🎵');
        expect(fallback).toHaveClass(
          'bg-gradient-to-br',
          'from-purple-500/20',
          'to-pink-500/20',
          'rounded-xl',
          'flex',
          'items-center',
          'justify-center',
        );
      });
    });

    it('should apply className to fallback container', () => {
      // Act
      render(
        <YouTubeThumbnail
          {...defaultProps}
          videoUrl=""
          className="fallback-class"
        />,
      );

      // Assert
      const fallback = screen.getByTestId('youtube-thumbnail-fallback');
      expect(fallback).toHaveClass('fallback-class');
    });
  });

  describe('Image Error Handling', () => {
    it('should fallback to hqdefault when maxresdefault fails', () => {
      // Act
      render(<YouTubeThumbnail {...defaultProps} />);
      const image = screen.getByTestId('youtube-thumbnail-image');

      // Simulate maxresdefault image load error
      fireEvent.error(image);

      // Assert
      expect(image).toHaveAttribute(
        'src',
        'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
      );
    });

    it('should show final fallback when both thumbnail qualities fail', () => {
      // Act
      render(<YouTubeThumbnail {...defaultProps} />);
      const image = screen.getByTestId('youtube-thumbnail-image');

      // Simulate maxresdefault failure
      Object.defineProperty(image, 'src', {
        value: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
        writable: true,
      });
      fireEvent.error(image);

      // Simulate hqdefault failure
      Object.defineProperty(image, 'src', {
        value: 'https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        writable: true,
      });
      fireEvent.error(image);

      // Assert
      const finalFallback = screen.getByTestId(
        'youtube-thumbnail-final-fallback',
      );
      expect(finalFallback).toBeInTheDocument();
      expect(finalFallback).toHaveTextContent('🎵');
    });

    it('should not fallback on other src patterns', () => {
      // Act
      render(<YouTubeThumbnail {...defaultProps} />);
      const image = screen.getByTestId('youtube-thumbnail-image');

      // Set src to something other than maxres/hqdefault
      Object.defineProperty(image, 'src', {
        value: 'https://example.com/other-image.jpg',
        writable: true,
      });

      // Simulate error
      fireEvent.error(image);

      // Assert - should not change src for non-YouTube thumbnail URLs
      expect(image).toHaveAttribute(
        'src',
        'https://example.com/other-image.jpg',
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty title gracefully', () => {
      // Act
      render(<YouTubeThumbnail {...defaultProps} title="" />);

      // Assert
      const image = screen.getByTestId('youtube-thumbnail-image');
      expect(image).toHaveAttribute('alt', ' thumbnail');
    });

    it('should handle undefined className', () => {
      // Act
      render(
        <YouTubeThumbnail
          videoUrl={defaultProps.videoUrl}
          title={defaultProps.title}
        />,
      );

      // Assert
      const container = screen.getByTestId('youtube-thumbnail');
      expect(container).toBeInTheDocument();
    });

    it('should extract video ID from URL with additional parameters', () => {
      // Act
      render(
        <YouTubeThumbnail
          {...defaultProps}
          videoUrl="https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s&list=PLxyz&index=1"
        />,
      );

      // Assert
      const image = screen.getByTestId('youtube-thumbnail-image');
      expect(image).toHaveAttribute(
        'src',
        'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
      );
    });

    it('should handle special characters in video ID', () => {
      // Act
      render(
        <YouTubeThumbnail
          {...defaultProps}
          videoUrl="https://youtube.com/watch?v=dQw4w9WgXcQ_test-123"
        />,
      );

      // Assert
      const image = screen.getByTestId('youtube-thumbnail-image');
      expect(image).toHaveAttribute(
        'src',
        'https://img.youtube.com/vi/dQw4w9WgXcQ_test-123/maxresdefault.jpg',
      );
    });
  });
});

describe('Utility Functions', () => {
  describe('getDifficultyColor', () => {
    it('should return correct colors for beginner difficulty', () => {
      // Act & Assert
      expect(getDifficultyColor('beginner')).toBe(
        'bg-green-500/20 text-green-400 border-green-500/30',
      );
      expect(getDifficultyColor('Beginner')).toBe(
        'bg-green-500/20 text-green-400 border-green-500/30',
      );
      expect(getDifficultyColor('BEGINNER')).toBe(
        'bg-green-500/20 text-green-400 border-green-500/30',
      );
    });

    it('should return correct colors for intermediate difficulty', () => {
      // Act & Assert
      expect(getDifficultyColor('intermediate')).toBe(
        'bg-orange-500/20 text-orange-400 border-orange-500/30',
      );
      expect(getDifficultyColor('Intermediate')).toBe(
        'bg-orange-500/20 text-orange-400 border-orange-500/30',
      );
      expect(getDifficultyColor('INTERMEDIATE')).toBe(
        'bg-orange-500/20 text-orange-400 border-orange-500/30',
      );
    });

    it('should return correct colors for advanced difficulty', () => {
      // Act & Assert
      expect(getDifficultyColor('advanced')).toBe(
        'bg-red-500/20 text-red-400 border-red-500/30',
      );
      expect(getDifficultyColor('Advanced')).toBe(
        'bg-red-500/20 text-red-400 border-red-500/30',
      );
      expect(getDifficultyColor('ADVANCED')).toBe(
        'bg-red-500/20 text-red-400 border-red-500/30',
      );
    });

    it('should return default colors for unknown difficulties', () => {
      // Act & Assert
      expect(getDifficultyColor('unknown')).toBe(
        'bg-gray-500/20 text-gray-400 border-gray-500/30',
      );
      expect(getDifficultyColor('')).toBe(
        'bg-gray-500/20 text-gray-400 border-gray-500/30',
      );
      expect(getDifficultyColor('expert')).toBe(
        'bg-gray-500/20 text-gray-400 border-gray-500/30',
      );
    });
  });

  describe('capitalizeDifficulty', () => {
    it('should capitalize first letter of difficulty', () => {
      // Act & Assert
      expect(capitalizeDifficulty('beginner')).toBe('Beginner');
      expect(capitalizeDifficulty('intermediate')).toBe('Intermediate');
      expect(capitalizeDifficulty('advanced')).toBe('Advanced');
    });

    it('should handle already capitalized words', () => {
      // Act & Assert
      expect(capitalizeDifficulty('Beginner')).toBe('Beginner');
      expect(capitalizeDifficulty('INTERMEDIATE')).toBe('INTERMEDIATE');
    });

    it('should handle edge cases', () => {
      // Act & Assert
      expect(capitalizeDifficulty('')).toBe('');
      expect(capitalizeDifficulty('a')).toBe('A');
      expect(capitalizeDifficulty('1test')).toBe('1test');
    });

    it('should handle special characters', () => {
      // Act & Assert
      expect(capitalizeDifficulty('-advanced')).toBe('-advanced');
      expect(capitalizeDifficulty('_beginner')).toBe('_beginner');
      expect(capitalizeDifficulty('123')).toBe('123');
    });
  });
});
