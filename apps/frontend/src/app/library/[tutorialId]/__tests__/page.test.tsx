/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  renderWithProviders as render,
  screen,
} from '@/test/utils/renderWithProviders';
import TutorialPage from '../page';
import type { Tutorial } from '@bassnotion/contracts';

// Wrap mock refs in vi.hoisted so they survive vi.mock's hoisting.
const {
  mockUseTutorialExercises,
  mockYouTubeWidgetPage,
  mockTutorialPageSkeleton,
  mockReactUse,
  mockUseSearchParams,
} = vi.hoisted(() => ({
  mockUseTutorialExercises: vi.fn(),
  mockYouTubeWidgetPage: vi.fn(() => <div data-testid="youtube-widget-page" />),
  mockTutorialPageSkeleton: vi.fn(() => (
    <div data-testid="tutorial-page-skeleton" />
  )),
  mockReactUse: vi.fn(),
  mockUseSearchParams: vi.fn(() => ({ get: () => null })),
}));

vi.mock('@/domains/widgets/hooks/useTutorialExercises', () => ({
  useTutorialExercises: mockUseTutorialExercises,
}));

vi.mock(
  '@/domains/widgets/components/YouTubeWidgetPage/YouTubeWidgetPage',
  () => ({
    YouTubeWidgetPage: mockYouTubeWidgetPage,
  }),
);

vi.mock(
  '@/domains/widgets/components/YouTubeWidgetPage/TutorialPageSkeleton',
  () => ({
    TutorialPageSkeleton: mockTutorialPageSkeleton,
  }),
);

// Stub the ScrollTriggerLoader so it doesn't try to actually preload
// samples / hit CoreServices during the test (different concerns).
vi.mock('@/domains/playback/components/ScrollTriggerLoader', () => ({
  ScrollTriggerLoader: () => <div data-testid="scroll-trigger-loader" />,
}));

// PageErrorBoundary — pass through; not testing its catch behavior.
vi.mock('@/shared/components/ErrorBoundary', () => ({
  PageErrorBoundary: ({ children }: any) => <>{children}</>,
}));

// Mock Next.js search params hook.
vi.mock('next/navigation', () => ({
  useSearchParams: mockUseSearchParams,
}));

// Mock React.use for Next.js 13+ params (production calls
// React.use(params) since params is a Promise). The page uses
// `import React from 'react'` AND named hooks (useMemo / useEffect),
// so we need both the named export and the default export to include
// our spied `use`. The default export *is* the namespace object in
// React's CJS bundle — so we wrap actual to expose .use on both.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  const overridden = { ...actual, use: mockReactUse };
  // The default export needs the same shape; otherwise
  // `import React from 'react'` lands on the unpatched original.
  return { ...overridden, default: overridden };
});

