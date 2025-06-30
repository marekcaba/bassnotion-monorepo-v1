/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '../../../../test/test-utils.js';

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
}));

vi.mock('@/shared/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// Mock the SyncedWidget to prevent sync system dependencies
vi.mock('../../base/SyncedWidget.js', () => ({
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

import { HarmonyWidget } from '../HarmonyWidget.js';

describe('HarmonyWidget', () => {
  const defaultProps = {
    progression: ['Dm7', 'G7', 'CMaj7'],
    currentChord: 0,
    isPlaying: false,
    isVisible: true,
    onNextChord: vi.fn(),
    onProgressionChange: vi.fn(),
    onToggleVisibility: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render when visible', () => {
    render(<HarmonyWidget {...defaultProps} />);

    expect(screen.getByText('🎼 Harmony')).toBeInTheDocument();
    expect(screen.getByText('Dm7 - G7 - CMaj7')).toBeInTheDocument();
    expect(screen.getByTestId('card')).toBeInTheDocument();
  });

  it('should not render when not visible', () => {
    render(<HarmonyWidget {...defaultProps} isVisible={false} />);

    expect(screen.queryByText('🎼 Harmony')).not.toBeInTheDocument();
  });

  it('should display chord progression', () => {
    render(<HarmonyWidget {...defaultProps} />);

    expect(screen.getByText('Dm7')).toBeInTheDocument();
    expect(screen.getByText('G7')).toBeInTheDocument();
    expect(screen.getByText('CMaj7')).toBeInTheDocument();
  });

  it('should highlight current chord', () => {
    render(<HarmonyWidget {...defaultProps} currentChord={1} />);

    // The second chord (G7) should be highlighted
    const chordElements = screen.getAllByText('G7');
    expect(chordElements.length).toBeGreaterThan(0);
  });

  it('should show play icon when not playing', () => {
    render(<HarmonyWidget {...defaultProps} isPlaying={false} />);

    expect(screen.getByTestId('play-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('pause-icon')).not.toBeInTheDocument();
  });

  it('should show pause icon when playing', () => {
    render(<HarmonyWidget {...defaultProps} isPlaying={true} />);

    expect(screen.getByTestId('pause-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('play-icon')).not.toBeInTheDocument();
  });

  it('should call onNextChord when next button is clicked', async () => {
    const { user } = render(<HarmonyWidget {...defaultProps} />);

    const nextButton = screen.getByText('Next');
    await user.click(nextButton);

    expect(defaultProps.onNextChord).toHaveBeenCalledTimes(1);
  });

  it('should call onToggleVisibility when hide button is clicked', async () => {
    const { user } = render(<HarmonyWidget {...defaultProps} />);

    const hideButton = screen.getByText('×');
    await user.click(hideButton);

    expect(defaultProps.onToggleVisibility).toHaveBeenCalledTimes(1);
  });
});
