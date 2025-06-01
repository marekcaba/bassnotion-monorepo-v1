import { ReactNode } from 'react';
import { cn } from '@/shared/utils';

interface ResponsiveContainerProps {
  children: ReactNode;
  className?: string;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const maxWidthClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '6xl': 'max-w-6xl',
  full: 'max-w-full',
};

const paddingClasses = {
  none: '',
  sm: 'px-4 py-4 sm:px-6 sm:py-6',
  md: 'px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10',
  lg: 'px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12',
};

export function ResponsiveContainer({
  children,
  className,
  maxWidth = 'lg',
  padding = 'md',
}: ResponsiveContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full',
        maxWidthClasses[maxWidth],
        paddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}

// Responsive grid component
interface ResponsiveGridProps {
  children: ReactNode;
  className?: string;
  cols?: {
    default?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };
  gap?: 'sm' | 'md' | 'lg';
}

const gapClasses = {
  sm: 'gap-4',
  md: 'gap-4 sm:gap-6',
  lg: 'gap-6 sm:gap-8',
};

export function ResponsiveGrid({
  children,
  className,
  cols = { default: 1, sm: 2, lg: 3 },
  gap = 'md',
}: ResponsiveGridProps) {
  const gridCols = cn(
    'grid',
    cols.default && `grid-cols-${cols.default}`,
    cols.sm && `sm:grid-cols-${cols.sm}`,
    cols.md && `md:grid-cols-${cols.md}`,
    cols.lg && `lg:grid-cols-${cols.lg}`,
    cols.xl && `xl:grid-cols-${cols.xl}`,
    gapClasses[gap],
  );

  return <div className={cn(gridCols, className)}>{children}</div>;
}

// Responsive card component
interface ResponsiveCardProps {
  children: ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg';
}

const cardPaddingClasses = {
  sm: 'p-4',
  md: 'p-4 sm:p-6',
  lg: 'p-6 sm:p-8',
};

export function ResponsiveCard({
  children,
  className,
  padding = 'md',
}: ResponsiveCardProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-lg border shadow-sm',
        cardPaddingClasses[padding],
        className,
      )}
    >
      {children}
    </div>
  );
}
