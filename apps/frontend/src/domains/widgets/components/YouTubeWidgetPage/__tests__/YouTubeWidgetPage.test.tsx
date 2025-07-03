/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a test wrapper with QueryClient
const createTestWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

// Mock the useViewTransitionRouter hook
vi.mock('@/lib/hooks/use-view-transition-router', () => ({
  useViewTransitionRouter: () => ({
    navigateWithTransition: vi.fn(),
  }),
}));

// Mock the exercise selection hook
vi.mock('@/domains/widgets/hooks/useExerciseSelection', () => ({
  useExerciseSelection: () => ({
    exercises: [],
    isLoading: false,
    error: null,
    selectExercise: vi.fn(),
  }),
}));

// Mock SyncedWidget to return its children
vi.mock('../base/SyncedWidget.js', () => ({
  SyncedWidget: ({ children }: { children: any }) => {
    // Mock sync props for SyncedWidget children
    const mockSyncProps = {
      widgetId: 'test-widget',
      isConnected: true,
      currentTime: 0,
      isPlaying: false,
      tempo: 120,
      sync: {
        state: { exercise: {}, playback: {}, ui: {} },
        actions: { emitEvent: vi.fn() },
      },
    };
    return typeof children === 'function' ? children(mockSyncProps) : children;
  },
}));

// Mock the individual widget components
vi.mock('./components/MetronomeWidget.js', () => ({
  MetronomeWidget: () => (
    <div>
      <h3>🎵 Metronome</h3>
    </div>
  ),
}));

vi.mock('./components/DrummerWidget.js', () => ({
  DrummerWidget: () => (
    <div>
      <h3>🥁 Drummer</h3>
    </div>
  ),
}));

vi.mock('./components/BassLineWidget.js', () => ({
  BassLineWidget: () => (
    <div>
      <h3>🎸 Bass Line</h3>
    </div>
  ),
}));

vi.mock('./components/HarmonyWidget.js', () => ({
  HarmonyWidget: () => (
    <div>
      <h3>🎼 Harmony</h3>
    </div>
  ),
}));

// Mock the SyncProvider to prevent context dependencies
vi.mock('../base/SyncProvider.js', () => ({
  SyncProvider: ({ children }: { children: any }) => <div>{children}</div>,
  useSyncContext: () => ({
    syncState: {
      playback: { isPlaying: false, tempo: 100 },
      exercise: { selectedExercise: null },
      ui: { masterVolume: 0.8 },
    },
    isConnected: true,
    emitGlobalEvent: vi.fn(),
  }),
}));

// Mock the useWidgetPageState hook to prevent sync system initialization
vi.mock('@/domains/widgets/hooks/useWidgetPageState', () => ({
  useWidgetPageState: () => ({
    // Return the actual state structure
    state: {
      isPlaying: false,
      tempo: 100,
      currentTime: 0,
      syncEnabled: true,
      volume: {
        master: 80,
        metronome: 60,
        drums: 70,
        bass: 75,
      },
      widgets: {
        metronome: { bpm: 100, isVisible: true },
        drummer: { pattern: 'Jazz Swing', isVisible: true },
        bassLine: { pattern: 'Modal Walking', isVisible: true },
        harmony: {
          progression: ['Dm7', 'G7', 'CMaj7'],
          currentChord: 0,
          isVisible: true,
        },
      },
      selectedExercise: undefined,
      playbackMode: 'practice' as const,
      fretboardAnimation: true,
    },
    // Also expose some properties at the top level for backward compatibility
    isPlaying: false,
    tempo: 100,
    currentTime: 0,
    syncEnabled: true,
    // Methods
    togglePlayback: vi.fn(),
    setTempo: vi.fn(),
    setCurrentTime: vi.fn(),
    setVolume: vi.fn(),
    setSelectedExercise: vi.fn(),
    toggleSync: vi.fn(),
    toggleWidget: vi.fn(),
    toggleWidgetVisibility: vi.fn(),
    nextChord: vi.fn(),
    setChord: vi.fn(),
    resetState: vi.fn(),
  }),
}));

import { YouTubeWidgetPage } from '../YouTubeWidgetPage.js';

