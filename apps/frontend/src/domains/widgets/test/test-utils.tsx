import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// Mock all the UI components that widgets use
vi.mock('@/shared/components/ui/card', () => ({
  Card: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className, ...props }, ref) => (
      <div ref={ref} className={className} data-testid="card" {...props} />
    ),
  ),
  CardContent: React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={className}
      data-testid="card-content"
      {...props}
    />
  )),
  CardHeader: React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ className, ...props }, ref) => (
    <div ref={ref} className={className} data-testid="card-header" {...props} />
  )),
  CardTitle: React.forwardRef<
    HTMLDivElement,
    React.HTMLAttributes<HTMLDivElement>
  >(({ className, ...props }, ref) => (
    <div ref={ref} className={className} data-testid="card-title" {...props} />
  )),
}));

vi.mock('@/shared/components/ui/button', () => ({
  Button: React.forwardRef<HTMLButtonElement, any>(
    ({ className, variant, size, children, ...props }, ref) => (
      <button
        ref={ref}
        className={className}
        data-variant={variant}
        data-size={size}
        data-testid="button"
        {...props}
      >
        {children}
      </button>
    ),
  ),
}));

// Mock Lucide React icons
vi.mock('lucide-react', () => ({
  Play: () => <span data-testid="play-icon">▶️</span>,
  Pause: () => <span data-testid="pause-icon">⏸️</span>,
  Volume2: () => <span data-testid="volume-icon">🔊</span>,
  Settings: () => <span data-testid="settings-icon">⚙️</span>,
  Eye: () => <span data-testid="eye-icon">👁️</span>,
  EyeOff: () => <span data-testid="eye-off-icon">🙈</span>,
  SkipForward: () => <span data-testid="skip-forward-icon">⏭️</span>,
  Target: () => <span data-testid="target-icon">🎯</span>,
  TrendingUp: () => <span data-testid="trending-up-icon">📈</span>,
  CheckCircle: () => <span data-testid="check-circle-icon">✅</span>,
  Lightbulb: () => <span data-testid="lightbulb-icon">💡</span>,
  RotateCcw: () => <span data-testid="rotate-ccw-icon">↺</span>,
  Clock: () => <span data-testid="clock-icon">🕐</span>,
  Music: () => <span data-testid="music-icon">🎵</span>,
  Loader2: () => <span data-testid="loader-icon">⏳</span>,
  RotateCw: () => <span data-testid="rotate-cw-icon">↻</span>,
  ArrowLeft: () => <span data-testid="arrow-left-icon">←</span>,
  SkipBack: () => <span data-testid="skip-back-icon">⏮️</span>,
  Maximize: () => <span data-testid="maximize-icon">⛶</span>,
}));

// Mock shared utilities
vi.mock('@/shared/utils', () => ({
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}));

// Enhanced render function
export function render(ui: React.ReactElement) {
  const user = userEvent.setup();

  return {
    user,
    ...rtlRender(ui),
  };
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { userEvent };
