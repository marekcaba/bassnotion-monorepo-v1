'use client';

import { ReactNode, useState, useCallback, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { AppSidebar } from '@/domains/platform/components/AppSidebar';
import { DetailPanel } from '@/domains/platform/components/DetailPanel';
import { MobileHeader } from '@/domains/platform/components/MobileHeader';
import { AuthGuard } from '@/shared/components/ui/auth-guard';
import { AudioProvider } from '@/domains/playback/providers/AudioProvider';
import { AudioDebugPanel } from '@/shared/debug/AudioDebugger';
import { HealthStatus } from '@/shared/components/HealthStatus';
import {
  XStateDevToolsProvider,
  XStateDebugPanel,
} from '@/domains/playback/machines';

/**
 * Sidebar is expanded on top-level /app routes (e.g. /app, /app/settings)
 * and collapsed on deeper routes (e.g. /app/bassment, /app/tutorials/come-together).
 */
function isTopLevelAppRoute(pathname: string): boolean {
  // /app/bassment gets collapsed sidebar (like tutorial routes)
  if (pathname === '/app/bassment') return false;
  // /app → segments = ['', 'app'] → depth 0
  // /app/settings → segments = ['', 'app', 'settings'] → depth 1
  // /app/tutorials/slug → segments = ['', 'app', 'tutorials', 'slug'] → depth 2+
  const segments = pathname.split('/');
  return segments.length <= 3;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  const sidebarExpanded = useMemo(
    () => isTopLevelAppRoute(pathname),
    [pathname],
  );

  // Auto-open panel when entering tutorial routes from an expanded-sidebar route
  useEffect(() => {
    if (!sidebarExpanded) {
      setIsPanelOpen(true);
    }
  }, [sidebarExpanded]);

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
                className="flex h-svh w-full flex-col lg:flex-row overflow-hidden"
                style={{
                  background:
                    'radial-gradient(ellipse at 50% 0%, hsl(240 6% 10%) 0%, hsl(240 4% 6%) 50%, hsl(0 0% 3%) 100%)',
                }}
              >
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

                <main className="flex-1 overflow-auto">{children}</main>
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
