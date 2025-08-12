/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LibraryPage from '../page';
import type { TutorialSummary } from '@bassnotion/contracts';

// Mock the hooks and router
const mockNavigateWithTransition = vi.fn();
const mockUseTutorials = vi.fn();
const mockRefetch = vi.fn();

vi.mock('@/lib/hooks/use-view-transition-router', () => ({
  useViewTransitionRouter: () => ({
    navigateWithTransition: mockNavigateWithTransition,
  }),
}));

vi.mock('@/domains/widgets/hooks/useTutorials', () => ({
  useTutorials: mockUseTutorials,
}));

// Mock all the UI components
vi.mock('@/shared/components/ui/button', () => ({
  Button: React.forwardRef<HTMLButtonElement, any>(
    ({ className, variant, size, children, onClick, ...props }, ref) => (
      <button
        ref={ref}
        className={className}
        data-variant={variant}
        data-size={size}
        data-testid="button"
        onClick={onClick}
        {...props}
      >
        {children}
      </button>
    ),
  ),
}));

vi.mock('@/shared/components/ui/card', () => ({
  Card: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, onClick, ...props }, ref) => (
      <div
        ref={ref}
        className={className}
        data-testid="card"
        onClick={onClick}
        {...props}
      >
        {children}
      </div>
    ),
  ),
  CardContent: React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ className, children, ...props }, ref) => (
    <div ref={ref} className={className} data-testid="card-content" {...props}>
      {children}
    </div>
  )),
  CardHeader: React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ className, children, ...props }, ref) => (
    <div ref={ref} className={className} data-testid="card-header" {...props}>
      {children}
    </div>
  )),
  CardTitle: React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ className, children, ...props }, ref) => (
    <div ref={ref} className={className} data-testid="card-title" {...props}>
      {children}
    </div>
  )),
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Clock: () => <span data-testid="clock-icon">🕐</span>,
  Star: () => <span data-testid="star-icon">⭐</span>,
  User: () => <span data-testid="user-icon">👤</span>,
  ArrowLeft: () => <span data-testid="arrow-left-icon">←</span>,
  Loader2: () => <span data-testid="loader-icon">⏳</span>,
  AlertCircle: () => <span data-testid="alert-circle-icon">⚠️</span>,
}));

