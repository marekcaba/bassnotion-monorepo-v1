/**
 * shadcn/ui Component Exports
 *
 * Re-exports existing shadcn components for use in the zone system.
 * These are the baseline components that other libraries match.
 */

// Card components
export {
  Card as ZoneCard,
  CardHeader as ZoneCardHeader,
  CardTitle as ZoneCardTitle,
  CardDescription as ZoneCardDescription,
  CardContent as ZoneCardContent,
  CardFooter as ZoneCardFooter,
} from '@/shared/components/ui/card';

// Button component
export { Button as ZoneButton } from '@/shared/components/ui/button';

// Slider component
export { Slider as ZoneSlider } from '@/shared/components/ui/slider';

// Badge component
export { Badge as ZoneBadge } from '@/shared/components/ui/badge';

// Tabs components
export {
  Tabs as ZoneTabs,
  TabsList as ZoneTabsList,
  TabsTrigger as ZoneTabsTrigger,
  TabsContent as ZoneTabsContent,
} from '@/shared/components/ui/tabs';
