/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renderWithProviders as render,
  screen,
} from '@/test/utils/renderWithProviders';
import userEvent from '@testing-library/user-event';
import LibraryPage from '../page';
import type { TutorialSummary } from '@bassnotion/contracts';

// Wrap mocks in vi.hoisted so the references survive vi.mock's hoisting
// (otherwise the factory closes over an undeclared binding).
const { mockNavigateWithTransition, mockUseTutorials, mockRefetch } =
  vi.hoisted(() => ({
    mockNavigateWithTransition: vi.fn(),
    mockUseTutorials: vi.fn(),
    mockRefetch: vi.fn(),
  }));

vi.mock('@/lib/hooks/use-view-transition-router', () => ({
  useViewTransitionRouter: () => ({
    navigateWithTransition: mockNavigateWithTransition,
  }),
}));

vi.mock('@/domains/widgets/hooks/useTutorials', () => ({
  useTutorials: mockUseTutorials,
}));

// Don't mock Button/Card or lucide-react. The earlier test mocked Button
// to render emoji icon stubs and asserted on those — production no longer
// renders text on the back button (it's icon-only with a title attr).
// Real components keep the assertions honest.

// Stub next/image, HomeNavbar, UserIndicator — they pull in unrelated
// dependencies (router events, Supabase auth) that aren't relevant to
// the page's render contract.
vi.mock('next/image', () => ({
  default: (props: any) => <img {...props} alt={props.alt} />,
}));

vi.mock('@/shared/components/HomeNavbar', () => ({
  HomeNavbar: () => <nav data-testid="home-navbar" />,
}));

vi.mock('@/shared/components/UserIndicator', () => ({
  UserIndicator: () => <div data-testid="user-indicator" />,
}));

// Stub admin role check so isAdmin is always false (keeps the "+ New
// Tutorial" button hidden, which is the default render path).
vi.mock('@/domains/user/hooks/useUserRole', () => ({
  useUserRole: () => ({ isAdmin: false, isLoading: false }),
}));

// PageErrorBoundary — pass children through; we're not testing its catch
// behavior here, just the page render path.
vi.mock('@/shared/components/PageErrorBoundary', () => ({
  PageErrorBoundary: ({ children }: any) => <>{children}</>,
}));

