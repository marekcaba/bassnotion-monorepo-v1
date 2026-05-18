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

// Don't mock lucide-react globally — production tree pulls in many icons
// (the hard-coded list missed AlertCircle, Mic, BookOpen, etc. and broke any
// time a new icon was added to a transitive child). Lucide icons render as
// inert <svg> in jsdom which is sufficient for our assertions (they target
// text labels and roles, not icon test-ids).

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
