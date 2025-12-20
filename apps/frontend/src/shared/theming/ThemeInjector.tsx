'use client';

/**
 * Theme Injector
 *
 * Injects CSS variables based on the current theme variant.
 * Uses a <style> tag to dynamically update CSS custom properties.
 */

import { useUIZone } from './UIZoneProvider';
import { getThemeCSSVariables } from './themes';

/**
 * Component that injects theme CSS variables into the document
 */
export function ThemeInjector(): JSX.Element {
  const { config } = useUIZone();
  const cssVariables = getThemeCSSVariables(config.variant);

  return (
    <style
      dangerouslySetInnerHTML={{
        __html: `.ui-zone { ${cssVariables} }`,
      }}
    />
  );
}