describe('TutorialPage', () => {
  const mockTutorial: Tutorial = {
    id: 'tutorial-123',
    slug: 'come-together-bass',
    title: 'Come Together Bass Lesson',
    youtube_url: 'https://youtube.com/watch?v=dQw4w9WgXcQ',
    difficulty: 'intermediate',
    duration: '15:30',
    description: 'Learn the iconic bass line',
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as any;

  const mockExercises = [
    { id: 'exercise-1', title: 'Exercise 1' },
    { id: 'exercise-2', title: 'Exercise 2' },
  ];

  const mockParams = { tutorialId: 'come-together-bass' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockReactUse.mockReturnValue(mockParams);
    mockUseSearchParams.mockReturnValue({ get: () => null });
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

    it('should render the TutorialPageSkeleton', () => {
      render(<TutorialPage params={Promise.resolve(mockParams) as any} />);
      expect(screen.getByTestId('tutorial-page-skeleton')).toBeInTheDocument();
      expect(mockTutorialPageSkeleton).toHaveBeenCalled();
    });

    it('should NOT render YouTubeWidgetPage while loading', () => {
      render(<TutorialPage params={Promise.resolve(mockParams) as any} />);
      expect(
        screen.queryByTestId('youtube-widget-page'),
      ).not.toBeInTheDocument();
    });

    it('should call useTutorialExercises with the resolved slug', () => {
      render(<TutorialPage params={Promise.resolve(mockParams) as any} />);
      expect(mockUseTutorialExercises).toHaveBeenCalledWith(
        'come-together-bass',
      );
    });
  });

  describe('Error State', () => {
    beforeEach(() => {
      mockUseTutorialExercises.mockReturnValue({
        tutorial: null,
        exercises: [],
        isLoading: false,
        error: new Error('Failed to load'),
        isError: true,
        refetch: vi.fn(),
      });
    });

    it('should display "Tutorial Not Found" heading', () => {
      render(<TutorialPage params={Promise.resolve(mockParams) as any} />);
      expect(screen.getByText('Tutorial Not Found')).toBeInTheDocument();
    });

    it('should display the resolved slug in the body copy', () => {
      render(<TutorialPage params={Promise.resolve(mockParams) as any} />);
      expect(
        screen.getByText(
          /The tutorial "come-together-bass" could not be loaded/,
        ),
      ).toBeInTheDocument();
    });

    it('should NOT render YouTubeWidgetPage on error', () => {
      render(<TutorialPage params={Promise.resolve(mockParams) as any} />);
      expect(
        screen.queryByTestId('youtube-widget-page'),
      ).not.toBeInTheDocument();
    });

    it('should also show error state when tutorial is null even without an error', () => {
      mockUseTutorialExercises.mockReturnValue({
        tutorial: null,
        exercises: [],
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });
      render(<TutorialPage params={Promise.resolve(mockParams) as any} />);
      expect(screen.getByText('Tutorial Not Found')).toBeInTheDocument();
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

    it('should render the YouTubeWidgetPage', () => {
      render(<TutorialPage params={Promise.resolve(mockParams) as any} />);
      expect(screen.getByTestId('youtube-widget-page')).toBeInTheDocument();
    });

    it('should pass tutorialData, slug, exercises, and initialExerciseId', () => {
      // Production reads ?exerciseId=foo from search params.
      mockUseSearchParams.mockReturnValue({
        get: (key: string) => (key === 'exerciseId' ? 'exercise-2' : null),
      });

      render(<TutorialPage params={Promise.resolve(mockParams) as any} />);

      expect(mockYouTubeWidgetPage).toHaveBeenCalledWith(
        expect.objectContaining({
          tutorialData: mockTutorial,
          tutorialSlug: 'come-together-bass',
          exercises: mockExercises,
          initialExerciseId: 'exercise-2',
        }),
        undefined,
      );
    });

    it('should pass undefined initialExerciseId when query param missing', () => {
      render(<TutorialPage params={Promise.resolve(mockParams) as any} />);

      expect(mockYouTubeWidgetPage).toHaveBeenCalledWith(
        expect.objectContaining({
          initialExerciseId: undefined,
        }),
        undefined,
      );
    });

    it('should also mount ScrollTriggerLoader alongside YouTubeWidgetPage', () => {
      render(<TutorialPage params={Promise.resolve(mockParams) as any} />);
      expect(screen.getByTestId('scroll-trigger-loader')).toBeInTheDocument();
      expect(screen.getByTestId('youtube-widget-page')).toBeInTheDocument();
    });
  });

  describe('Params Handling', () => {
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

    it('should handle different tutorial IDs correctly', () => {
      mockReactUse.mockReturnValue({ tutorialId: 'different-slug' });
      render(<TutorialPage params={Promise.resolve({}) as any} />);
      expect(mockUseTutorialExercises).toHaveBeenCalledWith('different-slug');
    });

    it('should handle params with special characters', () => {
      mockReactUse.mockReturnValue({
        tutorialId: 'tutorial-with-dashes-and-numbers-123',
      });
      render(<TutorialPage params={Promise.resolve({}) as any} />);
      expect(mockUseTutorialExercises).toHaveBeenCalledWith(
        'tutorial-with-dashes-and-numbers-123',
      );
    });

    it('should pass empty exercises array when no exercises available', () => {
      mockUseTutorialExercises.mockReturnValue({
        tutorial: mockTutorial,
        exercises: [],
        isLoading: false,
        error: null,
        isError: false,
        refetch: vi.fn(),
      });
      render(<TutorialPage params={Promise.resolve(mockParams) as any} />);
      expect(mockYouTubeWidgetPage).toHaveBeenCalledWith(
        expect.objectContaining({ exercises: [] }),
        undefined,
      );
    });
  });
});
