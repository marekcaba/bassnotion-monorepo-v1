/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../test/test-utils';
import { CreatorInfoSection } from '../CreatorInfoSection';
import type { Tutorial } from '@bassnotion/contracts';

// Mock the hooks
vi.mock('../../../hooks/useYouTubeChannelData');

import { useYouTubeChannelData } from '../../../hooks/useYouTubeChannelData';
const mockUseYouTubeChannelData = vi.mocked(useYouTubeChannelData);

// Mock window.open
const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', {
  value: mockWindowOpen,
  writable: true,
});

describe('CreatorInfoSection', () => {
  const mockTutorial: Tutorial = {
    id: 'tutorial-123',
    slug: 'test-tutorial',
    title: 'Test Tutorial',
    artist: 'Test Artist',
    difficulty: 'intermediate',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    creator_name: 'Test Creator',
    creator_channel_url: 'https://youtube.com/channel/UC1234567890',
    creator_avatar_url: 'https://example.com/avatar.jpg',
  };

  const defaultCreatorData = {
    channelId: null,
    subscriberCount: '1.5M',
    creatorName: 'Test Creator',
    isLoading: false,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseYouTubeChannelData.mockReturnValue(defaultCreatorData);
  });

  describe('Default Creator (Rick Astley)', () => {
    it('should display Rick Astley as default creator when no tutorial data provided', () => {
      // Act
      render(<CreatorInfoSection />);

      // Assert
      expect(screen.getByText('Rick Astley')).toBeInTheDocument();
      expect(screen.getByAltText('Rick Astley avatar')).toBeInTheDocument();
      expect(mockUseYouTubeChannelData).toHaveBeenCalledWith(
        'https://www.youtube.com/channel/UCuAXFkgsw1L7xaCfnd5JJOw',
        'Rick Astley',
      );
    });

    it('should display Rick Astley when tutorial has no creator data', () => {
      // Arrange
      const tutorialWithoutCreator = {
        ...mockTutorial,
        creator_name: undefined,
        creator_channel_url: undefined,
        creator_avatar_url: undefined,
      };

      // Act
      render(
        <CreatorInfoSection tutorialData={tutorialWithoutCreator as any} />,
      );

      // Assert
      expect(screen.getByText('Rick Astley')).toBeInTheDocument();
      expect(screen.getByAltText('Rick Astley avatar')).toBeInTheDocument();
    });

    it('should display Rick Astley when creator name is empty string', () => {
      // Arrange
      const tutorialWithEmptyCreator = {
        ...mockTutorial,
        creator_name: '',
      };

      // Act
      render(<CreatorInfoSection tutorialData={tutorialWithEmptyCreator} />);

      // Assert
      expect(screen.getByText('Rick Astley')).toBeInTheDocument();
    });
  });

  describe('Tutorial Creator Data', () => {
    it('should display tutorial creator when provided', () => {
      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      expect(screen.getByText('Test Creator')).toBeInTheDocument();
      expect(screen.getByAltText('Test Creator avatar')).toBeInTheDocument();
      expect(screen.getByAltText('Test Creator avatar')).toHaveAttribute(
        'src',
        'https://example.com/avatar.jpg',
      );
    });

    it('should handle tutorial creator without avatar', () => {
      // Arrange
      const tutorialWithoutAvatar = {
        ...mockTutorial,
        creator_avatar_url: undefined,
      };

      // Act
      render(<CreatorInfoSection tutorialData={tutorialWithoutAvatar} />);

      // Assert
      expect(screen.getByText('Test Creator')).toBeInTheDocument();
      expect(
        screen.queryByAltText('Test Creator avatar'),
      ).not.toBeInTheDocument();

      // Should display initial letter in circular avatar
      const avatarFallback = screen.getByText('T');
      expect(avatarFallback).toBeInTheDocument();
      expect(avatarFallback).toHaveClass('bg-slate-700', 'rounded-full');
    });

    it('should handle tutorial creator without channel URL', () => {
      // Arrange
      const tutorialWithoutChannel = {
        ...mockTutorial,
        creator_channel_url: undefined,
      };

      // Act
      render(<CreatorInfoSection tutorialData={tutorialWithoutChannel} />);

      // Assert
      expect(screen.getByText('Test Creator')).toBeInTheDocument();

      // Name should not be a link
      const creatorName = screen.getByText('Test Creator');
      expect(creatorName.tagName).toBe('P');
      expect(creatorName).toHaveClass('text-white');

      // Subscribe button should be disabled
      const subscribeButton = screen.getByRole('button', { name: 'Subscribe' });
      expect(subscribeButton).toBeDisabled();
    });

    it('should call useYouTubeChannelData with correct parameters', () => {
      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      expect(mockUseYouTubeChannelData).toHaveBeenCalledWith(
        'https://youtube.com/channel/UC1234567890',
        'Test Creator',
      );
    });
  });

  describe('Avatar Display', () => {
    it('should display creator avatar when provided', () => {
      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      const avatar = screen.getByAltText('Test Creator avatar');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', 'https://example.com/avatar.jpg');
      expect(avatar).toHaveClass(
        'w-10',
        'h-10',
        'rounded-full',
        'object-cover',
      );
    });

    it('should display avatar as clickable link to channel', () => {
      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      const avatarLink = screen
        .getByAltText('Test Creator avatar')
        .closest('a');
      expect(avatarLink).toHaveAttribute(
        'href',
        'https://youtube.com/channel/UC1234567890',
      );
      expect(avatarLink).toHaveAttribute('target', '_blank');
      expect(avatarLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('should display fallback avatar with creator initial when no avatar URL', () => {
      // Arrange
      const tutorialWithoutAvatar = {
        ...mockTutorial,
        creator_avatar_url: '',
      };

      // Act
      render(<CreatorInfoSection tutorialData={tutorialWithoutAvatar} />);

      // Assert
      const fallbackAvatar = screen.getByText('T');
      expect(fallbackAvatar).toBeInTheDocument();
      expect(fallbackAvatar).toHaveClass(
        'w-10',
        'h-10',
        'rounded-full',
        'bg-slate-700',
        'flex',
        'items-center',
        'justify-center',
      );
    });

    it('should handle creator names starting with lowercase letter', () => {
      // Arrange
      const tutorialWithLowercaseName = {
        ...mockTutorial,
        creator_name: 'test creator',
        creator_avatar_url: '',
      };

      // Act
      render(<CreatorInfoSection tutorialData={tutorialWithLowercaseName} />);

      // Assert
      const fallbackAvatar = screen.getByText('T');
      expect(fallbackAvatar).toBeInTheDocument();
    });

    it('should handle empty creator name gracefully in fallback avatar', () => {
      // Arrange
      const tutorialWithEmptyName = {
        ...mockTutorial,
        creator_name: '',
        creator_avatar_url: '',
      };

      // This should fallback to Rick Astley, but testing edge case
      render(<CreatorInfoSection tutorialData={tutorialWithEmptyName} />);

      // Should render Rick Astley's avatar
      expect(screen.getByAltText('Rick Astley avatar')).toBeInTheDocument();
    });
  });

  describe('Creator Name Display', () => {
    it('should display creator name as clickable link when channel URL provided', () => {
      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      const creatorLink = screen.getByRole('link', { name: 'Test Creator' });
      expect(creatorLink).toHaveAttribute(
        'href',
        'https://youtube.com/channel/UC1234567890',
      );
      expect(creatorLink).toHaveAttribute('target', '_blank');
      expect(creatorLink).toHaveAttribute('rel', 'noopener noreferrer');
      expect(creatorLink).toHaveClass('text-white', 'hover:text-blue-300');
    });

    it('should display creator name as plain text when no channel URL', () => {
      // Arrange
      const tutorialWithoutChannel = {
        ...mockTutorial,
        creator_channel_url: '',
      };

      // Act
      render(<CreatorInfoSection tutorialData={tutorialWithoutChannel} />);

      // Assert
      const creatorName = screen.getByText('Test Creator');
      expect(creatorName.tagName).toBe('P');
      expect(creatorName).toHaveClass('text-white', 'text-sm', 'font-medium');
    });

    it('should truncate long creator names', () => {
      // Arrange
      const tutorialWithLongName = {
        ...mockTutorial,
        creator_name:
          'This is a very long creator name that should be truncated',
      };

      // Act
      render(<CreatorInfoSection tutorialData={tutorialWithLongName} />);

      // Assert
      const creatorLink = screen.getByText(
        'This is a very long creator name that should be truncated',
      );
      expect(creatorLink).toHaveClass('truncate');
    });
  });

  describe('Subscriber Count Display', () => {
    it('should display subscriber count when available', () => {
      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      expect(screen.getByText('1.5M')).toBeInTheDocument();
    });

    it('should display loading state', () => {
      // Arrange
      mockUseYouTubeChannelData.mockReturnValue({
        ...defaultCreatorData,
        isLoading: true,
      });

      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should display subscribe message when subscriber count is "Subscribe"', () => {
      // Arrange
      mockUseYouTubeChannelData.mockReturnValue({
        ...defaultCreatorData,
        subscriberCount: 'Subscribe',
      });

      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      expect(
        screen.getByText('Subscribe to see subscriber count'),
      ).toBeInTheDocument();
    });

    it('should handle different subscriber count formats', () => {
      const testCases = [
        { count: '1000', expected: '1000' },
        { count: '10K', expected: '10K' },
        { count: '500K', expected: '500K' },
        { count: '2.5M', expected: '2.5M' },
        { count: '1B', expected: '1B' },
      ];

      testCases.forEach(({ count, expected }) => {
        // Arrange
        mockUseYouTubeChannelData.mockReturnValue({
          ...defaultCreatorData,
          subscriberCount: count,
        });

        // Act
        const { unmount } = render(
          <CreatorInfoSection tutorialData={mockTutorial} />,
        );

        // Assert
        expect(screen.getByText(expected)).toBeInTheDocument();

        // Cleanup for next iteration
        unmount();
      });
    });
  });

  describe('Subscribe Button', () => {
    it('should display enabled subscribe button when channel URL provided', () => {
      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      const subscribeButton = screen.getByRole('button', { name: 'Subscribe' });
      expect(subscribeButton).not.toBeDisabled();
      expect(subscribeButton).toHaveClass(
        'bg-white',
        'hover:bg-gray-100',
        'text-black',
      );
    });

    it('should display disabled subscribe button when no channel URL', () => {
      // Arrange
      const tutorialWithoutChannel = {
        ...mockTutorial,
        creator_channel_url: '',
      };

      // Act
      render(<CreatorInfoSection tutorialData={tutorialWithoutChannel} />);

      // Assert
      const subscribeButton = screen.getByRole('button', { name: 'Subscribe' });
      expect(subscribeButton).toBeDisabled();
      expect(subscribeButton).toHaveClass(
        'bg-gray-500',
        'hover:bg-gray-600',
        'text-white',
      );
    });

    it('should open channel URL in new tab when subscribe button clicked', async () => {
      // Arrange
      const { user } = render(
        <CreatorInfoSection tutorialData={mockTutorial} />,
      );

      // Act
      const subscribeButton = screen.getByRole('button', { name: 'Subscribe' });
      await user.click(subscribeButton);

      // Assert
      expect(mockWindowOpen).toHaveBeenCalledWith(
        'https://youtube.com/channel/UC1234567890',
        '_blank',
        'noopener,noreferrer',
      );
    });

    it('should not call window.open when disabled button is clicked', async () => {
      // Arrange
      const tutorialWithoutChannel = {
        ...mockTutorial,
        creator_channel_url: '',
      };
      const { user } = render(
        <CreatorInfoSection tutorialData={tutorialWithoutChannel} />,
      );

      // Act
      const subscribeButton = screen.getByRole('button', { name: 'Subscribe' });
      await user.click(subscribeButton);

      // Assert
      expect(mockWindowOpen).not.toHaveBeenCalled();
    });
  });

  describe('Layout and Styling', () => {
    it('should have correct container width and styling', () => {
      // Act
      const { container } = render(
        <CreatorInfoSection tutorialData={mockTutorial} />,
      );

      // Assert
      const outerContainer = container.firstChild;
      expect(outerContainer).toHaveClass('w-[90%]', 'mx-auto');
    });

    it('should have correct inner container styling', () => {
      // Act
      const { container } = render(
        <CreatorInfoSection tutorialData={mockTutorial} />,
      );

      // Assert - Find the main container with all the expected classes
      const innerContainer = container.querySelector('.bg-slate-800\\/40');
      expect(innerContainer).toHaveClass(
        'flex',
        'items-center',
        'gap-3',
        'p-3',
        'bg-slate-800/40',
        'backdrop-blur-xl',
        'rounded-lg',
        'border',
        'border-slate-700/50',
        'shadow-lg',
      );
    });

    it('should have proper responsive layout structure', () => {
      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      const avatar = screen
        .getByAltText('Test Creator avatar')
        .closest('.flex-shrink-0');
      expect(avatar).toBeInTheDocument();

      const infoSection = screen.getByText('Test Creator').closest('.flex-1');
      expect(infoSection).toHaveClass('flex-1', 'min-w-0');

      const buttonSection = screen
        .getByRole('button')
        .closest('.flex-shrink-0');
      expect(buttonSection).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should not render when creator is null', () => {
      // This is a theoretical edge case since the component always has a fallback
      // But testing the null check exists
      const { container } = render(<CreatorInfoSection />);

      // Should render Rick Astley as fallback
      expect(screen.getByText('Rick Astley')).toBeInTheDocument();
      expect(container.firstChild).not.toBeNull();
    });

    it('should handle special characters in creator name', () => {
      // Arrange
      const tutorialWithSpecialChars = {
        ...mockTutorial,
        creator_name: 'Creator with émojis 🎵 & symbols!',
        creator_avatar_url: '',
      };

      // Act
      render(<CreatorInfoSection tutorialData={tutorialWithSpecialChars} />);

      // Assert
      expect(
        screen.getByText('Creator with émojis 🎵 & symbols!'),
      ).toBeInTheDocument();
      // Should use 'C' as the fallback avatar initial
      expect(screen.getByText('C')).toBeInTheDocument();
    });

    it('should handle very long channel URLs', () => {
      // Arrange
      const veryLongUrl =
        'https://youtube.com/channel/UC1234567890VERYLONGCHANNELID123456789012345678901234567890';
      const tutorialWithLongUrl = {
        ...mockTutorial,
        creator_channel_url: veryLongUrl,
      };

      // Act
      render(<CreatorInfoSection tutorialData={tutorialWithLongUrl} />);

      // Assert
      const creatorLink = screen.getByRole('link', { name: 'Test Creator' });
      expect(creatorLink).toHaveAttribute('href', veryLongUrl);
    });

    it('should handle hook returning error state', () => {
      // Arrange
      mockUseYouTubeChannelData.mockReturnValue({
        channelId: null,
        subscriberCount: 'Subscribe',
        creatorName: 'Test Creator',
        isLoading: false,
        error: new Error('Failed to load'),
      });

      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      expect(
        screen.getByText('Subscribe to see subscriber count'),
      ).toBeInTheDocument();
    });

    it('should handle malformed avatar URLs gracefully', () => {
      // Arrange
      const tutorialWithBadAvatar = {
        ...mockTutorial,
        creator_avatar_url: 'not-a-valid-url',
      };

      // Act
      render(<CreatorInfoSection tutorialData={tutorialWithBadAvatar} />);

      // Assert
      const avatar = screen.getByAltText('Test Creator avatar');
      expect(avatar).toHaveAttribute('src', 'not-a-valid-url');
      // Browser will handle the invalid URL, component shouldn't crash
    });
  });

  describe('Accessibility', () => {
    it('should have proper alt text for avatars', () => {
      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      const avatar = screen.getByAltText('Test Creator avatar');
      expect(avatar).toBeInTheDocument();
    });

    it('should have proper link attributes for external navigation', () => {
      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      const creatorLink = screen.getByRole('link', { name: 'Test Creator' });
      expect(creatorLink).toHaveAttribute('rel', 'noopener noreferrer');
      expect(creatorLink).toHaveAttribute('target', '_blank');

      const avatarLink = screen
        .getByAltText('Test Creator avatar')
        .closest('a');
      expect(avatarLink).toHaveAttribute('rel', 'noopener noreferrer');
      expect(avatarLink).toHaveAttribute('target', '_blank');
    });

    it('should have accessible button for subscribe action', () => {
      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      const subscribeButton = screen.getByRole('button', { name: 'Subscribe' });
      expect(subscribeButton).toBeInTheDocument();
    });

    it('should handle screen reader friendly text content', () => {
      // Act
      render(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      expect(screen.getByText('Test Creator')).toBeInTheDocument();
      expect(screen.getByText('1.5M')).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Subscribe' }),
      ).toBeInTheDocument();
    });
  });

  describe('Performance', () => {
    it('should not cause unnecessary re-renders', () => {
      // Act
      const { rerender } = render(
        <CreatorInfoSection tutorialData={mockTutorial} />,
      );

      expect(screen.getByText('Test Creator')).toBeInTheDocument();

      // Rerender with same props
      rerender(<CreatorInfoSection tutorialData={mockTutorial} />);
      rerender(<CreatorInfoSection tutorialData={mockTutorial} />);

      // Assert
      expect(screen.getByText('Test Creator')).toBeInTheDocument();
      expect(mockUseYouTubeChannelData).toHaveBeenCalledTimes(3); // Once per render
    });

    it('should handle prop changes efficiently', () => {
      // Arrange
      const firstTutorial = mockTutorial;
      const secondTutorial = {
        ...mockTutorial,
        creator_name: 'Different Creator',
        creator_channel_url: 'https://youtube.com/channel/DIFFERENT',
      };

      // Act
      const { rerender } = render(
        <CreatorInfoSection tutorialData={firstTutorial} />,
      );

      expect(screen.getByText('Test Creator')).toBeInTheDocument();

      rerender(<CreatorInfoSection tutorialData={secondTutorial} />);

      // Assert
      expect(screen.getByText('Different Creator')).toBeInTheDocument();
      expect(screen.queryByText('Test Creator')).not.toBeInTheDocument();
    });
  });
});