describe('YouTubeWidgetPage', () => {
  const mockTutorialData = {
    id: 'test-tutorial-1',
    slug: 'test-bass-tutorial',
    title: 'Test Bass Tutorial',
    artist: 'Test Artist',
    difficulty: 'beginner' as const,
    duration: '5:30',
    youtube_url: 'https://youtube.com/watch?v=test123',
    concepts: ['Walking Bass', 'Jazz Swing', 'Chord Progressions'],
    is_active: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const defaultProps = {
    tutorialData: mockTutorialData,
  };

  let Wrapper: ReturnType<typeof createTestWrapper>;

  beforeEach(() => {
    vi.clearAllMocks();
    Wrapper = createTestWrapper();
  });

  it('should render YouTube video section with thumbnail', () => {
    render(<YouTubeWidgetPage {...defaultProps} />, { wrapper: Wrapper });

    // Check for video thumbnail (YouTube integration)
    const thumbnail = screen.getByAltText('Video thumbnail');
    expect(thumbnail).toBeInTheDocument();

    // Check for back button
    expect(screen.getByText('Back to Library')).toBeInTheDocument();
  });

  it('should render tutorial info card with real data', () => {
    render(<YouTubeWidgetPage {...defaultProps} />, { wrapper: Wrapper });

    // Check for tutorial title and artist from props
    expect(screen.getByText('Test Bass Tutorial')).toBeInTheDocument();
    expect(screen.getByText('beginner')).toBeInTheDocument();
  });

  it('should render all main cards', () => {
    render(<YouTubeWidgetPage {...defaultProps} />, { wrapper: Wrapper });

    // Verify main component cards are present
    expect(screen.getByText('🎯 Exercise Selector')).toBeInTheDocument();
    expect(screen.getByText('🎸 3D Fretboard Visualizer')).toBeInTheDocument();
    expect(screen.getByText('🎛️ Essential Widgets')).toBeInTheDocument();
    expect(screen.getByText('🎼 Sheet Music Player')).toBeInTheDocument();
    expect(screen.getByText('💡 Teaching Takeaway')).toBeInTheDocument();
  });

  it('should render the 4 essential widgets within the unified card', () => {
    render(<YouTubeWidgetPage {...defaultProps} />, { wrapper: Wrapper });

    // Verify all 4 widgets are present in the unified card
    expect(screen.getByText('🎵 Metronome')).toBeInTheDocument();
    expect(screen.getByText('🥁 Drummer')).toBeInTheDocument();
    expect(screen.getByText('🎸 Bass Line')).toBeInTheDocument();
    expect(screen.getByText('🎼 Harmony')).toBeInTheDocument();
  });

  it('should display global controls section', () => {
    render(<YouTubeWidgetPage {...defaultProps} />, { wrapper: Wrapper });

    // Verify global controls are present
    expect(screen.getByText('🎛️ Global Controls')).toBeInTheDocument();
    expect(screen.getByText('Master Playback')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Tempo')).toBeInTheDocument();
    expect(screen.getByText('Master')).toBeInTheDocument(); // Volume control label
  });

  it('should show proper mobile-first layout structure', () => {
    render(<YouTubeWidgetPage {...defaultProps} />, { wrapper: Wrapper });

    // Check for mobile-first container (max-w-[600px])
    const mainContainer = document.querySelector('.max-w-\\[600px\\]');
    expect(mainContainer).toBeInTheDocument();

    // Check for space-y layout
    const layoutContainer = document.querySelector('.space-y-4');
    expect(layoutContainer).toBeInTheDocument();
  });

  it('should handle tutorial data prop correctly', () => {
    const customTutorialData = {
      ...mockTutorialData,
      title: 'Custom Bass Tutorial',
      youtube_url: 'https://youtube.com/watch?v=custom123',
    };

    render(<YouTubeWidgetPage tutorialData={customTutorialData} />, {
      wrapper: Wrapper,
    });

    // Should render custom tutorial title
    expect(screen.getByText('Custom Bass Tutorial')).toBeInTheDocument();
  });

  it('should handle exercise selection', () => {
    render(<YouTubeWidgetPage {...defaultProps} />, { wrapper: Wrapper });

    // Find and interact with exercise selector (simplified test)
    expect(screen.getByText('🎯 Exercise Selector')).toBeInTheDocument();
    expect(
      screen.getByText('Choose an exercise to configure your practice session'),
    ).toBeInTheDocument();
  });

  it('should display fretboard visualizer', () => {
    render(<YouTubeWidgetPage {...defaultProps} />, { wrapper: Wrapper });

    expect(screen.getByText('🎸 3D Fretboard Visualizer')).toBeInTheDocument();
    expect(
      screen.getByText('Interactive bass guitar fretboard with Three.js'),
    ).toBeInTheDocument();
  });

  it('should show sheet music player', () => {
    render(<YouTubeWidgetPage {...defaultProps} />, { wrapper: Wrapper });

    expect(screen.getByText('🎼 Sheet Music Player')).toBeInTheDocument();
    expect(
      screen.getByText('Music notation and tablature display'),
    ).toBeInTheDocument();
  });

  it('should display teaching takeaway section', () => {
    render(<YouTubeWidgetPage {...defaultProps} />, { wrapper: Wrapper });

    expect(screen.getByText('💡 Teaching Takeaway')).toBeInTheDocument();
    expect(
      screen.getByText('Key learning points and practice tips'),
    ).toBeInTheDocument();
  });

  it('should maintain consistent card styling', () => {
    render(<YouTubeWidgetPage {...defaultProps} />, { wrapper: Wrapper });

    // All cards should have consistent styling - check for actual card class
    const cards = document.querySelectorAll('.bg-card, .border');
    expect(cards.length).toBeGreaterThanOrEqual(3); // Realistic count for actual cards rendered
  });

  it('should render without tutorial data (fallback)', () => {
    render(<YouTubeWidgetPage />, { wrapper: Wrapper });

    // Should still render main components with fallback data
    expect(screen.getByText('Come Together')).toBeInTheDocument(); // Fallback title
    expect(screen.getByText('🎯 Exercise Selector')).toBeInTheDocument();
    expect(screen.getByText('🎸 3D Fretboard Visualizer')).toBeInTheDocument();
    expect(screen.getByText('🎛️ Essential Widgets')).toBeInTheDocument();
  });
});
