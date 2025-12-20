'use client';

/**
 * Themed Layout Component
 *
 * Wraps the entire app with UIZoneProvider for consistent theming across all pages.
 * The ThemeSwitcher is rendered as floating content (admin-only).
 */

import React from 'react';
import { UIZoneProvider } from '@/shared/theming/UIZoneProvider';
import { ThemeInjector } from '@/shared/theming/ThemeInjector';
import { ThemeSwitcher } from '@/shared/theming/ThemeSwitcher';

interface ThemedLayoutProps {
  children: React.ReactNode;
}

export function ThemedLayout({ children }: ThemedLayoutProps) {
  return (
    <UIZoneProvider floatingContent={<ThemeSwitcher />}>
      <ThemeInjector />
      {children}
    </UIZoneProvider>
  );
}
