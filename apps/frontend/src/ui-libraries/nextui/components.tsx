'use client';

/**
 * NextUI Component Adapters
 *
 * Provides NextUI components that match the zone component interface.
 * These are lazy-loaded to reduce bundle size.
 */

import React, { forwardRef, lazy, Suspense } from 'react';
import { cn } from '@/shared/utils/cn';

// Lazy load NextUI components
const NextUICard = lazy(() =>
  import('@nextui-org/react').then((mod) => ({ default: mod.Card }))
);
const NextUICardHeader = lazy(() =>
  import('@nextui-org/react').then((mod) => ({ default: mod.CardHeader }))
);
const NextUICardBody = lazy(() =>
  import('@nextui-org/react').then((mod) => ({ default: mod.CardBody }))
);
const NextUICardFooter = lazy(() =>
  import('@nextui-org/react').then((mod) => ({ default: mod.CardFooter }))
);
const NextUIButton = lazy(() =>
  import('@nextui-org/react').then((mod) => ({ default: mod.Button }))
);
const NextUISlider = lazy(() =>
  import('@nextui-org/react').then((mod) => ({ default: mod.Slider }))
);
const NextUIChip = lazy(() =>
  import('@nextui-org/react').then((mod) => ({ default: mod.Chip }))
);
const NextUITabs = lazy(() =>
  import('@nextui-org/react').then((mod) => ({ default: mod.Tabs }))
);
const NextUITab = lazy(() =>
  import('@nextui-org/react').then((mod) => ({ default: mod.Tab }))
);

// Loading fallback for lazy components
function LoadingFallback({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-slate-700/50 rounded-xl', className)} />;
}

/**
 * NextUI Card - Zone compatible
 */
export const ZoneCard = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { isBlurred?: boolean }
>(({ className, children, isBlurred = true, ...props }, ref) => (
  <Suspense fallback={<LoadingFallback className={cn('min-h-[100px]', className)} />}>
    <NextUICard
      ref={ref}
      className={cn('bg-default-100/50 dark:bg-default-100/20', className)}
      isBlurred={isBlurred}
      {...props}
    >
      {children}
    </NextUICard>
  </Suspense>
));
ZoneCard.displayName = 'NextUI.ZoneCard';

/**
 * NextUI Card Header - Zone compatible
 */
export const ZoneCardHeader = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <Suspense fallback={<LoadingFallback className="h-12" />}>
    <NextUICardHeader ref={ref} className={className} {...props} />
  </Suspense>
));
ZoneCardHeader.displayName = 'NextUI.ZoneCardHeader';

/**
 * NextUI Card Title - Zone compatible (uses header styling)
 */
export const ZoneCardTitle = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-lg font-semibold', className)} {...props} />
));
ZoneCardTitle.displayName = 'NextUI.ZoneCardTitle';

/**
 * NextUI Card Description - Zone compatible
 */
export const ZoneCardDescription = forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn('text-sm text-default-500', className)} {...props} />
));
ZoneCardDescription.displayName = 'NextUI.ZoneCardDescription';

/**
 * NextUI Card Content - Zone compatible (uses CardBody)
 */
export const ZoneCardContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <Suspense fallback={<LoadingFallback className="min-h-[50px]" />}>
    <NextUICardBody ref={ref} className={className} {...props} />
  </Suspense>
));
ZoneCardContent.displayName = 'NextUI.ZoneCardContent';

/**
 * NextUI Card Footer - Zone compatible
 */
export const ZoneCardFooter = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <Suspense fallback={<LoadingFallback className="h-12" />}>
    <NextUICardFooter ref={ref} className={className} {...props} />
  </Suspense>
));
ZoneCardFooter.displayName = 'NextUI.ZoneCardFooter';

/**
 * NextUI Button - Zone compatible
 */
export const ZoneButton = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'solid' | 'bordered' | 'light' | 'flat' | 'faded' | 'shadow' | 'ghost';
    color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
    size?: 'sm' | 'md' | 'lg';
  }
>(({ className, variant = 'solid', color = 'primary', size = 'md', ...props }, ref) => (
  <Suspense fallback={<LoadingFallback className="h-10 w-20" />}>
    <NextUIButton
      ref={ref}
      className={className}
      variant={variant}
      color={color}
      size={size}
      {...props}
    />
  </Suspense>
));
ZoneButton.displayName = 'NextUI.ZoneButton';

/**
 * NextUI Slider - Zone compatible
 */
interface ZoneSliderProps {
  className?: string;
  value?: number[];
  defaultValue?: number[];
  min?: number;
  max?: number;
  step?: number;
  onValueChange?: (value: number[]) => void;
}

export const ZoneSlider = forwardRef<HTMLDivElement, ZoneSliderProps>(
  ({ className, value, defaultValue, min = 0, max = 100, step = 1, onValueChange, ...props }, ref) => (
    <Suspense fallback={<LoadingFallback className="h-6 w-full" />}>
      <NextUISlider
        ref={ref}
        className={className}
        value={value?.[0]}
        defaultValue={defaultValue?.[0]}
        minValue={min}
        maxValue={max}
        step={step}
        onChange={(val) => onValueChange?.([val as number])}
        {...props}
      />
    </Suspense>
  )
);
ZoneSlider.displayName = 'NextUI.ZoneSlider';

/**
 * NextUI Badge (Chip) - Zone compatible
 */
export const ZoneBadge = forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    variant?: 'solid' | 'bordered' | 'light' | 'flat' | 'faded' | 'shadow' | 'dot';
    color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  }
>(({ className, variant = 'flat', color = 'default', children, ...props }, ref) => (
  <Suspense fallback={<LoadingFallback className="h-6 w-16" />}>
    <NextUIChip ref={ref} className={className} variant={variant} color={color} {...props}>
      {children}
    </NextUIChip>
  </Suspense>
));
ZoneBadge.displayName = 'NextUI.ZoneBadge';

/**
 * NextUI Tabs - Zone compatible
 */
export const ZoneTabs = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
  }
>(({ className, defaultValue, value, onValueChange, children, ...props }, ref) => (
  <Suspense fallback={<LoadingFallback className="h-10" />}>
    <NextUITabs
      ref={ref}
      className={className}
      defaultSelectedKey={defaultValue}
      selectedKey={value}
      onSelectionChange={(key) => onValueChange?.(key as string)}
      {...props}
    >
      {children}
    </NextUITabs>
  </Suspense>
));
ZoneTabs.displayName = 'NextUI.ZoneTabs';

export const ZoneTabsList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ children, ...props }, ref) => <div ref={ref} {...props}>{children}</div>
);
ZoneTabsList.displayName = 'NextUI.ZoneTabsList';

export const ZoneTabsTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>(({ value, children, ...props }, ref) => (
  <Suspense fallback={<LoadingFallback className="h-8 w-20" />}>
    <NextUITab ref={ref} key={value} title={children} {...props} />
  </Suspense>
));
ZoneTabsTrigger.displayName = 'NextUI.ZoneTabsTrigger';

export const ZoneTabsContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn('mt-2', className)} {...props} />
));
ZoneTabsContent.displayName = 'NextUI.ZoneTabsContent';
