'use client';

/**
 * Theme Switcher Component (Admin Only)
 *
 * Floating panel for switching between UI libraries, color variants,
 * and style effects. Only visible to admin users.
 */

import React, { useState, useCallback } from 'react';
import { useUIZone } from './UIZoneProvider';
import { themeVariants } from './themes';
import type { UILibrary, ThemeVariant, StyleEffect } from './types';
import { cn } from '@/shared/utils/cn';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';

/**
 * Theme Switcher - Admin-only floating panel
 *
 * Provides UI for switching:
 * - UI Library (shadcn, nextui, etc.)
 * - Color Variant (default, purple, blue, green, orange)
 * - Style Effect (flat, glass, neumorphic, gradient)
 */
export function ThemeSwitcher() {
  const { profile } = useUserProfile();
  const isAdmin = profile?.role === 'admin';

  const [isOpen, setIsOpen] = useState(false);
  const [backgroundTab, setBackgroundTab] = useState<
    'solid' | 'gradient' | 'mesh' | 'animated' | 'ambient'
  >('solid');
  const {
    config,
    setConfig,
    availableLibraries,
    availableVariants,
    availableEffects,
    availableNeuroColors,
    availableNeuroIntensities,
  } = useUIZone();

  // Neumorphic color previews
  const neuroColorInfo: Record<string, { label: string; hue: number }> = {
    neutral: { label: 'Neutral', hue: 220 },
    purple: { label: 'Purple', hue: 270 },
    blue: { label: 'Blue', hue: 220 },
    emerald: { label: 'Emerald', hue: 160 },
    amber: { label: 'Amber', hue: 35 },
    rose: { label: 'Rose', hue: 350 },
  };

  // Background theme categories with display names and preview colors
  const backgroundCategories = {
    solid: {
      label: 'Solid',
      items: {
        dark: {
          label: 'Dark',
          preview:
            'linear-gradient(180deg, hsl(220 15% 10%) 0%, hsl(220 20% 8%) 100%)',
        },
        darker: {
          label: 'Darker',
          preview:
            'linear-gradient(180deg, hsl(220 18% 7%) 0%, hsl(220 22% 5%) 100%)',
        },
        darkest: {
          label: 'Darkest',
          preview:
            'linear-gradient(180deg, hsl(220 20% 4%) 0%, hsl(220 25% 2%) 100%)',
        },
        transparent: {
          label: 'None',
          preview:
            'repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 8px 8px',
        },
      },
    },
    gradient: {
      label: 'Gradients',
      items: {
        'gradient-dark': {
          label: 'Dark',
          preview:
            'linear-gradient(135deg, hsl(220 20% 8%) 0%, hsl(260 18% 8%) 100%)',
        },
        'gradient-purple': {
          label: 'Purple',
          preview:
            'linear-gradient(135deg, hsl(270 30% 12%) 0%, hsl(260 20% 10%) 100%)',
        },
        'gradient-blue': {
          label: 'Blue',
          preview:
            'linear-gradient(135deg, hsl(220 35% 10%) 0%, hsl(230 25% 12%) 100%)',
        },
        'gradient-emerald': {
          label: 'Emerald',
          preview:
            'linear-gradient(135deg, hsl(160 30% 8%) 0%, hsl(150 20% 10%) 100%)',
        },
        'gradient-amber': {
          label: 'Amber',
          preview:
            'linear-gradient(135deg, hsl(30 30% 10%) 0%, hsl(35 20% 8%) 100%)',
        },
        'gradient-radial-purple': {
          label: 'Radial Purple',
          preview:
            'radial-gradient(ellipse at 50% 0%, hsl(280 40% 20%) 0%, hsl(260 25% 5%) 100%)',
        },
        'gradient-radial-blue': {
          label: 'Radial Blue',
          preview:
            'radial-gradient(ellipse at 50% 0%, hsl(220 45% 20%) 0%, hsl(240 25% 5%) 100%)',
        },
        'gradient-radial-center': {
          label: 'Radial Center',
          preview:
            'radial-gradient(circle at 50% 50%, hsl(260 30% 15%) 0%, hsl(240 20% 4%) 100%)',
        },
      },
    },
    mesh: {
      label: 'Mesh',
      items: {
        'mesh-purple-blue': {
          label: 'Purple Blue',
          preview:
            'linear-gradient(135deg, hsl(280 50% 15%) 0%, hsl(220 50% 15%) 50%, hsl(250 25% 6%) 100%)',
        },
        'mesh-sunset': {
          label: 'Sunset',
          preview:
            'linear-gradient(135deg, hsl(330 50% 18%) 0%, hsl(30 50% 15%) 50%, hsl(350 30% 6%) 100%)',
        },
        'mesh-aurora': {
          label: 'Aurora',
          preview:
            'linear-gradient(135deg, hsl(160 60% 15%) 0%, hsl(280 50% 15%) 50%, hsl(220 25% 5%) 100%)',
        },
        'mesh-ocean': {
          label: 'Ocean',
          preview:
            'linear-gradient(135deg, hsl(200 60% 15%) 0%, hsl(180 50% 12%) 50%, hsl(210 30% 5%) 100%)',
        },
      },
    },
    animated: {
      label: 'Animated',
      items: {
        'animated-gradient': {
          label: 'Shifting',
          preview:
            'linear-gradient(-45deg, hsl(260 30% 10%), hsl(280 35% 12%), hsl(220 30% 10%), hsl(240 35% 12%))',
        },
        'animated-pulse': {
          label: 'Pulse',
          preview:
            'radial-gradient(circle at 50% 50%, hsl(270 40% 20%) 0%, hsl(250 25% 6%) 100%)',
        },
        'animated-aurora': {
          label: 'Aurora Flow',
          preview:
            'linear-gradient(135deg, hsl(160 50% 10%), hsl(280 40% 12%), hsl(320 35% 10%))',
        },
      },
    },
    ambient: {
      label: 'Ambient',
      items: {
        'ambient-stars': { label: 'Stars', preview: 'hsl(240 20% 4%)' },
        'ambient-glow': {
          label: 'Glow',
          preview:
            'radial-gradient(ellipse 80% 50% at 50% 100%, hsl(270 50% 15%) 0%, hsl(250 25% 5%) 100%)',
        },
        'ambient-fog': { label: 'Fog', preview: 'hsl(220 20% 6%)' },
      },
    },
  };

  const currentCategoryItems = backgroundCategories[backgroundTab].items;

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  // Only render for admins
  if (!isAdmin) {
    return null;
  }

  return (
    <div
      className="fixed bottom-4 right-4 z-[99999]"
      style={{ position: 'fixed' }}
    >
      {/* Toggle Button */}
      <button
        onClick={toggleOpen}
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center',
          'bg-purple-600 hover:bg-purple-500 text-white',
          'shadow-lg hover:shadow-xl transition-all duration-200',
          'border-2 border-purple-400/30',
          isOpen && 'rotate-45',
        )}
        title="Theme Settings"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      </button>

      {/* Settings Panel */}
      {isOpen && (
        <div
          className={cn(
            'absolute bottom-16 right-0 w-80',
            'bg-slate-900/95 backdrop-blur-xl rounded-2xl',
            'border border-slate-700/50 shadow-2xl',
            'p-4 space-y-4',
            'max-h-[80vh] overflow-y-auto',
            'animate-in fade-in slide-in-from-bottom-2 duration-200',
          )}
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">Theme Settings</h4>
            <span className="text-xs text-purple-400 bg-purple-500/20 px-2 py-0.5 rounded">
              Admin
            </span>
          </div>

          {/* UI Library Selector */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 uppercase tracking-wide">
              UI Library
            </label>
            <div className="flex gap-2">
              {availableLibraries.map((lib) => (
                <button
                  key={lib}
                  onClick={() => setConfig({ library: lib })}
                  className={cn(
                    'flex-1 px-3 py-2 text-xs font-medium rounded-lg transition-all',
                    config.library === lib
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300',
                  )}
                >
                  {lib}
                </button>
              ))}
            </div>
          </div>

          {/* Color Variant Selector */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 uppercase tracking-wide">
              Color Theme
            </label>
            <div className="flex gap-2 justify-between">
              {availableVariants.map((variant) => {
                const colors = themeVariants[variant];
                return (
                  <button
                    key={variant}
                    onClick={() => setConfig({ variant })}
                    className={cn(
                      'w-10 h-10 rounded-full transition-all duration-200',
                      'flex items-center justify-center',
                      config.variant === variant
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                        : 'hover:scale-105',
                    )}
                    style={{
                      background: `linear-gradient(135deg,
                        hsl(${colors.primary.h} ${colors.primary.s}% ${colors.primary.l}%),
                        hsl(${colors.secondary.h} ${colors.secondary.s}% ${colors.secondary.l}%)
                      )`,
                    }}
                    title={variant}
                  />
                );
              })}
            </div>
          </div>

          {/* Style Effect Selector */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 uppercase tracking-wide">
              Style Effect
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableEffects.map((effect) => (
                <button
                  key={effect}
                  onClick={() => setConfig({ effect })}
                  className={cn(
                    'px-3 py-2 text-xs font-medium rounded-lg transition-all',
                    'capitalize',
                    config.effect === effect
                      ? 'bg-purple-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300',
                  )}
                >
                  {effect}
                </button>
              ))}
            </div>
          </div>

          {/* Neumorphic Style Options - Only show when neumorphic effect is selected */}
          {config.effect === 'neumorphic' && (
            <div className="space-y-3 p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <label className="text-xs text-slate-400 uppercase tracking-wide">
                Neumorphic Style
              </label>

              {/* Neuro Color Selector */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500">Color</span>
                <div className="flex gap-2 justify-between">
                  {availableNeuroColors.map((color) => {
                    const info = neuroColorInfo[color];
                    return (
                      <button
                        key={color}
                        onClick={() =>
                          setConfig({ neuro: { ...config.neuro, color } })
                        }
                        className={cn(
                          'w-8 h-8 rounded-full transition-all duration-200',
                          'flex items-center justify-center',
                          config.neuro.color === color
                            ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110'
                            : 'hover:scale-105',
                        )}
                        style={{
                          background: `radial-gradient(circle at 30% 30%,
                            hsl(${info.hue} 20% 22%),
                            hsl(${info.hue} 15% 12%))`,
                          boxShadow: `
                            3px 3px 6px hsl(${info.hue} 15% 6%),
                            -3px -3px 6px hsl(${info.hue} 10% 18%)
                          `,
                        }}
                        title={info.label}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Neuro Intensity Selector */}
              <div className="space-y-1.5">
                <span className="text-[10px] text-slate-500">Intensity</span>
                <div className="flex gap-2">
                  {availableNeuroIntensities.map((intensity) => (
                    <button
                      key={intensity}
                      onClick={() =>
                        setConfig({ neuro: { ...config.neuro, intensity } })
                      }
                      className={cn(
                        'flex-1 px-3 py-1.5 text-xs font-medium rounded-lg transition-all',
                        'capitalize',
                        config.neuro.intensity === intensity
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300',
                      )}
                    >
                      {intensity}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Background Theme Selector */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400 uppercase tracking-wide">
              Background
            </label>
            {/* Category Tabs */}
            <div className="flex gap-1 p-1 bg-slate-800/50 rounded-lg">
              {(
                Object.keys(backgroundCategories) as Array<
                  keyof typeof backgroundCategories
                >
              ).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setBackgroundTab(cat)}
                  className={cn(
                    'flex-1 px-2 py-1.5 text-[10px] font-medium rounded-md transition-all',
                    backgroundTab === cat
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-300 hover:bg-slate-700/50',
                  )}
                >
                  {backgroundCategories[cat].label}
                </button>
              ))}
            </div>
            {/* Background Options Grid */}
            <div className="grid grid-cols-4 gap-1.5 max-h-32 overflow-y-auto p-1">
              {Object.entries(currentCategoryItems).map(([key, info]) => (
                <button
                  key={key}
                  onClick={() =>
                    setConfig({ background: key as typeof config.background })
                  }
                  className={cn(
                    'flex flex-col items-center gap-0.5 p-1.5 rounded-lg transition-all',
                    config.background === key
                      ? 'ring-2 ring-purple-500 ring-offset-1 ring-offset-slate-900 bg-slate-800/50'
                      : 'hover:bg-slate-800/50',
                  )}
                  title={info.label}
                >
                  <div
                    className={cn(
                      'w-7 h-7 rounded-md border border-slate-600',
                      backgroundTab === 'animated' && 'animate-pulse',
                    )}
                    style={{ background: info.preview }}
                  />
                  <span className="text-[8px] text-slate-400 truncate w-full text-center">
                    {info.label}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Current Config Display */}
          <div className="pt-2 border-t border-slate-700/50">
            <div className="text-xs text-slate-500">
              Current: <span className="text-slate-300">{config.library}</span>{' '}
              / <span className="text-slate-300">{config.variant}</span> /{' '}
              <span className="text-slate-300">{config.effect}</span>
              {config.effect === 'neumorphic' && (
                <>
                  {' '}
                  (<span className="text-slate-300">
                    {config.neuro.color}
                  </span>,{' '}
                  <span className="text-slate-300">
                    {config.neuro.intensity}
                  </span>
                  )
                </>
              )}{' '}
              / <span className="text-slate-300">{config.background}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
