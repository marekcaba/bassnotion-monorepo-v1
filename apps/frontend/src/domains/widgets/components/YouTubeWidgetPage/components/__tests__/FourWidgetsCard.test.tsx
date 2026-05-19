/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../../../test/test-utils';

// FourWidgetsCard now uses next/dynamic with ssr:false for each child
// widget. In jsdom, dynamic chunks don't resolve synchronously, so the
// component renders WidgetSkeleton placeholders ("Loading {name}
// widget...") for each of the four slots. The test asserts on those
// skeletons (deterministic) rather than racing the dynamic loaders.

vi.mock('next/dynamic', () => ({
  default: (loader: any, opts: any) => {
    // Return the loading placeholder synchronously so tests see a
    // stable DOM. Production behavior is unchanged because production
    // doesn't use this mocked import.
    if (opts?.loading) {
      const Loading = opts.loading;
      return (props: any) => <Loading {...props} />;
    }
    return () => null;
  },
}));

// ZoneCard / ZoneCardContent come from @/ui-libraries; just pass-through
vi.mock('@/ui-libraries', () => ({
  ZoneCard: ({ children, className }: any) => (
    <div className={className} data-testid="zone-card">
      {children}
    </div>
  ),
  ZoneCardContent: ({ children, className }: any) => (
    <div className={className} data-testid="zone-card-content">
      {children}
    </div>
  ),
}));

vi.mock('@/shared/components/ErrorBoundary', () => ({
  WidgetErrorBoundary: ({ children }: any) => <>{children}</>,
}));

vi.mock('@/utils/skeletonDebug', () => ({
  getSkeletonDebugTime: () => 0,
}));

vi.mock('@/config/debug', () => ({
  isVerboseDebugEnabled: () => false,
}));

import { FourWidgetsCard, FourWidgetsCardSkeleton } from '../FourWidgetsCard';

describe('FourWidgetsCard', () => {
  const createMockWidgetState = (overrides: any = {}) => ({
    state: {
      isPlaying: false,
      volume: { master: 80, metronome: 70, drums: 60, bass: 75, harmony: 70 },
      muted: {
        master: false,
        metronome: false,
        drums: false,
        bass: false,
        harmony: false,
      },
      selectedExercise: undefined,
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
      ...overrides,
    },
    // Actions — production reads these via destructure on widgetState
    setVolume: vi.fn(),
    toggleMute: vi.fn(),
    setSelectedExercise: vi.fn(),
    setHarmonyProgression: vi.fn(),
    setHarmonyCurrentChord: vi.fn(),
    setDrumPattern: vi.fn(),
    setBassPattern: vi.fn(),
    // Computed
    isPlaying: false,
    selectedExercise: undefined,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the zone card wrapper', () => {
    render(<FourWidgetsCard widgetState={createMockWidgetState()} />);
    expect(screen.getByTestId('zone-card')).toBeInTheDocument();
    expect(screen.getByTestId('zone-card-content')).toBeInTheDocument();
  });

  it('should render skeleton placeholders for all four widgets', () => {
    // With our next/dynamic mock, each widget shows its loading skeleton.
    // Each skeleton has a sr-only "Loading {name} widget..." text.
    render(<FourWidgetsCard widgetState={createMockWidgetState()} />);

    expect(screen.getByText('Loading Metronome widget...')).toBeInTheDocument();
    expect(screen.getByText('Loading Drummer widget...')).toBeInTheDocument();
    expect(screen.getByText('Loading Bass Line widget...')).toBeInTheDocument();
    expect(screen.getByText('Loading Harmony widget...')).toBeInTheDocument();
  });

  it('should render without crashing when widget visibility flags are false', () => {
    const state = createMockWidgetState({
      widgets: {
        metronome: { bpm: 100, isVisible: false },
        drummer: { pattern: 'Jazz Swing', isVisible: false },
        bassLine: { pattern: 'Modal Walking', isVisible: false },
        harmony: {
          progression: ['Dm7'],
          currentChord: 0,
          isVisible: false,
        },
      },
    });

    // FourWidgetsCard always mounts the widget children — they handle
    // their own isVisible logic internally (rendering null or a hidden
    // div). With dynamic-loader mocking, the skeletons still render
    // because the skeleton is the loading state, independent of
    // isVisible. Just assert no crash + zone card present.
    render(<FourWidgetsCard widgetState={state} />);
    expect(screen.getByTestId('zone-card')).toBeInTheDocument();
  });

  it('should accept tutorialId prop', () => {
    render(
      <FourWidgetsCard
        widgetState={createMockWidgetState()}
        tutorialId="tutorial-123"
      />,
    );
    expect(screen.getByTestId('zone-card')).toBeInTheDocument();
  });

  it('should accept isAdminMode prop', () => {
    render(
      <FourWidgetsCard
        widgetState={createMockWidgetState()}
        isAdminMode={true}
      />,
    );
    expect(screen.getByTestId('zone-card')).toBeInTheDocument();
  });
});

describe('FourWidgetsCardSkeleton', () => {
  it('should render four named widget skeletons', () => {
    render(<FourWidgetsCardSkeleton />);

    expect(screen.getByText('Loading Metronome widget...')).toBeInTheDocument();
    expect(screen.getByText('Loading Drummer widget...')).toBeInTheDocument();
    expect(screen.getByText('Loading Bass Line widget...')).toBeInTheDocument();
    expect(screen.getByText('Loading Harmony widget...')).toBeInTheDocument();
    expect(screen.getByText('Loading widgets...')).toBeInTheDocument();
  });
});
