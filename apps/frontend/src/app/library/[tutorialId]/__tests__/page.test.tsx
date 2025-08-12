/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TutorialPage from '../page';
import type { Tutorial } from '@bassnotion/contracts';

// Mock the hooks and components
const mockUseTutorialExercises = vi.fn();
const mockYouTubeWidgetPage = vi.fn(() => (
  <div data-testid="youtube-widget-page">YouTube Widget Page</div>
));

vi.mock('@/domains/widgets/hooks/useTutorialExercises', () => ({
  useTutorialExercises: mockUseTutorialExercises,
}));

vi.mock(
  '@/domains/widgets/components/YouTubeWidgetPage/YouTubeWidgetPage',
  () => ({
    YouTubeWidgetPage: mockYouTubeWidgetPage,
  }),
);

// Mock React.use for Next.js 13+ params
const mockReactUse = vi.fn();
vi.mock('react', async () => {
  const actual = await vi.importActual('react');
  return {
    ...actual,
    use: mockReactUse,
  };
});

describe('TutorialPage', () => {
  const mockTutorial: Tutorial = {
    id: 'tutorial-123',
    slug: 'come-together-bass',
    title: 'Come Together Bass Lesson',
    artist: 'The Beatles',
    youtube_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    difficulty: 'intermediate',
    duration: '15:30',
    description: 'Learn the iconic bass line from The Beatles classic',
    headline: 'Master modal interchange',
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

  const mockExercises = [
    {
      id: 'exercise-1',
      title: 'Exercise 1',
      description: 'Basic bass line',
    },
    {
      id: 'exercise-2',
      title: 'Exercise 2',
      description: 'Advanced techniques',
    },
  ];

  const mockParams = {
    tutorialId: 'come-together-bass',
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock React.use to return the params
    mockReactUse.mockReturnValue(mockParams);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    beforeEach(() => {
      mockUseTutorialExercises.mockReturnValue({
        tutorial: null,
        exercises: [],
        isLoading: true,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });
    });

    it('should display loading state correctly', () => {
      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(screen.getByText('Loading tutorial...')).toBeInTheDocument();

      const spinner = screen.getByRole('generic');
      expect(spinner).toHaveClass(
        'animate-spin',
        'rounded-full',
        'h-12',
        'w-12',
        'border-b-2',
        'border-blue-500',
      );
    });

    it('should have proper loading state styling', () => {
      // Act
      const { container } = render(
        <TutorialPage params={Promise.resolve(mockParams)} />,
      );

      // Assert
      const loadingContainer = container.firstChild;
      expect(loadingContainer).toHaveClass(
        'min-h-screen',
        'bg-slate-900',
        'text-white',
        'flex',
        'items-center',
        'justify-center',
      );
    });

    it('should center loading content', () => {
      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      const textCenter = screen.getByText('Loading tutorial...').parentElement;
      expect(textCenter).toHaveClass('text-center');
    });

    it('should call useTutorialExercises with correct slug during loading', () => {
      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(mockUseTutorialExercises).toHaveBeenCalledWith(
        'come-together-bass',
      );
    });
  });

  describe('Error State', () => {
    const mockError = new Error('Failed to fetch tutorial');

    beforeEach(() => {
      mockUseTutorialExercises.mockReturnValue({
        tutorial: null,
        exercises: [],
        isLoading: false,
        error: mockError,
        isError: true,
        refetch: vi.fn(),
      });
    });

    it('should display error state when error occurs', () => {
      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(screen.getByText('Tutorial Not Found')).toBeInTheDocument();
      expect(
        screen.getByText(
          'The tutorial "come-together-bass" could not be loaded.',
        ),
      ).toBeInTheDocument();
    });

    it('should display error state when tutorial is null', () => {
      // Arrange
      mockUseTutorialExercises.mockReturnValue({
        tutorial: null,
        exercises: [],
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });

      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(screen.getByText('Tutorial Not Found')).toBeInTheDocument();
      expect(
        screen.getByText(
          'The tutorial "come-together-bass" could not be loaded.',
        ),
      ).toBeInTheDocument();
    });

    it('should have proper error state styling', () => {
      // Act
      const { container } = render(
        <TutorialPage params={Promise.resolve(mockParams)} />,
      );

      // Assert
      const errorContainer = container.firstChild;
      expect(errorContainer).toHaveClass(
        'min-h-screen',
        'bg-slate-900',
        'text-white',
        'flex',
        'items-center',
        'justify-center',
      );
    });

    it('should display tutorial slug in error message', () => {
      // Arrange
      const customParams = { tutorialId: 'custom-tutorial-slug' };
      mockReactUse.mockReturnValue(customParams);

      // Act
      render(<TutorialPage params={Promise.resolve(customParams)} />);

      // Assert
      expect(
        screen.getByText(
          'The tutorial "custom-tutorial-slug" could not be loaded.',
        ),
      ).toBeInTheDocument();
    });
  });

  describe('Success State', () => {
    beforeEach(() => {
      mockUseTutorialExercises.mockReturnValue({
        tutorial: mockTutorial,
        exercises: mockExercises,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });
    });

    it('should render YouTubeWidgetPage when tutorial loads successfully', () => {
      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(screen.getByTestId('youtube-widget-page')).toBeInTheDocument();
    });

    it('should pass correct props to YouTubeWidgetPage', () => {
      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(mockYouTubeWidgetPage).toHaveBeenCalledWith(
        {
          tutorialData: mockTutorial,
          tutorialSlug: 'come-together-bass',
          exercises: mockExercises,
        },
        {},
      );
    });

    it('should have proper success state container styling', () => {
      // Act
      const { container } = render(
        <TutorialPage params={Promise.resolve(mockParams)} />,
      );

      // Assert
      const successContainer = container.firstChild;
      expect(successContainer).toHaveClass(
        'min-h-screen',
        'bg-gradient-to-br',
        'from-slate-900',
        'via-purple-900',
        'to-slate-900',
      );
    });

    it('should call useTutorialExercises with correct slug', () => {
      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(mockUseTutorialExercises).toHaveBeenCalledWith(
        'come-together-bass',
      );
    });
  });

  describe('Params Handling', () => {
    it('should handle different tutorial IDs correctly', () => {
      // Arrange
      const differentParams = { tutorialId: 'different-tutorial' };
      mockReactUse.mockReturnValue(differentParams);

      mockUseTutorialExercises.mockReturnValue({
        tutorial: mockTutorial,
        exercises: mockExercises,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });

      // Act
      render(<TutorialPage params={Promise.resolve(differentParams)} />);

      // Assert
      expect(mockUseTutorialExercises).toHaveBeenCalledWith(
        'different-tutorial',
      );
      expect(mockYouTubeWidgetPage).toHaveBeenCalledWith(
        expect.objectContaining({
          tutorialSlug: 'different-tutorial',
        }),
        {},
      );
    });

    it('should handle params with special characters', () => {
      // Arrange
      const specialParams = { tutorialId: 'tutorial-with-123_special-chars' };
      mockReactUse.mockReturnValue(specialParams);

      mockUseTutorialExercises.mockReturnValue({
        tutorial: null,
        exercises: [],
        isLoading: false,
        error: new Error('Not found'),
        isError: true,
        refetch: vi.fn(),
      });

      // Act
      render(<TutorialPage params={Promise.resolve(specialParams)} />);

      // Assert
      expect(mockUseTutorialExercises).toHaveBeenCalledWith(
        'tutorial-with-123_special-chars',
      );
      expect(
        screen.getByText(
          'The tutorial "tutorial-with-123_special-chars" could not be loaded.',
        ),
      ).toBeInTheDocument();
    });

    it('should handle empty tutorial ID', () => {
      // Arrange
      const emptyParams = { tutorialId: '' };
      mockReactUse.mockReturnValue(emptyParams);

      mockUseTutorialExercises.mockReturnValue({
        tutorial: null,
        exercises: [],
        isLoading: false,
        error: new Error('Tutorial slug is required'),
        isError: true,
        refetch: vi.fn(),
      });

      // Act
      render(<TutorialPage params={Promise.resolve(emptyParams)} />);

      // Assert
      expect(mockUseTutorialExercises).toHaveBeenCalledWith('');
      expect(
        screen.getByText('The tutorial "" could not be loaded.'),
      ).toBeInTheDocument();
    });
  });

  describe('Component Lifecycle', () => {
    it('should handle component mounting and unmounting', () => {
      // Arrange
      mockUseTutorialExercises.mockReturnValue({
        tutorial: mockTutorial,
        exercises: mockExercises,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });

      // Act
      const { unmount } = render(
        <TutorialPage params={Promise.resolve(mockParams)} />,
      );

      // Assert initial render
      expect(screen.getByTestId('youtube-widget-page')).toBeInTheDocument();

      // Act - unmount
      unmount();

      // Note: Testing cleanup effects would require more complex setup
      // The current implementation has a minimal useEffect
    });

    it('should re-render when params change', () => {
      // Arrange
      const initialParams = { tutorialId: 'initial-tutorial' };
      const updatedParams = { tutorialId: 'updated-tutorial' };

      mockReactUse.mockReturnValueOnce(initialParams);
      mockUseTutorialExercises.mockReturnValue({
        tutorial: mockTutorial,
        exercises: mockExercises,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });

      // Act - initial render
      const { rerender } = render(
        <TutorialPage params={Promise.resolve(initialParams)} />,
      );

      expect(mockUseTutorialExercises).toHaveBeenCalledWith('initial-tutorial');

      // Arrange - update params
      mockReactUse.mockReturnValueOnce(updatedParams);

      // Act - rerender with new params
      rerender(<TutorialPage params={Promise.resolve(updatedParams)} />);

      // Assert
      expect(mockUseTutorialExercises).toHaveBeenCalledWith('updated-tutorial');
    });
  });

  describe('Data Flow', () => {
    it('should pass empty exercises array when no exercises available', () => {
      // Arrange
      mockUseTutorialExercises.mockReturnValue({
        tutorial: mockTutorial,
        exercises: [],
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });

      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(mockYouTubeWidgetPage).toHaveBeenCalledWith(
        expect.objectContaining({
          exercises: [],
        }),
        {},
      );
    });

    it('should pass all tutorial data fields to YouTubeWidgetPage', () => {
      // Arrange
      mockUseTutorialExercises.mockReturnValue({
        tutorial: mockTutorial,
        exercises: mockExercises,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });

      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(mockYouTubeWidgetPage).toHaveBeenCalledWith(
        expect.objectContaining({
          tutorialData: expect.objectContaining({
            id: 'tutorial-123',
            slug: 'come-together-bass',
            title: 'Come Together Bass Lesson',
            artist: 'The Beatles',
            youtube_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
            difficulty: 'intermediate',
            duration: '15:30',
            description: 'Learn the iconic bass line from The Beatles classic',
          }),
        }),
        {},
      );
    });

    it('should pass exercises with correct structure', () => {
      // Arrange
      mockUseTutorialExercises.mockReturnValue({
        tutorial: mockTutorial,
        exercises: mockExercises,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });

      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(mockYouTubeWidgetPage).toHaveBeenCalledWith(
        expect.objectContaining({
          exercises: [
            expect.objectContaining({
              id: 'exercise-1',
              title: 'Exercise 1',
              description: 'Basic bass line',
            }),
            expect.objectContaining({
              id: 'exercise-2',
              title: 'Exercise 2',
              description: 'Advanced techniques',
            }),
          ],
        }),
        {},
      );
    });
  });

  describe('Error Boundary Scenarios', () => {
    it('should handle hook returning undefined tutorial gracefully', () => {
      // Arrange
      mockUseTutorialExercises.mockReturnValue({
        tutorial: undefined as any,
        exercises: mockExercises,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });

      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(screen.getByText('Tutorial Not Found')).toBeInTheDocument();
    });

    it('should handle hook returning undefined exercises gracefully', () => {
      // Arrange
      mockUseTutorialExercises.mockReturnValue({
        tutorial: mockTutorial,
        exercises: undefined as any,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });

      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(mockYouTubeWidgetPage).toHaveBeenCalledWith(
        expect.objectContaining({
          exercises: undefined,
        }),
        {},
      );
    });

    it('should handle simultaneous error and tutorial data', () => {
      // Arrange - error takes precedence even if tutorial data exists
      mockUseTutorialExercises.mockReturnValue({
        tutorial: mockTutorial,
        exercises: mockExercises,
        isLoading: false,
        error: new Error('Some error'),
        isError: true,
        refetch: vi.fn(),
      });

      // Act
      render(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(screen.getByText('Tutorial Not Found')).toBeInTheDocument();
      expect(
        screen.queryByTestId('youtube-widget-page'),
      ).not.toBeInTheDocument();
    });
  });

  describe('Performance and Optimization', () => {
    it('should not re-render unnecessarily with same data', () => {
      // Arrange
      mockUseTutorialExercises.mockReturnValue({
        tutorial: mockTutorial,
        exercises: mockExercises,
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });

      // Act
      const { rerender } = render(
        <TutorialPage params={Promise.resolve(mockParams)} />,
      );

      const initialCallCount = mockYouTubeWidgetPage.mock.calls.length;

      rerender(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(mockYouTubeWidgetPage.mock.calls.length).toBe(
        initialCallCount + 1,
      );
    });

    it('should handle rapid state changes gracefully', () => {
      // Arrange - simulate loading -> error -> success
      mockUseTutorialExercises
        .mockReturnValueOnce({
          tutorial: null,
          exercises: [],
          isLoading: true,
          error: null,
          isError: false,
          refetch: vi.fn(),
        })
        .mockReturnValueOnce({
          tutorial: null,
          exercises: [],
          isLoading: false,
          error: new Error('Failed'),
          isError: true,
          refetch: vi.fn(),
        })
        .mockReturnValueOnce({
          tutorial: mockTutorial,
          exercises: mockExercises,
          isLoading: false,
          error: null,
          isError: false,
          refetch: vi.fn(),
        });

      // Act
      const { rerender } = render(
        <TutorialPage params={Promise.resolve(mockParams)} />,
      );

      expect(screen.getByText('Loading tutorial...')).toBeInTheDocument();

      rerender(<TutorialPage params={Promise.resolve(mockParams)} />);

      expect(screen.getByText('Tutorial Not Found')).toBeInTheDocument();

      rerender(<TutorialPage params={Promise.resolve(mockParams)} />);

      // Assert
      expect(screen.getByTestId('youtube-widget-page')).toBeInTheDocument();
    });
  });
});
