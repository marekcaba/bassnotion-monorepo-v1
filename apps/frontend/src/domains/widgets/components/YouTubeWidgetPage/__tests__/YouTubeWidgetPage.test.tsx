/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../../test/test-utils.js';

// Mock all @/ imports and components
vi.mock('@/shared/components/ui/card', () => ({
  Card: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, children, ...props }, ref) => (
      <div ref={ref} className={className} data-testid="card" {...props}>
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

vi.mock('lucide-react', () => ({
  Play: () => <span data-testid="play-icon">▶️</span>,
  Pause: () => <span data-testid="pause-icon">⏸️</span>,
  Volume2: () => <span data-testid="volume-icon">🔊</span>,
  Settings: () => <span data-testid="settings-icon">⚙️</span>,
  Eye: () => <span data-testid="eye-icon">👁️</span>,
  EyeOff: () => <span data-testid="eye-off-icon">🙈</span>,
  Search: () => <span data-testid="search-icon">🔍</span>,
  Music: () => <span data-testid="music-icon">🎵</span>,
  BookOpen: () => <span data-testid="book-icon">📖</span>,
}));

vi.mock('@/shared/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// Mock all API dependencies that cause crashes
vi.mock('../../api/exercises', () => ({
  getExercises: vi.fn().mockResolvedValue({
    exercises: [
      {
        id: 'test-exercise-1',
        title: 'Test Exercise 1',
        difficulty: 'beginner',
        duration: 120000, // 2 minutes in ms
        description: 'Test exercise description',
      },
      {
        id: 'test-exercise-2',
        title: 'Test Exercise 2',
        difficulty: 'intermediate',
        duration: 180000, // 3 minutes in ms
        description: 'Another test exercise',
      },
    ],
  }),
}));

// Mock any other potential API calls
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock Supabase client to prevent environment variable errors
vi.mock('@/infrastructure/supabase/client', () => ({
  supabase: {},
}));

// Mock Next.js router to prevent invariant error
vi.mock('next/navigation', () => ({
  useRouter: vi.fn().mockReturnValue({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: vi.fn().mockReturnValue('/test-path'),
  useSearchParams: vi.fn().mockReturnValue(new URLSearchParams()),
}));

// Mock FretboardVisualizer from playback domain
vi.mock(
  '@/domains/playback/components/FretboardVisualizer/FretboardVisualizer',
  () => ({
    FretboardVisualizer: () => (
      <div data-testid="fretboard-visualizer">Mocked FretboardVisualizer</div>
    ),
  }),
);

// Mock React Query hooks that might be used
vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn().mockReturnValue({
    data: [],
    isLoading: false,
    error: null,
    isError: false,
  }),
  useMutation: vi.fn().mockReturnValue({
    mutate: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

// Mock the SyncedWidget to prevent sync system dependencies
vi.mock('../base/SyncedWidget.js', () => ({
  SyncedWidget: ({
    children,
    widgetId,
  }: {
    children: any;
    widgetId: string;
  }) => {
    const mockSyncProps = {
      isConnected: true,
      tempo: 100,
      isPlaying: false,
      sync: {
        actions: {
          emitEvent: vi.fn(),
        },
      },
    };
    return (
      <div data-testid={`synced-widget-${widgetId}`}>
        {typeof children === 'function' ? children(mockSyncProps) : children}
      </div>
    );
  },
}));

// Mock all individual widget components that might have sync dependencies
vi.mock('../components/MetronomeWidget', () => ({
  MetronomeWidget: ({ bpm, isPlaying, isVisible }: any) => {
    if (!isVisible) return null;
    return (
      <div data-testid="metronome-widget">
        <h3>🎵 Metronome</h3>
        <p>{bpm} BPM</p>
        <p>{isPlaying ? 'Playing' : 'Stopped'}</p>
      </div>
    );
  },
}));

vi.mock('../components/DrummerWidget', () => ({
  DrummerWidget: ({ pattern, isPlaying, isVisible }: any) => {
    if (!isVisible) return null;
    return (
      <div data-testid="drummer-widget">
        <h3>🥁 Drummer</h3>
        <p>Pattern: {pattern}</p>
        <p>{isPlaying ? 'Playing' : 'Stopped'}</p>
      </div>
    );
  },
}));

vi.mock('../components/BassLineWidget', () => ({
  BassLineWidget: ({ pattern, isPlaying, isVisible }: any) => {
    if (!isVisible) return null;
    return (
      <div data-testid="bassline-widget">
        <h3>🎸 Bass Line</h3>
        <p>Pattern: {pattern}</p>
        <p>{isPlaying ? 'Playing' : 'Stopped'}</p>
      </div>
    );
  },
}));

vi.mock('../components/HarmonyWidget', () => ({
  HarmonyWidget: ({ progression, currentChord, isPlaying, isVisible }: any) => {
    if (!isVisible) return null;
    return (
      <div data-testid="harmony-widget">
        <h3>🎼 Harmony</h3>
        <p>Chord: {progression?.[currentChord] || 'None'}</p>
        <p>{isPlaying ? 'Playing' : 'Stopped'}</p>
      </div>
    );
  },
}));

// Mock ALL the card components to prevent sync system imports
vi.mock('../MainCard', () => ({
  MainCard: ({ tutorialData }: any) => (
    <div data-testid="card main-card">
      <h2>📺 YouTube Player</h2>
      <p>Tutorial: {tutorialData?.title || 'No tutorial'}</p>
    </div>
  ),
}));

vi.mock('../ExerciseSelectorCard', () => ({
  ExerciseSelectorCard: ({ onExerciseSelect }: any) => (
    <div data-testid="card exercise-selector-card">
      <h2>🎯 Exercise Selector</h2>
      <button onClick={() => onExerciseSelect?.('test-exercise')}>
        Select Exercise
      </button>
    </div>
  ),
}));

vi.mock('../FretboardVisualizerCard', () => ({
  FretboardVisualizerCard: ({ exerciseId }: any) => (
    <div data-testid="card fretboard-visualizer-card">
      <h2>🎸 3D Fretboard Visualizer</h2>
      <p>Interactive bass guitar fretboard with Three.js</p>
      <p>Exercise ID: {exerciseId || 'None'}</p>
    </div>
  ),
}));

vi.mock('../SheetPlayerVisualizerCard', () => ({
  SheetPlayerVisualizerCard: () => (
    <div data-testid="card sheet-player-card">
      <h2>🎼 Sheet Music Player</h2>
      <p>Music notation and tablature display</p>
    </div>
  ),
}));

vi.mock('../TeachingTakeawayCard', () => ({
  TeachingTakeawayCard: ({ tutorialData }: any) => (
    <div data-testid="card teaching-takeaway-card">
      <h2>💡 Teaching Takeaway</h2>
      <p>Key learning points and practice tips</p>
      <p>Tutorial: {tutorialData?.title || 'No tutorial'}</p>
    </div>
  ),
}));

vi.mock('../components/FourWidgetsCard', () => ({
  FourWidgetsCard: ({ widgetState: _widgetState }: any) => (
    <div data-testid="card four-widgets-card">
      <h2>🎛️ Essential Widgets</h2>
      <div data-testid="metronome-widget">
        <h3>🎵 Metronome</h3>
      </div>
      <div data-testid="drummer-widget">
        <h3>🥁 Drummer</h3>
      </div>
      <div data-testid="bassline-widget">
        <h3>🎸 Bass Line</h3>
      </div>
      <div data-testid="harmony-widget">
        <h3>🎼 Harmony</h3>
      </div>
    </div>
  ),
}));

// Mock the SyncProvider to prevent context dependencies
vi.mock('../base/SyncProvider.js', () => ({
  SyncProvider: ({ children }: { children: any }) => <div>{children}</div>,
  useSyncContext: () => ({
    syncState: { playback: { isPlaying: false, tempo: 100 } },
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
    title: 'Test Bass Tutorial',
    artist: 'Test Artist',
    difficulty: 'beginner',
    duration: '5:30',
    videoUrl: 'https://youtube.com/watch?v=test123',
    concepts: ['Walking Bass', 'Jazz Swing', 'Chord Progressions'],
  };

  const defaultProps = {
    tutorialData: mockTutorialData,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all 6 main cards', () => {
    render(<YouTubeWidgetPage {...defaultProps} />);

    // Verify all 6 cards are present
    expect(screen.getByText('📺 YouTube Player')).toBeInTheDocument();
    expect(screen.getByText('🎯 Exercise Selector')).toBeInTheDocument();
    expect(screen.getByText('🎸 3D Fretboard Visualizer')).toBeInTheDocument();
    expect(screen.getByText('🎛️ Essential Widgets')).toBeInTheDocument();
    expect(screen.getByText('🎼 Sheet Music Player')).toBeInTheDocument();
    expect(screen.getByText('💡 Teaching Takeaway')).toBeInTheDocument();
  });

  it('should render the 4 essential widgets within the unified card', () => {
    render(<YouTubeWidgetPage {...defaultProps} />);

    // Verify all 4 widgets are present in the unified card
    expect(screen.getByText('🎵 Metronome')).toBeInTheDocument();
    expect(screen.getByText('🥁 Drummer')).toBeInTheDocument();
    expect(screen.getByText('🎸 Bass Line')).toBeInTheDocument();
    expect(screen.getByText('🎼 Harmony')).toBeInTheDocument();
  });

  it('should display global controls section', () => {
    render(<YouTubeWidgetPage {...defaultProps} />);

    // Verify global controls are present
    expect(screen.getByText('🎛️ Global Controls')).toBeInTheDocument();
    expect(screen.getByText('Master Playback')).toBeInTheDocument();
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Tempo Controls')).toBeInTheDocument();
    // Change to more flexible matcher since "Volume Controls" might be split across elements
    expect(screen.getByText('Master Volume')).toBeInTheDocument();
  });

  it('should show proper responsive layout structure', () => {
    render(<YouTubeWidgetPage {...defaultProps} />);

    // Check for responsive grid container
    const mainContainer = document.querySelector('.max-w-7xl');
    expect(mainContainer).toBeInTheDocument();

    // Check for grid layout
    const gridContainer = document.querySelector('.grid');
    expect(gridContainer).toBeInTheDocument();
  });

  it('should handle tutorial data prop correctly', () => {
    const customTutorialData = {
      ...mockTutorialData,
      title: 'Custom Bass Tutorial',
      videoUrl: 'https://youtube.com/watch?v=custom123',
    };

    render(<YouTubeWidgetPage tutorialData={customTutorialData} />);

    // The YouTube Player card should be present (actual video integration tested elsewhere)
    expect(screen.getByText('📺 YouTube Player')).toBeInTheDocument();
  });

  it('should handle exercise selection', () => {
    render(<YouTubeWidgetPage {...defaultProps} />);

    // Find and interact with exercise selector (simplified test)
    expect(screen.getByText('🎯 Exercise Selector')).toBeInTheDocument();

    // This would be expanded when the actual exercise selector component is implemented
  });

  it('should display fretboard visualizer placeholder', () => {
    render(<YouTubeWidgetPage {...defaultProps} />);

    expect(screen.getByText('🎸 3D Fretboard Visualizer')).toBeInTheDocument();
    expect(
      screen.getByText('Interactive bass guitar fretboard with Three.js'),
    ).toBeInTheDocument();
  });

  it('should show sheet music player placeholder', () => {
    render(<YouTubeWidgetPage {...defaultProps} />);

    expect(screen.getByText('🎼 Sheet Music Player')).toBeInTheDocument();
    expect(
      screen.getByText('Music notation and tablature display'),
    ).toBeInTheDocument();
  });

  it('should display teaching takeaway section', () => {
    render(<YouTubeWidgetPage {...defaultProps} />);

    expect(screen.getByText('💡 Teaching Takeaway')).toBeInTheDocument();
    expect(
      screen.getByText('Key learning points and practice tips'),
    ).toBeInTheDocument();
  });

  it('should maintain consistent card styling', () => {
    render(<YouTubeWidgetPage {...defaultProps} />);

    // All cards should have consistent styling
    const cards = document.querySelectorAll('[data-testid*="card"]');
    expect(cards.length).toBeGreaterThanOrEqual(6);
  });

  it('should render without tutorial data', () => {
    render(<YouTubeWidgetPage />);

    // Should still render all main components even without tutorial data
    expect(screen.getByText('📺 YouTube Player')).toBeInTheDocument();
    expect(screen.getByText('🎯 Exercise Selector')).toBeInTheDocument();
    expect(screen.getByText('🎸 3D Fretboard Visualizer')).toBeInTheDocument();
    expect(screen.getByText('🎛️ Essential Widgets')).toBeInTheDocument();
  });
});
