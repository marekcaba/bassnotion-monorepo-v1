/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../test/test-utils';
import { BassSettingsCard } from '../BassSettingsCard';

// Mock the hooks and services. vi.hoisted() so these are available inside
// the vi.mock factories, which Vitest hoists above the rest of the module.
const { mockUseUserProfile, mockProfileService } = vi.hoisted(() => ({
  mockUseUserProfile: vi.fn(),
  mockProfileService: {
    updateBassConfiguration: vi.fn(),
  },
}));

vi.mock('../hooks/use-user-profile', () => ({
  useUserProfile: mockUseUserProfile,
}));

vi.mock('../api/profile', () => ({
  profileService: mockProfileService,
}));

describe('BassSettingsCard', () => {
  const mockOnSettingsChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Loading State', () => {
    it('should display skeleton loading state when profile is loading', () => {
      // Arrange
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: true,
      });

      // Act
      render(<BassSettingsCard onSettingsChange={mockOnSettingsChange} />);

      // Assert
      expect(screen.getByText('🎸 Bass Configuration')).toBeInTheDocument();

      // Check for skeleton elements (multiple animated elements)
      const skeletonElements =
        screen.container.querySelectorAll('.animate-pulse');
      expect(skeletonElements.length).toBeGreaterThan(5);
    });

    it('should display skeleton when settings are null', () => {
      // Arrange
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          preferences: null,
        },
        isLoading: false,
      });

      // Act
      render(<BassSettingsCard onSettingsChange={mockOnSettingsChange} />);

      // Assert - Component should still show skeleton until settings are initialized
      const skeletonElements =
        screen.container.querySelectorAll('.animate-pulse');
      expect(skeletonElements.length).toBeGreaterThan(0);
    });
  });

  describe('Initial Settings Load', () => {
    it('should load settings from user profile bass configuration', () => {
      // Arrange
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          preferences: {
            bassConfiguration: {
              stringCount: 5,
              maxFrets: 22,
            },
          },
        },
        isLoading: false,
      });

      // Act
      render(<BassSettingsCard onSettingsChange={mockOnSettingsChange} />);

      // Assert
      expect(screen.getByText('5 Strings')).toBeInTheDocument();
      expect(screen.getByText('22')).toBeInTheDocument();
      expect(screen.getByText('Strings: 5')).toBeInTheDocument();
      expect(screen.getByText('Frets: 22')).toBeInTheDocument();
      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        stringCount: 5,
        maxFrets: 22,
      });
    });

    it('should use default settings when no bass configuration exists', () => {
      // Arrange
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          preferences: {},
        },
        isLoading: false,
      });

      // Act
      render(<BassSettingsCard onSettingsChange={mockOnSettingsChange} />);

      // Assert
      expect(screen.getByText('4 Strings')).toBeInTheDocument();
      expect(screen.getByText('24')).toBeInTheDocument();
      expect(mockOnSettingsChange).toHaveBeenCalledWith({
        stringCount: 4,
        maxFrets: 24,
      });
    });
  });

  describe('String Count Selection', () => {
    beforeEach(() => {
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          preferences: {
            bassConfiguration: {
              stringCount: 4,
              maxFrets: 24,
            },
          },
        },
        isLoading: false,
      });
    });

    it('should allow selecting 4 strings', async () => {
      // Arrange
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const fourStringButton = screen.getByText('4 Strings');
      await user.click(fourStringButton);

      // Assert
      expect(fourStringButton).toHaveClass('bg-blue-500', 'text-white');
    });

    it('should allow selecting 5 strings', async () => {
      // Arrange
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const fiveStringButton = screen.getByText('5 Strings');
      await user.click(fiveStringButton);

      // Assert
      expect(fiveStringButton).toHaveClass('bg-blue-500', 'text-white');
      expect(screen.getByText('Strings: 5')).toBeInTheDocument();
    });

    it('should allow selecting 6 strings', async () => {
      // Arrange
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const sixStringButton = screen.getByText('6 Strings');
      await user.click(sixStringButton);

      // Assert
      expect(sixStringButton).toHaveClass('bg-blue-500', 'text-white');
      expect(screen.getByText('Strings: 6')).toBeInTheDocument();
    });

    it('should show inactive styling for unselected string counts', async () => {
      // Arrange
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const fiveStringButton = screen.getByText('5 Strings');
      await user.click(fiveStringButton);

      // Assert
      const fourStringButton = screen.getByText('4 Strings');
      const sixStringButton = screen.getByText('6 Strings');

      expect(fourStringButton).toHaveClass('border', 'border-gray-300');
      expect(sixStringButton).toHaveClass('border', 'border-gray-300');
      expect(fourStringButton).not.toHaveClass('bg-blue-500');
      expect(sixStringButton).not.toHaveClass('bg-blue-500');
    });
  });

  describe('Fret Count Selection', () => {
    beforeEach(() => {
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          preferences: {
            bassConfiguration: {
              stringCount: 4,
              maxFrets: 24,
            },
          },
        },
        isLoading: false,
      });
    });

    it('should allow selecting different fret counts', async () => {
      // Arrange
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const fretButton = screen.getByText('21');
      await user.click(fretButton);

      // Assert
      expect(fretButton).toHaveClass('bg-blue-500', 'text-white');
      expect(screen.getByText('Frets: 21')).toBeInTheDocument();
    });

    it('should render all available fret options', () => {
      // Arrange
      render(<BassSettingsCard onSettingsChange={mockOnSettingsChange} />);

      // Assert
      const fretOptions = [19, 20, 21, 22, 23, 24, 25];
      fretOptions.forEach((frets) => {
        expect(screen.getByText(frets.toString())).toBeInTheDocument();
      });
    });

    it('should show correct selected fret count styling', async () => {
      // Arrange
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const fret22Button = screen.getByText('22');
      await user.click(fret22Button);

      // Assert
      expect(fret22Button).toHaveClass('bg-blue-500', 'text-white');

      // Other buttons should not be selected
      const fret24Button = screen.getByText('24');
      expect(fret24Button).toHaveClass('border', 'border-gray-300');
      expect(fret24Button).not.toHaveClass('bg-blue-500');
    });
  });

  describe('Save Functionality', () => {
    beforeEach(() => {
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          preferences: {
            bassConfiguration: {
              stringCount: 4,
              maxFrets: 24,
            },
          },
        },
        isLoading: false,
      });
    });

    it('should enable save button when settings change', async () => {
      // Arrange
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const fiveStringButton = screen.getByText('5 Strings');
      await user.click(fiveStringButton);

      // Assert
      const saveButton = screen.getByText('Save');
      expect(saveButton).not.toHaveClass('cursor-not-allowed');
      expect(saveButton).toHaveClass('bg-blue-500', 'text-white');
    });

    it('should disable save button when no changes', () => {
      // Arrange
      render(<BassSettingsCard onSettingsChange={mockOnSettingsChange} />);

      // Assert
      const saveButton = screen.getByText('Save');
      expect(saveButton).toHaveClass('cursor-not-allowed', 'bg-gray-300');
    });

    it('should save settings successfully', async () => {
      // Arrange
      mockProfileService.updateBassConfiguration.mockResolvedValue({});
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const fiveStringButton = screen.getByText('5 Strings');
      await user.click(fiveStringButton);

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      // Assert
      expect(mockProfileService.updateBassConfiguration).toHaveBeenCalledWith({
        stringCount: 5,
        maxFrets: 24,
      });
    });

    it('should show saving state during save operation', async () => {
      // Arrange
      mockProfileService.updateBassConfiguration.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 1000)),
      );
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const fiveStringButton = screen.getByText('5 Strings');
      await user.click(fiveStringButton);

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      // Assert
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('should show saved confirmation and auto-hide', async () => {
      // Arrange
      mockProfileService.updateBassConfiguration.mockResolvedValue({});
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const fiveStringButton = screen.getByText('5 Strings');
      await user.click(fiveStringButton);

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      // Wait for save to complete
      await waitFor(() => {
        expect(screen.getByText('✓ Saved')).toBeInTheDocument();
      });

      // Fast-forward time to test auto-hide
      vi.advanceTimersByTime(2000);

      // Assert
      await waitFor(() => {
        expect(screen.queryByText('✓ Saved')).not.toBeInTheDocument();
      });
    });

    it('should call onSettingsChange after successful save', async () => {
      // Arrange
      mockProfileService.updateBassConfiguration.mockResolvedValue({});
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const fiveStringButton = screen.getByText('5 Strings');
      await user.click(fiveStringButton);

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      // Assert
      await waitFor(() => {
        expect(mockOnSettingsChange).toHaveBeenCalledWith({
          stringCount: 5,
          maxFrets: 24,
        });
      });
    });
  });

  describe('Cancel Functionality', () => {
    beforeEach(() => {
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          preferences: {
            bassConfiguration: {
              stringCount: 4,
              maxFrets: 24,
            },
          },
        },
        isLoading: false,
      });
    });

    it('should enable cancel button when settings change', async () => {
      // Arrange
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const fiveStringButton = screen.getByText('5 Strings');
      await user.click(fiveStringButton);

      // Assert
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).not.toHaveClass('cursor-not-allowed');
    });

    it('should disable cancel button when no changes', () => {
      // Arrange
      render(<BassSettingsCard onSettingsChange={mockOnSettingsChange} />);

      // Assert
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toHaveClass('cursor-not-allowed');
    });

    it('should revert changes when cancel is clicked', async () => {
      // Arrange
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const fiveStringButton = screen.getByText('5 Strings');
      await user.click(fiveStringButton);

      expect(screen.getByText('Strings: 5')).toBeInTheDocument();

      const cancelButton = screen.getByText('Cancel');
      await user.click(cancelButton);

      // Assert
      expect(screen.getByText('Strings: 4')).toBeInTheDocument();
      const fourStringButton = screen.getByText('4 Strings');
      expect(fourStringButton).toHaveClass('bg-blue-500', 'text-white');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          preferences: {
            bassConfiguration: {
              stringCount: 4,
              maxFrets: 24,
            },
          },
        },
        isLoading: false,
      });
    });

    it('should handle save errors gracefully', async () => {
      // Arrange
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockProfileService.updateBassConfiguration.mockRejectedValue(
        new Error('Network error'),
      );
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act
      const fiveStringButton = screen.getByText('5 Strings');
      await user.click(fiveStringButton);

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      // Assert
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to save bass configuration:',
          expect.any(Error),
        );
      });

      // Should return to save button state
      expect(screen.getByText('Save')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing onSettingsChange prop', () => {
      // Arrange
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          preferences: {
            bassConfiguration: {
              stringCount: 4,
              maxFrets: 24,
            },
          },
        },
        isLoading: false,
      });

      // Act & Assert - Should not throw
      expect(() => {
        render(<BassSettingsCard />);
      }).not.toThrow();
    });

    it('should handle null profile gracefully', () => {
      // Arrange
      mockUseUserProfile.mockReturnValue({
        profile: null,
        isLoading: false,
      });

      // Act & Assert - Should show skeleton state
      render(<BassSettingsCard onSettingsChange={mockOnSettingsChange} />);

      const skeletonElements =
        screen.container.querySelectorAll('.animate-pulse');
      expect(skeletonElements.length).toBeGreaterThan(0);
    });

    it('should reset justSaved state when user makes new changes', async () => {
      // Arrange
      mockProfileService.updateBassConfiguration.mockResolvedValue({});
      const { user } = render(
        <BassSettingsCard onSettingsChange={mockOnSettingsChange} />,
      );

      // Act - Make change and save
      const fiveStringButton = screen.getByText('5 Strings');
      await user.click(fiveStringButton);

      const saveButton = screen.getByText('Save');
      await user.click(saveButton);

      // Wait for saved state
      await waitFor(() => {
        expect(screen.getByText('✓ Saved')).toBeInTheDocument();
      });

      // Make another change
      const sixStringButton = screen.getByText('6 Strings');
      await user.click(sixStringButton);

      // Assert - Should show Save button again, not "✓ Saved"
      expect(screen.getByText('Save')).toBeInTheDocument();
      expect(screen.queryByText('✓ Saved')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseUserProfile.mockReturnValue({
        profile: {
          id: '123',
          preferences: {
            bassConfiguration: {
              stringCount: 4,
              maxFrets: 24,
            },
          },
        },
        isLoading: false,
      });
    });

    it('should have proper button roles and accessibility', () => {
      // Arrange
      render(<BassSettingsCard onSettingsChange={mockOnSettingsChange} />);

      // Assert
      const stringButtons = screen
        .getAllByRole('button')
        .filter((button) => button.textContent?.includes('Strings'));
      expect(stringButtons).toHaveLength(3);

      const fretButtons = screen
        .getAllByRole('button')
        .filter((button) => /^\d+$/.test(button.textContent || ''));
      expect(fretButtons).toHaveLength(7);
    });

    it('should have proper heading structure', () => {
      // Arrange
      render(<BassSettingsCard onSettingsChange={mockOnSettingsChange} />);

      // Assert
      expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
        '🎸 Bass Configuration',
      );
      expect(
        screen.getByRole('heading', { level: 3, name: 'Number of Strings' }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { level: 3, name: 'Number of Frets' }),
      ).toBeInTheDocument();
    });
  });
});
