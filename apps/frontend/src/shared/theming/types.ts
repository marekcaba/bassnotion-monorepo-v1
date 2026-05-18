/**
 * UI Zone Theming Types
 *
 * Defines the type system for multi-UI library support with
 * theme variants and visual effects.
 */

/** Supported UI component libraries */
export type UILibrary = 'shadcn' | 'nextui' | 'daisyui' | 'mantine';

/** Color theme variants */
export type ThemeVariant = 'default' | 'purple' | 'blue' | 'green' | 'orange';

/** Visual style effects */
export type StyleEffect = 'flat' | 'glass' | 'neumorphic' | 'gradient';

/** Neumorphic color schemes */
export type NeuroColor =
  | 'neutral'
  | 'purple'
  | 'blue'
  | 'emerald'
  | 'amber'
  | 'rose';

/** Neumorphic intensity levels */
export type NeuroIntensity = 'subtle' | 'medium' | 'strong';

/** Neumorphic style options */
export interface NeuroStyle {
  color: NeuroColor;
  intensity: NeuroIntensity;
}

/** Background theme options */
export type BackgroundTheme =
  // Solid darks
  | 'dark'
  | 'darker'
  | 'darkest'
  // Subtle gradients
  | 'gradient-dark'
  | 'gradient-purple'
  | 'gradient-blue'
  | 'gradient-emerald'
  | 'gradient-amber'
  // Directional gradients
  | 'gradient-radial-purple'
  | 'gradient-radial-blue'
  | 'gradient-radial-center'
  // Mesh/Multi-color gradients
  | 'mesh-purple-blue'
  | 'mesh-sunset'
  | 'mesh-aurora'
  | 'mesh-ocean'
  // Animated backgrounds
  | 'animated-gradient'
  | 'animated-pulse'
  | 'animated-aurora'
  // Ambient/Atmospheric
  | 'ambient-stars'
  | 'ambient-glow'
  | 'ambient-fog'
  // Special
  | 'transparent';

/** Complete UI zone configuration */
export interface UIZoneConfig {
  /** Active UI component library */
  library: UILibrary;
  /** Active color theme variant */
  variant: ThemeVariant;
  /** Active visual style effect */
  effect: StyleEffect;
  /** Active background theme */
  background: BackgroundTheme;
  /** Neumorphic style options */
  neuro: NeuroStyle;
}

/** UI Zone context value */
export interface UIZoneContextValue {
  /** Current configuration */
  config: UIZoneConfig;
  /** Update configuration (partial updates supported) */
  setConfig: (partial: Partial<UIZoneConfig>) => void;
  /** List of available libraries */
  availableLibraries: UILibrary[];
  /** List of available color variants */
  availableVariants: ThemeVariant[];
  /** List of available style effects */
  availableEffects: StyleEffect[];
  /** List of available background themes */
  availableBackgrounds: BackgroundTheme[];
  /** List of available neumorphic colors */
  availableNeuroColors: NeuroColor[];
  /** List of available neumorphic intensities */
  availableNeuroIntensities: NeuroIntensity[];
}

/** HSL color definition */
export interface HSLColor {
  h: number; // Hue (0-360)
  s: number; // Saturation (0-100)
  l: number; // Lightness (0-100)
}

/** Theme color palette */
export interface ThemeColors {
  primary: HSLColor;
  secondary: HSLColor;
  accent: HSLColor;
}

/** Storage key for persisting theme config */
export const UI_ZONE_STORAGE_KEY = 'bassnotion-ui-zone-config';

/** Default configuration */
export const DEFAULT_UI_ZONE_CONFIG: UIZoneConfig = {
  library: 'shadcn',
  variant: 'default',
  effect: 'flat',
  background: 'dark',
  neuro: {
    color: 'neutral',
    intensity: 'medium',
  },
};
