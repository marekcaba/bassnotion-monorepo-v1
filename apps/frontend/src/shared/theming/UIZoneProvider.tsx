'use client';

/**
 * UI Zone Provider
 *
 * Provides isolated zones for different UI libraries to coexist
 * without style conflicts. Uses CSS containment for isolation.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from 'react';
import type {
  UIZoneConfig,
  UIZoneContextValue,
  UILibrary,
  ThemeVariant,
  StyleEffect,
  BackgroundTheme,
  NeuroColor,
  NeuroIntensity,
} from './types';
import { DEFAULT_UI_ZONE_CONFIG, UI_ZONE_STORAGE_KEY } from './types';

// Available options for each setting
const AVAILABLE_LIBRARIES: UILibrary[] = ['shadcn'];
const AVAILABLE_VARIANTS: ThemeVariant[] = [
  'default',
  'purple',
  'blue',
  'green',
  'orange',
];
const AVAILABLE_EFFECTS: StyleEffect[] = [
  'flat',
  'glass',
  'neumorphic',
  'gradient',
];
const AVAILABLE_BACKGROUNDS: BackgroundTheme[] = [
  // Solid darks
  'dark',
  'darker',
  'darkest',
  // Subtle gradients
  'gradient-dark',
  'gradient-purple',
  'gradient-blue',
  'gradient-emerald',
  'gradient-amber',
  // Directional gradients
  'gradient-radial-purple',
  'gradient-radial-blue',
  'gradient-radial-center',
  // Mesh/Multi-color gradients
  'mesh-purple-blue',
  'mesh-sunset',
  'mesh-aurora',
  'mesh-ocean',
  // Animated backgrounds
  'animated-gradient',
  'animated-pulse',
  'animated-aurora',
  // Ambient/Atmospheric
  'ambient-stars',
  'ambient-glow',
  'ambient-fog',
  // Special
  'transparent',
];
const AVAILABLE_NEURO_COLORS: NeuroColor[] = [
  'neutral',
  'purple',
  'blue',
  'emerald',
  'amber',
  'rose',
];
const AVAILABLE_NEURO_INTENSITIES: NeuroIntensity[] = [
  'subtle',
  'medium',
  'strong',
];

// Create context with null default (must be used within provider)
const UIZoneContext = createContext<UIZoneContextValue | null>(null);

interface UIZoneProviderProps {
  children: React.ReactNode;
  /** Default library to use */
  defaultLibrary?: UILibrary;
  /** Default color variant */
  defaultVariant?: ThemeVariant;
  /** Default style effect */
  defaultEffect?: StyleEffect;
  /** Content to render outside the zone container (for fixed positioned elements like ThemeSwitcher) */
  floatingContent?: React.ReactNode;
}

/**
 * Load persisted config from localStorage
 */
function loadPersistedConfig(): Partial<UIZoneConfig> | null {
  if (typeof window === 'undefined') return null;

  try {
    const stored = localStorage.getItem(UI_ZONE_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate the parsed config
      if (
        AVAILABLE_LIBRARIES.includes(parsed.library) &&
        AVAILABLE_VARIANTS.includes(parsed.variant) &&
        AVAILABLE_EFFECTS.includes(parsed.effect) &&
        (!parsed.background ||
          AVAILABLE_BACKGROUNDS.includes(parsed.background))
      ) {
        return parsed;
      }
    }
  } catch {
    // Invalid stored config, ignore
  }
  return null;
}

/**
 * Persist config to localStorage
 */
function persistConfig(config: UIZoneConfig): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(UI_ZONE_STORAGE_KEY, JSON.stringify(config));
  } catch {
    // Storage not available, ignore
  }
}

export function UIZoneProvider({
  children,
  defaultLibrary,
  defaultVariant,
  defaultEffect,
  floatingContent,
}: UIZoneProviderProps) {
  // Initialize with defaults for SSR - localStorage will be loaded after hydration
  const [config, setConfigState] = useState<UIZoneConfig>(() => ({
    library: defaultLibrary ?? DEFAULT_UI_ZONE_CONFIG.library,
    variant: defaultVariant ?? DEFAULT_UI_ZONE_CONFIG.variant,
    effect: defaultEffect ?? DEFAULT_UI_ZONE_CONFIG.effect,
    background: DEFAULT_UI_ZONE_CONFIG.background,
    neuro: DEFAULT_UI_ZONE_CONFIG.neuro,
  }));

  // Track if we've hydrated (to prevent flash)
  const [isHydrated, setIsHydrated] = useState(false);

  // Load persisted config AFTER hydration to avoid SSR mismatch
  useEffect(() => {
    const persisted = loadPersistedConfig();
    if (persisted) {
      setConfigState((prev) => ({
        library: persisted.library ?? prev.library,
        variant: persisted.variant ?? prev.variant,
        effect: persisted.effect ?? prev.effect,
        background: persisted.background ?? prev.background,
        neuro: persisted.neuro ?? prev.neuro,
      }));
    }
    setIsHydrated(true);
  }, []);

  // Update config and persist
  const setConfig = useCallback((partial: Partial<UIZoneConfig>) => {
    setConfigState((prev) => {
      const newConfig = { ...prev, ...partial };
      persistConfig(newConfig);
      return newConfig;
    });
  }, []);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo<UIZoneContextValue>(
    () => ({
      config,
      setConfig,
      availableLibraries: AVAILABLE_LIBRARIES,
      availableVariants: AVAILABLE_VARIANTS,
      availableEffects: AVAILABLE_EFFECTS,
      availableBackgrounds: AVAILABLE_BACKGROUNDS,
      availableNeuroColors: AVAILABLE_NEURO_COLORS,
      availableNeuroIntensities: AVAILABLE_NEURO_INTENSITIES,
    }),
    [config, setConfig],
  );

  return (
    <UIZoneContext.Provider value={contextValue}>
      <div
        className="ui-zone"
        data-library={config.library}
        data-variant={config.variant}
        data-effect={config.effect}
        data-background={config.background}
        data-neuro-color={config.neuro.color}
        data-neuro-intensity={config.neuro.intensity}
      >
        {children}
      </div>
      {/* Floating content rendered outside the zone container to avoid CSS containment issues */}
      {floatingContent}
    </UIZoneContext.Provider>
  );
}

/**
 * Hook to access UI zone configuration
 *
 * @throws Error if used outside of UIZoneProvider
 */
export function useUIZone(): UIZoneContextValue {
  const context = useContext(UIZoneContext);

  if (!context) {
    throw new Error('useUIZone must be used within a UIZoneProvider');
  }

  return context;
}

/**
 * Hook to safely access UI zone (returns null if outside provider)
 */
export function useUIZoneSafe(): UIZoneContextValue | null {
  return useContext(UIZoneContext);
}
