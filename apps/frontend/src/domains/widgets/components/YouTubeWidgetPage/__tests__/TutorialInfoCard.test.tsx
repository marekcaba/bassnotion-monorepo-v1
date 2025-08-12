/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '../../../test/test-utils';
import { TutorialInfoCard } from '../TutorialInfoCard';
import type { Tutorial } from '@bassnotion/contracts';

describe('TutorialInfoCard', () => {
  const mockTutorial: Tutorial = {
    id: 'tutorial-123',
    slug: 'come-together-bass-lesson',
    title: 'Come Together Bass Lesson',
    artist: 'The Beatles',
    youtube_url: 'https://youtube.com/watch?v=example',
    difficulty: 'intermediate',
    duration: '15:30',
    description:
      'Learn the iconic bass line from The Beatles classic with advanced modal techniques',
    headline: 'Master modal interchange and tension/release',
    concepts: [
      'Modal interchange',
      'Tension and release',
      'II-V-I progressions',
    ],
    thumbnail: 'https://example.com/thumbnail.jpg',
    rating: 4.8,
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    creator_name: 'Bass Master',
    creator_channel_url: 'https://youtube.com/channel/example',
    creator_avatar_url: 'https://example.com/avatar.jpg',
  };

  describe('Fallback Content', () => {
    it('should display default content when no tutorial data provided', () => {
      // Act
      render(<TutorialInfoCard />);

      // Assert
      expect(screen.getByText('Come Together')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Learn advanced modal thinking and tension/release techniques',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('advanced')).toBeInTheDocument();
    });

    it('should display default content when tutorialData is undefined', () => {
      // Act
      render(<TutorialInfoCard tutorialData={undefined} />);

      // Assert
      expect(screen.getByText('Come Together')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Learn advanced modal thinking and tension/release techniques',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('advanced')).toBeInTheDocument();
    });

    it('should use default values for missing tutorial properties', () => {
      // Arrange
      const partialTutorial = {
        ...mockTutorial,
        title: undefined,
        description: undefined,
        difficulty: undefined,
      } as any;

      // Act
      render(<TutorialInfoCard tutorialData={partialTutorial} />);

      // Assert
      expect(screen.getByText('Come Together')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Learn advanced modal thinking and tension/release techniques',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('advanced')).toBeInTheDocument();
    });
  });

  describe('Tutorial Data Display', () => {
    it('should display tutorial title correctly', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const title = screen.getByText('Come Together Bass Lesson');
      expect(title).toBeInTheDocument();
      expect(title).toHaveClass('text-3xl', 'font-bold', 'bg-gradient-to-r');
    });

    it('should display tutorial description', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const description = screen.getByText(
        'Learn the iconic bass line from The Beatles classic with advanced modal techniques',
      );
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass('text-slate-400', 'text-base');
    });

    it('should display difficulty badge with correct styling', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const difficultyBadge = screen.getByText('intermediate');
      expect(difficultyBadge).toBeInTheDocument();
      expect(difficultyBadge).toHaveClass(
        'bg-orange-500',
        'text-white',
        'px-2',
        'py-0.5',
        'rounded-full',
        'text-xs',
        'font-medium',
      );
    });

    it('should position difficulty badge in top-right corner', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const badgeContainer = screen.getByText('intermediate').parentElement;
      expect(badgeContainer).toHaveClass(
        'absolute',
        'top-4',
        'right-4',
        'z-10',
      );
    });
  });

  describe('Difficulty Levels', () => {
    const difficultyLevels: Array<'beginner' | 'intermediate' | 'advanced'> = [
      'beginner',
      'intermediate',
      'advanced',
    ];

    difficultyLevels.forEach((difficulty) => {
      it(`should display ${difficulty} difficulty correctly`, () => {
        // Arrange
        const tutorialWithDifficulty = {
          ...mockTutorial,
          difficulty,
        };

        // Act
        render(<TutorialInfoCard tutorialData={tutorialWithDifficulty} />);

        // Assert
        expect(screen.getByText(difficulty)).toBeInTheDocument();
        expect(screen.getByText(difficulty)).toHaveClass('bg-orange-500');
      });
    });
  });

  describe('Core Concept Section', () => {
    it('should display core concept heading', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const heading = screen.getByText('Core Concept');
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveClass('text-xl', 'font-semibold', 'text-white');
    });

    it('should display core concept description', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const description = screen.getByText(
        /Use different modes starting from the same root note/,
      );
      expect(description).toBeInTheDocument();
      expect(description).toHaveClass(
        'text-slate-400',
        'text-base',
        'leading-relaxed',
      );
    });

    it('should display all core concept bullet points', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      expect(
        screen.getByText('Modal interchange over static root notes'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Advanced tension and release techniques'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('II-V-I progression variations'),
      ).toBeInTheDocument();
    });

    it('should style bullet points correctly', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const bulletPoints = screen.getAllByText(
        /Modal interchange|Advanced tension|II-V-I/,
      );
      bulletPoints.forEach((point) => {
        expect(point).toHaveClass('text-sm');
        expect(point.parentElement).toHaveClass('text-green-300');
      });
    });

    it('should display bullet point indicators', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const bulletContainers = screen
        .getAllByText(/Modal interchange|Advanced tension|II-V-I/)
        .map((text) => text.parentElement);

      bulletContainers.forEach((container) => {
        const indicator = container?.querySelector('.w-2.h-2');
        expect(indicator).toHaveClass('bg-green-400', 'rounded-full');
      });
    });
  });

  describe('Card Structure and Styling', () => {
    it('should render with correct card structure', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const card = screen.getByTestId('card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass(
        'bg-slate-800/40',
        'backdrop-blur-xl',
        'border',
        'border-slate-700/50',
        'shadow-2xl',
        'overflow-hidden',
      );
    });

    it('should have correct card content structure', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const cardContent = screen.getByTestId('card-content');
      expect(cardContent).toBeInTheDocument();
      expect(cardContent).toHaveClass('p-6');
    });

    it('should have proper section separators', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const coreConceptSection = screen.getByText('Core Concept').parentElement;
      expect(coreConceptSection).toHaveClass(
        'border-t',
        'border-slate-700/50',
        'pt-6',
      );
    });

    it('should have correct spacing between sections', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const tutorialHeader = screen.getByText(
        'Come Together Bass Lesson',
      ).parentElement;
      expect(tutorialHeader).toHaveClass('mb-6');
    });
  });

  describe('Responsive Design', () => {
    it('should have responsive text sizing', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const title = screen.getByText('Come Together Bass Lesson');
      expect(title).toHaveClass('text-3xl');

      const heading = screen.getByText('Core Concept');
      expect(heading).toHaveClass('text-xl');
    });

    it('should have appropriate spacing for mobile', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const bulletPointsContainer = screen
        .getByText('Modal interchange over static root notes')
        .closest('.space-y-2');
      expect(bulletPointsContainer).toHaveClass('space-y-2');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const mainTitle = screen.getByRole('heading', { level: 1 });
      expect(mainTitle).toHaveTextContent('Come Together Bass Lesson');

      const coreConceptHeading = screen.getByRole('heading', { level: 3 });
      expect(coreConceptHeading).toHaveTextContent('Core Concept');
    });

    it('should have semantic HTML structure', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const title = screen.getByRole('heading', { level: 1 });
      expect(title.tagName).toBe('H1');

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading.tagName).toBe('H3');
    });

    it('should have readable color contrast', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const description = screen.getByText(
        'Learn the iconic bass line from The Beatles classic with advanced modal techniques',
      );
      expect(description).toHaveClass('text-slate-400');

      const coreConceptHeading = screen.getByText('Core Concept');
      expect(coreConceptHeading).toHaveClass('text-white');
    });
  });

  describe('Visual Indicators', () => {
    it('should have gradient text effect on title', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const title = screen.getByText('Come Together Bass Lesson');
      expect(title).toHaveClass(
        'bg-gradient-to-r',
        'from-blue-300',
        'via-purple-300',
        'to-pink-300',
        'bg-clip-text',
        'text-transparent',
      );
    });

    it('should have proper visual hierarchy with margins', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const title = screen.getByText('Come Together Bass Lesson');
      expect(title).toHaveClass('mb-3');

      const coreConceptHeading = screen.getByText('Core Concept');
      expect(coreConceptHeading).toHaveClass('mb-3');
    });

    it('should have consistent bullet point styling', () => {
      // Act
      render(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      const bulletItems = screen
        .getAllByText(/Modal interchange|Advanced tension|II-V-I/)
        .map((text) => text.parentElement);

      bulletItems.forEach((item) => {
        expect(item).toHaveClass(
          'flex',
          'items-center',
          'gap-2',
          'text-green-300',
        );
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string values gracefully', () => {
      // Arrange
      const tutorialWithEmptyStrings = {
        ...mockTutorial,
        title: '',
        description: '',
        difficulty: '' as any,
      };

      // Act
      render(<TutorialInfoCard tutorialData={tutorialWithEmptyStrings} />);

      // Assert
      expect(screen.getByText('Come Together')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Learn advanced modal thinking and tension/release techniques',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('advanced')).toBeInTheDocument();
    });

    it('should handle null values gracefully', () => {
      // Arrange
      const tutorialWithNulls = {
        ...mockTutorial,
        title: null,
        description: null,
        difficulty: null,
      } as any;

      // Act
      render(<TutorialInfoCard tutorialData={tutorialWithNulls} />);

      // Assert
      expect(screen.getByText('Come Together')).toBeInTheDocument();
      expect(
        screen.getByText(
          'Learn advanced modal thinking and tension/release techniques',
        ),
      ).toBeInTheDocument();
      expect(screen.getByText('advanced')).toBeInTheDocument();
    });

    it('should handle very long title gracefully', () => {
      // Arrange
      const longTitle =
        'This is a very long tutorial title that might wrap to multiple lines and test the responsive behavior of the component layout';
      const tutorialWithLongTitle = {
        ...mockTutorial,
        title: longTitle,
      };

      // Act
      render(<TutorialInfoCard tutorialData={tutorialWithLongTitle} />);

      // Assert
      expect(screen.getByText(longTitle)).toBeInTheDocument();
      const title = screen.getByText(longTitle);
      expect(title).toHaveClass('text-3xl');
    });

    it('should handle very long description gracefully', () => {
      // Arrange
      const longDescription =
        'This is a very long description that tests how the component handles extensive text content and whether it maintains proper spacing and readability when dealing with longer content blocks that might wrap to multiple lines.';
      const tutorialWithLongDescription = {
        ...mockTutorial,
        description: longDescription,
      };

      // Act
      render(<TutorialInfoCard tutorialData={tutorialWithLongDescription} />);

      // Assert
      expect(screen.getByText(longDescription)).toBeInTheDocument();
      const description = screen.getByText(longDescription);
      expect(description).toHaveClass('text-slate-400', 'text-base');
    });
  });

  describe('Performance', () => {
    it('should render consistently across multiple renders', () => {
      // Act
      const { rerender } = render(
        <TutorialInfoCard tutorialData={mockTutorial} />,
      );

      expect(screen.getByText('Come Together Bass Lesson')).toBeInTheDocument();

      rerender(<TutorialInfoCard tutorialData={mockTutorial} />);
      rerender(<TutorialInfoCard tutorialData={mockTutorial} />);

      // Assert
      expect(screen.getByText('Come Together Bass Lesson')).toBeInTheDocument();
      expect(screen.getByText('intermediate')).toBeInTheDocument();
    });

    it('should handle prop changes efficiently', () => {
      // Arrange
      const firstTutorial = {
        ...mockTutorial,
        title: 'First Tutorial',
        difficulty: 'beginner' as const,
      };
      const secondTutorial = {
        ...mockTutorial,
        title: 'Second Tutorial',
        difficulty: 'advanced' as const,
      };

      // Act
      const { rerender } = render(
        <TutorialInfoCard tutorialData={firstTutorial} />,
      );

      expect(screen.getByText('First Tutorial')).toBeInTheDocument();
      expect(screen.getByText('beginner')).toBeInTheDocument();

      rerender(<TutorialInfoCard tutorialData={secondTutorial} />);

      // Assert
      expect(screen.getByText('Second Tutorial')).toBeInTheDocument();
      expect(screen.getByText('advanced')).toBeInTheDocument();
      expect(screen.queryByText('First Tutorial')).not.toBeInTheDocument();
      expect(screen.queryByText('beginner')).not.toBeInTheDocument();
    });
  });
});
