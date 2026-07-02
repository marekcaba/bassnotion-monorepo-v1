'use client';

import { ReactNode, useState, useCallback, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { TooltipProvider } from '@/shared/components/ui/tooltip';
import { AppSidebar } from '@/domains/platform/components/AppSidebar';
import { DetailPanel } from '@/domains/platform/components/DetailPanel';
import { MobileHeader } from '@/domains/platform/components/MobileHeader';
import { AuthGuard } from '@/shared/components/ui/auth-guard';
import { LeatherBackground } from '@/shared/components/LeatherBackground';
// Deep import (NOT the machines barrel) so index.ts's playbackMachine +
// @xstate/react + test re-exports don't get dragged into the shell chunk.
import { XStateDevToolsProvider } from '@/domains/playback/machines/XStateDevToolsProvider';
import { useInternalPathname } from '@/lib/hooks/use-internal-pathname';
import { AuthWelcomeOverlay } from '@/domains/user/components/auth/AuthWelcomeOverlay';
import {
  useWelcomePhase,
  WELCOME_FADE_MS,
} from '@/domains/user/components/auth/useWelcomePhase';
import { AppAudioWarmup } from './AppAudioWarmup';
import { AppGymWarmup } from './AppGymWarmup';
import { routeNeedsAudioProvider } from './audioRoutes';

// AudioProvider pulls the playback graph (PlaybackEngine ~162KB + CoreServices
// ~54KB + Tone) — evict it from the shared /app shell chunk via dynamic import so
// audio-free pages (gigs/college/settings/backstage) paint without it. ssr:false
// because it creates a real AudioContext; loading:null so children paint while
// the provider chunk streams in parallel. The provider still wraps children, so
// downstream hook consumers never see a missing provider.
const AudioProvider = dynamic(
  () =>
    import('@/domains/playback/providers/AudioProvider').then((m) => ({
      default: m.AudioProvider,
    })),
  { ssr: false, loading: () => null },
);

// Dev/debug panels: their JS should not ship in the prod shell. They already
// self-gate at runtime (AudioDebugPanel needs NEXT_PUBLIC_DEBUG_AUDIO,
// XStateDebugPanel is dev-only), but dynamic({ssr:false}) keeps the code out of
// the first-paint chunk entirely.
const AudioDebugPanel = dynamic(
  () =>
    import('@/shared/debug/AudioDebugger').then((m) => ({
      default: m.AudioDebugPanel,
    })),
  { ssr: false, loading: () => null },
);
const HealthStatus = dynamic(
  () =>
    import('@/shared/components/HealthStatus').then((m) => ({
      default: m.HealthStatus,
    })),
  { ssr: false, loading: () => null },
);
const XStateDebugPanel = dynamic(
  () =>
    import('@/domains/playback/machines/XStateDebugPanel').then((m) => ({
      default: m.XStateDebugPanel,
    })),
  { ssr: false, loading: () => null },
);

const isDev = process.env.NODE_ENV === 'development';
const debugAudio = process.env.NEXT_PUBLIC_DEBUG_AUDIO === 'true';

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
export function AppClientLayout({
  children,
  showWelcome = false,
}: {
  children: ReactNode;
  /** Server-decided (bn-welcome cookie) — paint the welcome overlay in the first HTML. */
  showWelcome?: boolean;
}) {
  // Internal /app/* path (clean on the app subdomain, re-prefixed by the hook).
  const pathname = useInternalPathname();
  const [isPanelOpen, setIsPanelOpen] = useState(true);

  // Post-login welcome: ONE phase drives the logo overlay fading OUT + the content fading IN, over
  // the shell's unchanging leather (the overlay is transparent), so the crossfade is seamless.
  const welcomePhase = useWelcomePhase(showWelcome);
  const welcomeActive = welcomePhase !== 'done';

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

  // Only MOUNT AudioProvider where a player renders at mount (tutorials).
  // dynamic() splits the chunk out, but mounting the provider still triggers
  // React to FETCH that 232KB engine chunk — so the GYM is deliberately excluded
  // (its overlay/floor are audio-free; the player only mounts at drill 'running',
  // and AppAudioWarmup + ensureAudioReady() warm the engine in the background).
  // This keeps the engine off gigs/gym-overlay/settings/college-landing/etc.
  const audioRoute = routeNeedsAudioProvider(pathname);

  const inner = (
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
          <DetailPanel isOpen={isPanelOpen} onToggle={handleTogglePanel} />
        </div>

        <main
          className="app-page-enter relative z-10 flex-1 overflow-auto"
          // The gym manages its own entrance (gym-rise on the floor + the
          // overlay's own fade) and has a backdrop-filter scrim that an animating
          // ancestor would break — so opt it out of the <main> mount fade.
          {...(pathname === '/app/gym' ? { 'data-no-page-fade': '' } : {})}
        >
          {/* Branded welcome beat after a fresh login (server-decided showWelcome, first HTML paint,
              scoped to <main> so the sidebar shell stays). The overlay is TRANSPARENT — the shell's
              continuous leather shows through — and the CONTENT below crossfades IN over that same
              unmoving leather as the logo fades OUT. One phase drives both (lockstep, seamless). */}
          <AuthWelcomeOverlay phase={welcomePhase} />
          {/* Content wrapper: hidden while the welcome logo holds, fades IN as it fades out. Once the
              welcome is done (or never fired), it's a plain always-opaque passthrough. */}
          {welcomeActive ? (
            <div
              style={{
                opacity: welcomePhase === 'fading' ? 1 : 0,
                transition: `opacity ${WELCOME_FADE_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`,
              }}
            >
              {children}
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </TooltipProvider>
  );

  return (
    <>
      <AuthGuard redirectTo="/login">
        <XStateDevToolsProvider showStatus={true}>
          {/* AudioProvider only on audio routes (see audioRoute above). */}
          {audioRoute ? <AudioProvider>{inner}</AudioProvider> : inner}
          {/* (Welcome overlay moved INSIDE <main> above — scoped to the content pane so the
              sidebar shell stays visible while the workspace boots.) */}
          {/* Route-aware background warm-up: after first paint, on routes that
              can reach audio (gym/college/tutorials), warms the engine into the
              WindowRegistry singleton so it's ready when the user acts. No-op on
              audio-free routes. Sibling — never blocks paint. */}
          <AppAudioWarmup />
          {/* Login-time prefetch of the member's gym session (enrollment +
              today's rep) into the query cache, so /app/gym opens from warm data
              instead of running its fetch chain on open. No-op for non-members. */}
          <AppGymWarmup />
          {/* Debug panels: only RENDER them where active, so their chunks (and
              the prefetch links) never land on prod pages. */}
          {debugAudio && <AudioDebugPanel />}
          <HealthStatus />
          {isDev && (
            <XStateDebugPanel position="bottom-left" keyboardShortcut="alt+x" />
          )}
        </XStateDevToolsProvider>
      </AuthGuard>
    </>
  );
}
