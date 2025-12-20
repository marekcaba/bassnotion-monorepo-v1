/**
 * UI Libraries - Dynamic Component Loader
 *
 * Provides zone-aware components that automatically switch between
 * UI libraries based on the current UIZone configuration.
 *
 * @example
 * ```tsx
 * import { ZoneCard, ZoneButton } from '@/ui-libraries';
 *
 * function MyComponent() {
 *   // ZoneCard will render as shadcn Card or NextUI Card
 *   // depending on the current zone library setting
 *   return (
 *     <ZoneCard>
 *       <ZoneButton>Click me</ZoneButton>
 *     </ZoneCard>
 *   );
 * }
 * ```
 */

'use client';

import React, { forwardRef, useMemo } from 'react';
import { useUIZoneSafe } from '@/shared/theming';
import type { UILibrary } from '@/shared/theming/types';

// Import library-specific components
import * as ShadcnComponents from './shadcn/components';
import * as NextUIComponents from './nextui/components';

// Re-export provider
export { NextUIZoneProvider } from './nextui/provider';

/**
 * Component mapping by library
 */
const componentMap = {
  shadcn: ShadcnComponents,
  nextui: NextUIComponents,
  // Future libraries would be added here
  daisyui: ShadcnComponents, // Fallback to shadcn for now
  mantine: ShadcnComponents, // Fallback to shadcn for now
} as const;

/**
 * Get components for the specified library
 */
function getLibraryComponents(library: UILibrary) {
  return componentMap[library] || ShadcnComponents;
}

/**
 * Hook to get the current library's components
 */
export function useZoneComponents() {
  const zone = useUIZoneSafe();
  const library = zone?.config.library ?? 'shadcn';

  return useMemo(() => getLibraryComponents(library), [library]);
}

// ============================================================================
// Dynamic Zone Components
// These components automatically use the correct library based on zone config
// ============================================================================

/**
 * Zone-aware Card component
 */
export const ZoneCard = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => {
    const components = useZoneComponents();
    const Card = components.ZoneCard;
    return <Card ref={ref} {...props} />;
  }
);
ZoneCard.displayName = 'ZoneCard';

/**
 * Zone-aware CardHeader component
 */
export const ZoneCardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => {
    const components = useZoneComponents();
    const CardHeader = components.ZoneCardHeader;
    return <CardHeader ref={ref} {...props} />;
  }
);
ZoneCardHeader.displayName = 'ZoneCardHeader';

/**
 * Zone-aware CardTitle component
 */
export const ZoneCardTitle = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  (props, ref) => {
    const components = useZoneComponents();
    const CardTitle = components.ZoneCardTitle;
    return <CardTitle ref={ref} {...props} />;
  }
);
ZoneCardTitle.displayName = 'ZoneCardTitle';

/**
 * Zone-aware CardDescription component
 */
export const ZoneCardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  (props, ref) => {
    const components = useZoneComponents();
    const CardDescription = components.ZoneCardDescription;
    return <CardDescription ref={ref} {...props} />;
  }
);
ZoneCardDescription.displayName = 'ZoneCardDescription';

/**
 * Zone-aware CardContent component
 */
export const ZoneCardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => {
    const components = useZoneComponents();
    const CardContent = components.ZoneCardContent;
    return <CardContent ref={ref} {...props} />;
  }
);
ZoneCardContent.displayName = 'ZoneCardContent';

/**
 * Zone-aware CardFooter component
 */
export const ZoneCardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => {
    const components = useZoneComponents();
    const CardFooter = components.ZoneCardFooter;
    return <CardFooter ref={ref} {...props} />;
  }
);
ZoneCardFooter.displayName = 'ZoneCardFooter';

/**
 * Zone-aware Button component
 */
export const ZoneButton = forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  (props, ref) => {
    const components = useZoneComponents();
    const Button = components.ZoneButton;
    return <Button ref={ref} {...props} />;
  }
);
ZoneButton.displayName = 'ZoneButton';

/**
 * Zone-aware Slider component
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
  (props, ref) => {
    const components = useZoneComponents();
    const Slider = components.ZoneSlider;
    return <Slider ref={ref} {...props} />;
  }
);
ZoneSlider.displayName = 'ZoneSlider';

/**
 * Zone-aware Badge component
 */
export const ZoneBadge = forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  (props, ref) => {
    const components = useZoneComponents();
    const Badge = components.ZoneBadge;
    return <Badge ref={ref} {...props} />;
  }
);
ZoneBadge.displayName = 'ZoneBadge';

/**
 * Zone-aware Tabs components
 */
export const ZoneTabs = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    defaultValue?: string;
    value?: string;
    onValueChange?: (value: string) => void;
  }
>((props, ref) => {
  const components = useZoneComponents();
  const Tabs = components.ZoneTabs;
  return <Tabs ref={ref} {...props} />;
});
ZoneTabs.displayName = 'ZoneTabs';

export const ZoneTabsList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => {
    const components = useZoneComponents();
    const TabsList = components.ZoneTabsList;
    return <TabsList ref={ref} {...props} />;
  }
);
ZoneTabsList.displayName = 'ZoneTabsList';

export const ZoneTabsTrigger = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { value: string }
>((props, ref) => {
  const components = useZoneComponents();
  const TabsTrigger = components.ZoneTabsTrigger;
  return <TabsTrigger ref={ref} {...props} />;
});
ZoneTabsTrigger.displayName = 'ZoneTabsTrigger';

export const ZoneTabsContent = forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>((props, ref) => {
  const components = useZoneComponents();
  const TabsContent = components.ZoneTabsContent;
  return <TabsContent ref={ref} {...props} />;
});
ZoneTabsContent.displayName = 'ZoneTabsContent';
