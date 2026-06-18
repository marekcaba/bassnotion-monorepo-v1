'use client';

import { ReactNode, useState, useCallback, useEffect, useMemo } from 'react';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { AppSidebar } from '@/domains/platform/components/AppSidebar';
import { DetailPanel } from '@/domains/platform/components/DetailPanel';
import { MobileHeader } from '@/domains/platform/components/MobileHeader';
import { AuthGuard } from '@/shared/components/ui/auth-guard';
import { AudioProvider } from '@/domains/playback/providers/AudioProvider';
import { AudioDebugPanel } from '@/shared/debug/AudioDebugger';
import { HealthStatus } from '@/shared/components/HealthStatus';
import { LeatherBackground } from '@/shared/components/LeatherBackground';
import {
  XStateDevToolsProvider,
  XStateDebugPanel,
} from '@/domains/playback/machines';
import { useInternalPathname } from '@/lib/hooks/use-internal-pathname';

/**
 * Deep routes (e.g. /app/bassment, /app/tutorials/come-together) open the detail
 * panel automatically. This drives the PANEL's behavior only — the first column
 * (the nav sidebar) never collapses; it stays expanded on every /app route.
 */
function isDeepAppRoute(pathname: string): boolean {
  // /app/bassment behaves like the tutorial routes (panel auto-opens)
  if (pathname === '/app/bassment') return true;
  // /app → ['', 'app'] (depth 0); /app/settings → depth 1; /app/tutorials/slug
  // → depth 2+. Anything 4+ segments is a deep route.
  const segments = pathname.split('/');
  return segments.length > 3;
}

/**
 * The client shell for the /app/* tree (AuthGuard + sidebar + detail panel).
 * Split out of layout.tsx so layout.tsx can be a SERVER component that exports
 * `metadata: { robots: { index: false } }` (the app member surface must not be
 * indexed; see docs/deployment/APP_SUBDOMAIN_RUNBOOK.md Step 9).
 */
export function AppClientLayout({ children }: { children: ReactNode }) {
  // Internal /app/* path (clean on the app subdomain, re-prefixed by the hook).
  const pathname = useInternalPathname();
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // The first column (nav sidebar) NEVER collapses — always expanded, on every
  // /app route. (It used to collapse to an icon rail on deep routes.)
  const sidebarExpanded = true;

  const isDeepRoute = useMemo(() => isDeepAppRoute(pathname), [pathname]);

  // Auto-open the detail panel when entering a deep (tutorial-like) route.
  useEffect(() => {
    if (isDeepRoute) {
      setIsPanelOpen(true);
    }
  }, [isDeepRoute]);

  const handleTogglePanel = useCallback(() => {
    setIsPanelOpen((prev) => !prev);
  }, []);

  return (
    <>
      <AuthGuard redirectTo="/login">
        <XStateDevToolsProvider showStatus={true}>
          <AudioProvider>
            <TooltipProvider delayDuration={0}>
              <div
                className="relative flex h-svh w-full flex-col overflow-hidden lg:flex-row"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 0%, hsl(240 6% 10%) 0%, hsl(240 4% 6%) 50%, hsl(0 0% 3%) 100%)',
                }}
              >
                {/* Leather + noise overlay over the gradient base. Sits at
                    z-0; the main content area below is z-10 so it (and the
                    transparent tutorial/drill surfaces) paint on top. The
                    sidebar + header carry their own solid backgrounds. */}
                <LeatherBackground />

                {/* Mobile: top header + hamburger drawer */}
                <MobileHeader />

                {/* Desktop: sidebar + detail panel (hidden below lg) */}
                <div className="hidden lg:contents">
                  <AppSidebar expanded={sidebarExpanded} />
                  <DetailPanel
                    isOpen={isPanelOpen}
                    onToggle={handleTogglePanel}
                  />
                </div>

                <main className="relative z-10 flex-1 overflow-auto">
                  {children}
                </main>
              </div>
            </TooltipProvider>
            <AudioDebugPanel />
            <HealthStatus />
            <XStateDebugPanel position="bottom-left" keyboardShortcut="alt+x" />
          </AudioProvider>
        </XStateDevToolsProvider>
      </AuthGuard>
    </>
  );
}
