/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../../../test/test-utils';

// Mock all @/ imports before importing the component
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

// Don't mock lucide-react here — the production component tree pulls in
// many icons (Play, Pause, Volume2, AlertCircle, ChevronRight, Lock, etc.)
// and listing them explicitly is brittle. Lucide icons render to <svg> in
// tests without needing a mock; we lose the data-testid hooks the old
// inline mocks provided, but those weren't asserted on in this file
// (assertions look for text labels, not icon test IDs).

vi.mock('@/shared/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// Mock the SyncedWidget to prevent sync system dependencies
vi.mock('../../base/SyncedWidget', () => ({
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

// Mock all individual widget components to prevent sync dependencies
vi.mock('../MetronomeWidget', () => ({
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

vi.mock('../../DrummerWidget/index.js', () => ({
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

vi.mock('../BassLineWidget', () => ({
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

vi.mock('../HarmonyWidget', () => ({
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

import { FourWidgetsCard } from '../FourWidgetsCard';

describe('FourWidgetsCard', () => {
  const createMockWidgetState = (overrides = {}) => ({
    state: {
      isPlaying: false,
      currentTime: 0,
      tempo: 100,
      volume: { master: 80, metronome: 70, drums: 60, bass: 75, harmony: 70 },
      muted: {
        master: false,
        metronome: false,
        drums: false,
        bass: false,
        harmony: false,
      },
      selectedExercise: undefined,
      playbackMode: 'practice' as const,
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
      syncEnabled: true,
      fretboardAnimation: true,
      ...overrides,
    },
    // Actions
    togglePlayback: vi.fn(),
    setCurrentTime: vi.fn(),
    setTempo: vi.fn(),
    setVolume: vi.fn(),
    setSelectedExercise: vi.fn(),
    toggleWidgetVisibility: vi.fn(),
    nextChord: vi.fn(),
    toggleSync: vi.fn(),
    toggleFretboardAnimation: vi.fn(),
    resetState: vi.fn(),
    // Computed values
    isPlaying: false,
    currentTime: 0,
    tempo: 100,
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
    syncEnabled: true,
    fretboardAnimation: true,
  });

  const defaultProps = {
    widgetState: createMockWidgetState(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all four widgets when visible', () => {
    render(<FourWidgetsCard {...defaultProps} />);

    expect(screen.getByText('🎵 Metronome')).toBeInTheDocument();
    expect(screen.getByText('🥁 Drummer')).toBeInTheDocument();
    expect(screen.getByText('🎸 Bass Line')).toBeInTheDocument();
    expect(screen.getByText('🎼 Harmony')).toBeInTheDocument();
  });

  it('should show global controls section', () => {
    render(<FourWidgetsCard {...defaultProps} />);

    expect(screen.getByText('🎛️ Essential Widgets')).toBeInTheDocument();
    expect(screen.getByText('Global Controls')).toBeInTheDocument();
    expect(screen.getByText('Sync:')).toBeInTheDocument();
    expect(screen.getByTestId('sync-status')).toHaveTextContent('ON');
    expect(screen.getByTestId('master-tempo')).toHaveTextContent('100 BPM');
  });

  it('should display master volume controls', () => {
    render(<FourWidgetsCard {...defaultProps} />);

    expect(screen.getByText('Master:')).toBeInTheDocument();
    expect(screen.getByText('80%')).toBeInTheDocument();
    expect(screen.getByText('Drums:')).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument(); // drums: 60 from mock
    expect(screen.getByText('Bass:')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument(); // bass: 75 from mock
  });

  it('should render without errors when widget state is provided', () => {
    const mockWidgetState = createMockWidgetState();
    render(<FourWidgetsCard widgetState={mockWidgetState} />);

    // Test that the component renders all widgets correctly
    expect(screen.getByText('🎵 Metronome')).toBeInTheDocument();
    expect(screen.getByText('🥁 Drummer')).toBeInTheDocument();
    expect(screen.getByText('🎸 Bass Line')).toBeInTheDocument();
    expect(screen.getByText('🎼 Harmony')).toBeInTheDocument();
  });

  it('should show sync status correctly', () => {
    const mockWidgetState = createMockWidgetState({ syncEnabled: false });
    render(<FourWidgetsCard widgetState={mockWidgetState} />);

    expect(screen.getByText('Sync:')).toBeInTheDocument();
    expect(screen.getByTestId('sync-status')).toHaveTextContent('OFF');
  });

  it('should hide widgets when not visible', () => {
    const mockWidgetState = createMockWidgetState({
      widgets: {
        metronome: { bpm: 100, isVisible: false },
        drummer: { pattern: 'Jazz Swing', isVisible: false },
        bassLine: { pattern: 'Modal Walking', isVisible: true },
        harmony: {
          progression: ['Dm7', 'G7', 'CMaj7'],
          currentChord: 0,
          isVisible: true,
        },
      },
    });

    render(<FourWidgetsCard widgetState={mockWidgetState} />);

    expect(screen.queryByText('🎵 Metronome')).not.toBeInTheDocument();
    expect(screen.queryByText('🥁 Drummer')).not.toBeInTheDocument();
    expect(screen.getByText('🎸 Bass Line')).toBeInTheDocument();
    expect(screen.getByText('🎼 Harmony')).toBeInTheDocument();
  });

  it('should show playing state in global controls', () => {
    const mockWidgetState = createMockWidgetState({ isPlaying: true });
    render(<FourWidgetsCard widgetState={mockWidgetState} />);

    // Test that the playing state is reflected in the component
    expect(screen.getByText('PLAYING')).toBeInTheDocument();
  });
});