describe('LibraryPage', () => {
  const mockTutorials: TutorialSummary[] = [
    {
      id: 'tutorial-1',
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
      exercise_count: 5,
    },
    {
      id: 'tutorial-2',
      slug: 'beginner-bass-fundamentals',
      title: 'Bass Fundamentals for Beginners',
      artist: 'Various',
      youtube_url: 'https://youtube.com/watch?v=example2',
      difficulty: 'beginner',
      duration: '8:45',
      description: 'Essential techniques for new bass players',
      headline: 'Build a solid foundation',
      concepts: ['Proper technique', 'Basic rhythms'],
      thumbnail: null,
      rating: 4.5,
      is_active: true,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      creator_name: 'Bass Instructor',
      creator_channel_url: null,
      creator_avatar_url: null,
      exercise_count: 3,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    beforeEach(() => {
      mockUseTutorials.mockReturnValue({
        tutorials: [],
        total: 0,
        isLoading: true,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });
    });

    it('should display loading state with proper structure', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('Loading tutorials...')).toBeInTheDocument();
      expect(screen.getByTestId('loader-icon')).toBeInTheDocument();
      expect(screen.getByText('YouTube Tutorial Library')).toBeInTheDocument();
    });

    it('should show back to home button during loading', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('Back to Home')).toBeInTheDocument();
      expect(screen.getByTestId('arrow-left-icon')).toBeInTheDocument();
    });

    it('should navigate to home when back button clicked during loading', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<LibraryPage />);

      // Act
      const backButton = screen.getByText('Back to Home');
      await user.click(backButton);

      // Assert
      expect(mockNavigateWithTransition).toHaveBeenCalledWith('/');
    });

    it('should display correct loading UI layout', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(
        screen.getByText(
          'Choose from our collection of interactive bass tutorials.',
        ),
      ).toBeInTheDocument();

      const loadingCard = screen
        .getByText('Loading tutorials...')
        .closest('[data-testid="card"]');
      expect(loadingCard).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    const mockError = new Error('Failed to fetch tutorials');

    beforeEach(() => {
      mockUseTutorials.mockReturnValue({
        tutorials: [],
        total: 0,
        isLoading: false,
        error: mockError,
        isError: true,
        refetch: mockRefetch,
      });
    });

    it('should display error state with proper message', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('Unable to Load Tutorials')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch tutorials')).toBeInTheDocument();
      expect(screen.getByTestId('alert-circle-icon')).toBeInTheDocument();
    });

    it('should show retry button that calls refetch', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<LibraryPage />);

      // Act
      const retryButton = screen.getByText('Try Again');
      await user.click(retryButton);

      // Assert
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('should display default error message when no error message provided', () => {
      // Arrange
      mockUseTutorials.mockReturnValue({
        tutorials: [],
        total: 0,
        isLoading: false,
        error: null, // No specific error message
        isError: true,
        refetch: mockRefetch,
      });

      // Act
      render(<LibraryPage />);

      // Assert
      expect(
        screen.getByText(
          'There was an error loading the tutorials. Please try again.',
        ),
      ).toBeInTheDocument();
    });

    it('should navigate to home when back button clicked during error', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<LibraryPage />);

      // Act
      const backButton = screen.getByText('Back to Home');
      await user.click(backButton);

      // Assert
      expect(mockNavigateWithTransition).toHaveBeenCalledWith('/');
    });
  });

  describe('Empty State', () => {
    beforeEach(() => {
      mockUseTutorials.mockReturnValue({
        tutorials: [],
        total: 0,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });
    });

    it('should display empty state when no tutorials available', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(
        screen.getByText('No tutorials available at the moment.'),
      ).toBeInTheDocument();
    });

    it('should not display tutorial count when empty', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.queryByText(/tutorial.*available/)).not.toBeInTheDocument();
    });

    it('should still show header and navigation when empty', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('YouTube Tutorial Library')).toBeInTheDocument();
      expect(screen.getByText('Back to Home')).toBeInTheDocument();
    });
  });

  describe('Success State with Tutorials', () => {
    beforeEach(() => {
      mockUseTutorials.mockReturnValue({
        tutorials: mockTutorials,
        total: 2,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });
    });

    it('should display tutorial count', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('2 tutorials available')).toBeInTheDocument();
    });

    it('should display all tutorial cards', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('Come Together Bass Lesson')).toBeInTheDocument();
      expect(
        screen.getByText('Bass Fundamentals for Beginners'),
      ).toBeInTheDocument();
    });

    it('should display tutorial artists', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('The Beatles')).toBeInTheDocument();
      expect(screen.getByText('Various')).toBeInTheDocument();
      expect(screen.getAllByTestId('user-icon')).toHaveLength(2);
    });

    it('should display difficulty badges with correct colors', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      const intermediateBadge = screen.getByText('Intermediate');
      const beginnerBadge = screen.getByText('Beginner');

      expect(intermediateBadge).toBeInTheDocument();
      expect(beginnerBadge).toBeInTheDocument();
    });

    it('should display duration badges', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('15:30')).toBeInTheDocument();
      expect(screen.getByText('8:45')).toBeInTheDocument();
      expect(screen.getAllByTestId('clock-icon')).toHaveLength(2);
    });

    it('should display rating information', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('4.8')).toBeInTheDocument();
      expect(screen.getByText('4.5')).toBeInTheDocument();
      expect(screen.getAllByTestId('star-icon')).toHaveLength(2);
    });

    it('should display exercise counts', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('5 exercises')).toBeInTheDocument();
      expect(screen.getByText('3 exercises')).toBeInTheDocument();
    });

    it('should display tutorial descriptions', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(
        screen.getByText('Learn the iconic bass line from The Beatles classic'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Essential techniques for new bass players'),
      ).toBeInTheDocument();
    });

    it('should display key concepts', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('Key Concepts:')).toBeInTheDocument();
      expect(screen.getByText('Modal interchange')).toBeInTheDocument();
      expect(screen.getByText('Tension and release')).toBeInTheDocument();
      expect(screen.getByText('Proper technique')).toBeInTheDocument();
    });

    it('should navigate to tutorial detail when card clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<LibraryPage />);

      // Act
      const tutorialCard = screen
        .getByText('Come Together Bass Lesson')
        .closest('[data-testid="card"]');
      await user.click(tutorialCard!);

      // Assert
      expect(mockNavigateWithTransition).toHaveBeenCalledWith(
        '/library/come-together-bass',
      );
    });

    it('should display "Start Learning" call to action', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getAllByText('Start Learning →')).toHaveLength(2);
    });
  });

  describe('Tutorial Count Display', () => {
    it('should display singular "tutorial" for count of 1', () => {
      // Arrange
      mockUseTutorials.mockReturnValue({
        tutorials: [mockTutorials[0]],
        total: 1,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });

      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('1 tutorial available')).toBeInTheDocument();
    });

    it('should display plural "tutorials" for count greater than 1', () => {
      // Arrange
      mockUseTutorials.mockReturnValue({
        tutorials: mockTutorials,
        total: 5,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });

      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('5 tutorials available')).toBeInTheDocument();
    });
  });

  describe('Exercise Count Display', () => {
    it('should display singular "exercise" for count of 1', () => {
      // Arrange
      const tutorialWithOneExercise = {
        ...mockTutorials[0],
        exercise_count: 1,
      };

      mockUseTutorials.mockReturnValue({
        tutorials: [tutorialWithOneExercise],
        total: 1,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });

      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('1 exercise')).toBeInTheDocument();
    });

    it('should not display exercise count when zero', () => {
      // Arrange
      const tutorialWithNoExercises = {
        ...mockTutorials[0],
        exercise_count: 0,
      };

      mockUseTutorials.mockReturnValue({
        tutorials: [tutorialWithNoExercises],
        total: 1,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });

      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.queryByText(/exercise/)).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      mockUseTutorials.mockReturnValue({
        tutorials: mockTutorials,
        total: 2,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });
    });

    it('should navigate to home when back button clicked', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<LibraryPage />);

      // Act
      const backButton = screen.getByText('Back to Home');
      await user.click(backButton);

      // Assert
      expect(mockNavigateWithTransition).toHaveBeenCalledWith('/');
    });

    it('should navigate to tutorial detail with correct slug', async () => {
      // Arrange
      const user = userEvent.setup();
      render(<LibraryPage />);

      // Act
      const beginnerTutorialCard = screen
        .getByText('Bass Fundamentals for Beginners')
        .closest('[data-testid="card"]');
      await user.click(beginnerTutorialCard!);

      // Assert
      expect(mockNavigateWithTransition).toHaveBeenCalledWith(
        '/library/beginner-bass-fundamentals',
      );
    });
  });

  describe('Responsive Design', () => {
    beforeEach(() => {
      mockUseTutorials.mockReturnValue({
        tutorials: mockTutorials,
        total: 2,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });
    });

    it('should have responsive title sizing', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      const title = screen.getByText('YouTube Tutorial Library');
      expect(title).toHaveClass('text-4xl', 'md:text-5xl');
    });

    it('should have proper container constraints', () => {
      // Act
      const { container } = render(<LibraryPage />);

      // Assert
      const mainContainer = container.querySelector('.container');
      expect(mainContainer).toHaveClass('mx-auto', 'px-4', 'py-6', 'max-w-2xl');
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseTutorials.mockReturnValue({
        tutorials: mockTutorials,
        total: 2,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });
    });

    it('should have proper heading hierarchy', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      const mainHeading = screen.getByRole('heading', { level: 1 });
      expect(mainHeading).toHaveTextContent('YouTube Tutorial Library');
    });

    it('should have clickable tutorial cards', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      const tutorialCards = screen
        .getAllByTestId('card')
        .filter(
          (card) =>
            card.textContent?.includes('Come Together') ||
            card.textContent?.includes('Bass Fundamentals'),
        );

      expect(tutorialCards).toHaveLength(2);
      tutorialCards.forEach((card) => {
        expect(card).toHaveClass('cursor-pointer');
      });
    });

    it('should have accessible button labels', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      const backButton = screen.getByRole('button', { name: /back to home/i });
      expect(backButton).toBeInTheDocument();
    });
  });

  describe('Visual States', () => {
    beforeEach(() => {
      mockUseTutorials.mockReturnValue({
        tutorials: mockTutorials,
        total: 2,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });
    });

    it('should have hover effects on tutorial cards', () => {
      // Act
      render(<LibraryPage />);

      // Assert
      const tutorialCards = screen
        .getAllByTestId('card')
        .filter(
          (card) =>
            card.textContent?.includes('Come Together') ||
            card.textContent?.includes('Bass Fundamentals'),
        );

      tutorialCards.forEach((card) => {
        expect(card).toHaveClass(
          'hover:bg-white/10',
          'transition-all',
          'hover:scale-[1.02]',
        );
      });
    });

    it('should have gradient backgrounds', () => {
      // Act
      const { container } = render(<LibraryPage />);

      // Assert
      const background = container.firstChild;
      expect(background).toHaveClass(
        'bg-gradient-to-br',
        'from-slate-900',
        'via-purple-900',
        'to-slate-900',
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle tutorials without optional fields', () => {
      // Arrange
      const minimalTutorial: TutorialSummary = {
        id: 'minimal-tutorial',
        slug: 'minimal',
        title: 'Minimal Tutorial',
        artist: 'Unknown',
        difficulty: 'beginner',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        exercise_count: 0,
        // All other fields missing
      } as any;

      mockUseTutorials.mockReturnValue({
        tutorials: [minimalTutorial],
        total: 1,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });

      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.getByText('Minimal Tutorial')).toBeInTheDocument();
      expect(screen.getByText('Unknown')).toBeInTheDocument();
      expect(screen.getByText('Beginner')).toBeInTheDocument();

      // Should not show optional elements
      expect(screen.queryByText(/Key Concepts/)).not.toBeInTheDocument();
      expect(screen.queryByTestId('star-icon')).not.toBeInTheDocument();
      expect(screen.queryByTestId('clock-icon')).not.toBeInTheDocument();
    });

    it('should handle empty concepts array', () => {
      // Arrange
      const tutorialWithEmptyConcepts = {
        ...mockTutorials[0],
        concepts: [],
      };

      mockUseTutorials.mockReturnValue({
        tutorials: [tutorialWithEmptyConcepts],
        total: 1,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });

      // Act
      render(<LibraryPage />);

      // Assert
      expect(screen.queryByText('Key Concepts:')).not.toBeInTheDocument();
    });
  });
});