describe('LibraryPage', () => {
  const mockTutorials: TutorialSummary[] = [
    {
      id: 'tutorial-1',
      slug: 'come-together-bass',
      title: 'Come Together Bass Lesson',
      youtube_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
      youtube_id: 'dQw4w9WgXcQ',
      difficulty: 'intermediate',
      duration: '15:30',
      description: 'Learn the iconic bass line from The Beatles classic',
      thumbnail_url: 'https://example.com/thumbnail.jpg',
      is_active: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      exercise_count: 5,
    } as any,
    {
      id: 'tutorial-2',
      slug: 'beginner-bass-fundamentals',
      title: 'Bass Fundamentals for Beginners',
      youtube_url: 'https://youtube.com/watch?v=example2',
      youtube_id: 'example2',
      difficulty: 'beginner',
      duration: '8:45',
      description: 'Essential techniques for new bass players',
      thumbnail_url: null,
      is_active: true,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      exercise_count: 3,
    } as any,
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

    it('should display loading copy + title', () => {
      render(<LibraryPage />);
      expect(screen.getByText('Loading tutorials...')).toBeInTheDocument();
      expect(screen.getByText('Tutorial Library')).toBeInTheDocument();
    });

    it('should show back-to-home button (icon-only with title attr)', () => {
      render(<LibraryPage />);
      // Back button is icon-only; identify by accessible title.
      const backBtn = screen.getByTitle('Back to Home');
      expect(backBtn).toBeInTheDocument();
    });

    it('should navigate to home when back button clicked during loading', async () => {
      const user = userEvent.setup();
      render(<LibraryPage />);
      await user.click(screen.getByTitle('Back to Home'));
      expect(mockNavigateWithTransition).toHaveBeenCalledWith('/');
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

    it('should display error state with message + retry button', () => {
      render(<LibraryPage />);
      expect(screen.getByText('Unable to Load Tutorials')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch tutorials')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('should call refetch when retry clicked', async () => {
      const user = userEvent.setup();
      render(<LibraryPage />);
      await user.click(screen.getByText('Try Again'));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });

    it('should display default error message when none provided', () => {
      mockUseTutorials.mockReturnValue({
        tutorials: [],
        total: 0,
        isLoading: false,
        error: null,
        isError: true,
        refetch: mockRefetch,
      });
      render(<LibraryPage />);
      expect(
        screen.getByText(
          'There was an error loading the tutorials. Please try again.',
        ),
      ).toBeInTheDocument();
    });

    it('should navigate to home when back clicked during error', async () => {
      const user = userEvent.setup();
      render(<LibraryPage />);
      await user.click(screen.getByTitle('Back to Home'));
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

    it('should display empty state copy', () => {
      render(<LibraryPage />);
      expect(
        screen.getByText('No tutorials available at the moment.'),
      ).toBeInTheDocument();
    });

    it('should NOT display tutorial count when empty', () => {
      render(<LibraryPage />);
      // The count format is "<N> tutorial(s) available". Need a tighter
      // regex than /tutorial.*available/ because the empty-state copy
      // is "No tutorials available at the moment."
      expect(screen.queryByText(/^\d+ tutorial/)).not.toBeInTheDocument();
    });

    it('should still show title + back button when empty', () => {
      render(<LibraryPage />);
      expect(screen.getByText('Tutorial Library')).toBeInTheDocument();
      expect(screen.getByTitle('Back to Home')).toBeInTheDocument();
    });
  });

  describe('Success State with Tutorials', () => {
    beforeEach(() => {
      mockUseTutorials.mockReturnValue({
        tutorials: mockTutorials,
        total: mockTutorials.length,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });
    });

    it('should display all tutorial titles', () => {
      render(<LibraryPage />);
      expect(screen.getByText('Come Together Bass Lesson')).toBeInTheDocument();
      expect(
        screen.getByText('Bass Fundamentals for Beginners'),
      ).toBeInTheDocument();
    });

    it('should display tutorial descriptions', () => {
      render(<LibraryPage />);
      expect(
        screen.getByText('Learn the iconic bass line from The Beatles classic'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Essential techniques for new bass players'),
      ).toBeInTheDocument();
    });

    it('should display difficulty + duration badges', () => {
      render(<LibraryPage />);
      // capitalizeDifficulty turns 'intermediate' → 'Intermediate'
      expect(screen.getByText('Intermediate')).toBeInTheDocument();
      expect(screen.getByText('Beginner')).toBeInTheDocument();
      expect(screen.getByText('15:30')).toBeInTheDocument();
      expect(screen.getByText('8:45')).toBeInTheDocument();
    });

    it('should display exercise count badges', () => {
      render(<LibraryPage />);
      expect(screen.getByText('5 exercises')).toBeInTheDocument();
      expect(screen.getByText('3 exercises')).toBeInTheDocument();
    });

    it('should display total tutorial count', () => {
      render(<LibraryPage />);
      expect(screen.getByText('2 tutorials available')).toBeInTheDocument();
    });

    it('should navigate to tutorial detail when card clicked', async () => {
      const user = userEvent.setup();
      render(<LibraryPage />);
      const titleEl = screen.getByText('Come Together Bass Lesson');
      // The clickable wrapper is an ancestor div with onClick
      const card = titleEl.closest('div[class*="cursor-pointer"]');
      expect(card).not.toBeNull();
      await user.click(card as HTMLElement);
      expect(mockNavigateWithTransition).toHaveBeenCalledWith(
        '/library/come-together-bass',
      );
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      mockUseTutorials.mockReturnValue({
        tutorials: mockTutorials,
        total: mockTutorials.length,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });
    });

    it('should navigate to home when back button clicked', async () => {
      const user = userEvent.setup();
      render(<LibraryPage />);
      await user.click(screen.getByTitle('Back to Home'));
      expect(mockNavigateWithTransition).toHaveBeenCalledWith('/');
    });

    it('should navigate to tutorial detail with correct slug', async () => {
      const user = userEvent.setup();
      render(<LibraryPage />);
      const titleEl = screen.getByText('Bass Fundamentals for Beginners');
      const card = titleEl.closest('div[class*="cursor-pointer"]');
      await user.click(card as HTMLElement);
      expect(mockNavigateWithTransition).toHaveBeenCalledWith(
        '/library/beginner-bass-fundamentals',
      );
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      mockUseTutorials.mockReturnValue({
        tutorials: mockTutorials,
        total: mockTutorials.length,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });
    });

    it('should have an h1 with the page title', () => {
      render(<LibraryPage />);
      const h1 = screen.getByRole('heading', { level: 1 });
      expect(h1).toHaveTextContent('Tutorial Library');
    });

    it('should expose the back button via title attribute', () => {
      render(<LibraryPage />);
      const backBtn = screen.getByTitle('Back to Home');
      expect(backBtn.tagName).toBe('BUTTON');
    });
  });

  describe('Edge Cases', () => {
    it('should handle tutorials without optional fields', () => {
      const minimalTutorial: TutorialSummary = {
        id: 'minimal',
        slug: 'minimal-tutorial',
        title: 'Minimal Tutorial',
        // No description / no duration / no exercise_count / no difficulty
        youtube_id: 'abc',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as any;

      mockUseTutorials.mockReturnValue({
        tutorials: [minimalTutorial],
        total: 1,
        isLoading: false,
        error: null,
        isError: false,
        refetch: mockRefetch,
      });

      render(<LibraryPage />);
      expect(screen.getByText('Minimal Tutorial')).toBeInTheDocument();
      expect(screen.getByText('1 tutorial available')).toBeInTheDocument();
    });
  });
});
