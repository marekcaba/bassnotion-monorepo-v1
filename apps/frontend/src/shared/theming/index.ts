/**
 * UI Zone Theming System
 *
 * Provides multi-UI library support with theme variants and visual effects.
 *
 * @example
 * ```tsx
 * import { UIZoneProvider, useUIZone, ThemeInjector } from '@/shared/theming';
 *
 * function App() {
 *   return (
 *     <UIZoneProvider>
 *       <ThemeInjector />
 *       <YourContent />
 *     </UIZoneProvider>
 *   );
 * }
 *
 * function YourComponent() {
 *   const { config, setConfig } = useUIZone();
 *   // Use config.library, config.variant, config.effect
 * }
 * ```
 */

// Provider and hooks
export { UIZoneProvider, useUIZone, useUIZoneSafe } from './UIZoneProvider';

// Theme injector
export { ThemeInjector } from './ThemeInjector';

// Theme switcher (admin-only)
export { ThemeSwitcher } from './ThemeSwitcher';

// Theme definitions
export { themeVariants, getThemeCSSVariables, getThemeColor } from './themes';

// Types
export type {
  UILibrary,
  ThemeVariant,
  StyleEffect,
  UIZoneConfig,
  UIZoneContextValue,
  HSLColor,
  ThemeColors,
} from './types';

// Constants
export {
  DEFAULT_UI_ZONE_CONFIG,
  UI_ZONE_STORAGE_KEY,
} from './types';
