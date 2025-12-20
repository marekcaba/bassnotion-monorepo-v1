/**
 * NextUI Theme Configuration
 *
 * Defines the BassNotion theme for NextUI components.
 */

import type { ThemeVariant } from '@/shared/theming/types';
import { themeVariants } from '@/shared/theming/themes';

/**
 * Get NextUI theme colors based on the current theme variant
 */
export function getNextUIThemeColors(variant: ThemeVariant) {
  const colors = themeVariants[variant];

  return {
    primary: {
      DEFAULT: `hsl(${colors.primary.h} ${colors.primary.s}% ${colors.primary.l}%)`,
      foreground: '#ffffff',
    },
    secondary: {
      DEFAULT: `hsl(${colors.secondary.h} ${colors.secondary.s}% ${colors.secondary.l}%)`,
      foreground: '#ffffff',
    },
    focus: `hsl(${colors.accent.h} ${colors.accent.s}% ${colors.accent.l}%)`,
  };
}

/**
 * Base NextUI theme configuration
 */
export const nextUIBaseTheme = {
  layout: {
    radius: {
      small: '8px',
      medium: '12px',
      large: '16px',
    },
  },
};
