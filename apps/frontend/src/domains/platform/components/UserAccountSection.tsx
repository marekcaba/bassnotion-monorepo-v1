'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useInternalPathname } from '@/lib/hooks/use-internal-pathname';
import { ChevronsUpDown, Edit2, LogOut } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/shared/components/ui/dropdown-menu';
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
} from '@/shared/components/ui/avatar';
import { Skeleton } from '@/shared/components/ui/skeleton';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useAuthStore } from '@/domains/user/hooks/use-auth';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { authService } from '@/domains/user/api/auth';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

/** Extract up to two initials from a display name */
function getInitials(name: string | undefined | null): string {
  if (!name) return '?';
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join('');
}

interface UserAccountSectionProps {
  expanded?: boolean;
}

export function UserAccountSection({
  expanded: _expanded = false,
}: UserAccountSectionProps) {
  const { user } = useAuth();
  const { profile, isLoading } = useUserProfile();
  const resetAuth = useAuthStore((state) => state.reset);

  // HYDRATION GUARD. `isLoading` differs between SSR and the first client render: on the
  // server the profile query is DISABLED (auth is client-only) so isLoading is false → the
  // server renders the full DropdownMenu (which calls Radix's useId). On the client, once
  // auth hydrates the query ENABLES and isLoading flips true → it would render the Skeleton
  // (no useId). That branch swap offsets React's useId counter, so every Radix id downstream
  // mismatches at hydration. Gating the skeleton on `mounted` keeps the SSR + first-client
  // render identical (always the menu); the loading skeleton only appears AFTER hydration,
  // as a normal client state change.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { navigateWithTransition } = useViewTransitionRouter();
  // Internal path so the /^\/app\/tutorials\// admin-gate regex matches on the
  // app subdomain (clean URL) too.
  const pathname = useInternalPathname();

  const displayName =
    profile?.displayName ?? user?.email?.split('@')[0] ?? 'User';
  const avatarUrl = profile?.avatarUrl ?? undefined;
  const initials = getInitials(displayName);
  const isAdmin = profile?.role === 'admin';

  // Extract tutorial slug when on a tutorial page
  const tutorialSlug = useMemo(() => {
    const match = pathname.match(/^\/app\/tutorials\/([^/]+)/);
    return match?.[1] ?? null;
  }, [pathname]);

  const handleEditTutorial = useCallback(() => {
    if (tutorialSlug) {
      sessionStorage.removeItem('previewingFromEdit');
      navigateWithTransition(`/admin/tutorials/${tutorialSlug}/edit`);
    }
  }, [tutorialSlug, navigateWithTransition]);

  const handleSignOut = useCallback(async () => {
    // Navigate to /login FIRST, before clearing auth state. This unmounts
    // AuthGuard before isAuthenticated flips false, so it never fires its
    // own competing redirect or flashes its fallback. /login matches
    // AuthGuard's safety-net redirect target so the two can't disagree.
    // AuthProvider's onAuthStateChange listener also calls resetAuth() on
    // the SIGNED_OUT event — by then we're already on a public route.
    await navigateWithTransition('/login');
    await authService.signOut();
    resetAuth();
  }, [resetAuth, navigateWithTransition]);

  // Only show the loading skeleton AFTER hydration (see the `mounted` guard above) — never on
  // the server or the first client render, so the hydrated tree shape matches.
  if (mounted && isLoading) {
    return (
      <div className="flex items-center gap-3 px-2">
        <div className="flex items-center justify-center p-2">
          <Skeleton className="size-5 shrink-0 rounded-full" />
        </div>
        <Skeleton className="h-4 w-24 rounded bg-white/[0.06]" />
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full items-center rounded-[7px] px-2 py-1 gap-3 hover:bg-white/[0.04] transition-colors whitespace-nowrap"
          aria-label="User menu"
        >
          <div className="flex items-center justify-center p-2">
            <Avatar className="size-5 shrink-0">
              {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
              <AvatarFallback className="bg-[#E8A44A]/15 text-[#E8A44A] text-[8px] font-semibold">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <span className="flex-1 truncate text-left text-sm text-[#8A8690]">
            {displayName}
          </span>
          {/* The admin entry moved to a dedicated sidebar nav item (the Shield "Admin" row in
              BOTTOM_NAV_ITEMS, admin-gated) when /admin moved into the app shell — the old amber chip
              here was removed to avoid a duplicate entry. isAdmin still gates "Edit Tutorial" below. */}
          <ChevronsUpDown className="size-4 shrink-0 text-[#5A5660]" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        side="right"
        align="end"
        sideOffset={8}
        className="w-56 bg-[#141318] border-white/[0.06]"
      >
        <DropdownMenuLabel className="font-mono text-[10px] uppercase tracking-[1px] text-[#5A5660]">
          {displayName}
        </DropdownMenuLabel>
        {isAdmin && tutorialSlug && (
          <>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem
              onClick={handleEditTutorial}
              className="cursor-pointer text-[#5B8DEF] focus:text-[#5B8DEF] focus:bg-white/[0.04]"
            >
              <Edit2 className="mr-2 size-4" />
              Edit Tutorial
            </DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator className="bg-white/[0.06]" />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-red-400/80 focus:text-red-400 focus:bg-white/[0.04]"
        >
          <LogOut className="mr-2 size-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
