/**
 * Theme Color Definitions
 *
 * Defines HSL color palettes for each theme variant.
 * Colors use HSL format for easy manipulation.
 */

import type { ThemeColors, ThemeVariant } from './types';

/**
 * Color variants for theming
 *
 * Each variant defines primary, secondary, and accent colors
 * using HSL values (hue, saturation, lightness).
 */
export const themeVariants: Record<ThemeVariant, ThemeColors> = {
  default: {
    primary: { h: 270, s: 70, l: 55 }, // Purple
    secondary: { h: 230, s: 80, l: 65 }, // Blue
    accent: { h: 35, s: 90, l: 55 }, // Orange
  },
  purple: {
    primary: { h: 280, s: 75, l: 60 }, // Violet
    secondary: { h: 260, s: 65, l: 50 }, // Indigo
    accent: { h: 320, s: 70, l: 55 }, // Pink
  },
  blue: {
    primary: { h: 220, s: 80, l: 55 }, // Azure
    secondary: { h: 200, s: 75, l: 50 }, // Cyan
    accent: { h: 180, s: 70, l: 55 }, // Teal
  },
  green: {
    primary: { h: 140, s: 70, l: 45 }, // Emerald
    secondary: { h: 160, s: 65, l: 40 }, // Mint
    accent: { h: 120, s: 60, l: 50 }, // Lime
  },
  orange: {
    primary: { h: 25, s: 90, l: 55 }, // Amber
    secondary: { h: 35, s: 85, l: 50 }, // Gold
    accent: { h: 15, s: 80, l: 50 }, // Red-Orange
  },
};

/**
 * Convert theme colors to CSS variable string
 */
export function getThemeCSSVariables(variant: ThemeVariant): string {
  const colors = themeVariants[variant];

  return `
    --theme-primary-h: ${colors.primary.h};
    --theme-primary-s: ${colors.primary.s}%;
    --theme-primary-l: ${colors.primary.l}%;
    --theme-secondary-h: ${colors.secondary.h};
    --theme-secondary-s: ${colors.secondary.s}%;
    --theme-secondary-l: ${colors.secondary.l}%;
    --theme-accent-h: ${colors.accent.h};
    --theme-accent-s: ${colors.accent.s}%;
    --theme-accent-l: ${colors.accent.l}%;
  `;
}

/**
 * Get a CSS color string from theme variant
 */
export function getThemeColor(
  variant: ThemeVariant,
  colorType: 'primary' | 'secondary' | 'accent',
  opacity = 1,
): string {
  const color = themeVariants[variant][colorType];
  return `hsl(${color.h} ${color.s}% ${color.l}% / ${opacity})`;
}
