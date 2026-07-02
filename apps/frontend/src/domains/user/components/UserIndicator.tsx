'use client';

import React, { useCallback, useState } from 'react';
import { User, Crown, LogIn, LogOut } from 'lucide-react';
import { useAuth, useAuthStore } from '../hooks/use-auth';
import { useUserProfile } from '../hooks/use-user-profile';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { navigateToApp } from '@/lib/marketing-url';
import { authService } from '../api/auth';

export function UserIndicator() {
  const { isAuthenticated, user, isInitialized } = useAuth();
  const reset = useAuthStore((state) => state.reset);
  const { profile, isLoading, cachedRole, cachedDisplayName, isHydrated } =
    useUserProfile();
  const { navigateWithTransition } = useViewTransitionRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  // We need BOTH cached role AND a display name source to show immediately
  // Otherwise we'd show "User" placeholder which looks bad
  const hasDisplayNameSource =
    cachedDisplayName || profile?.displayName || user?.email;
  const canShowImmediately = !!cachedRole && !!hasDisplayNameSource;

  const handleClick = () => {
    if (isAuthenticated || cachedRole) {
      // Home for a signed-in user is Backstage (the app). This component also renders on APEX pages
      // (e.g. /pricing), so use navigateToApp — it full-page-navigates to the app host when we're
      // cross-origin, and does a normal client transition when already on the app host. (The legacy
      // /dashboard this used to point at was removed in the apex→app migration.)
      navigateToApp('/backstage', navigateWithTransition);
    } else {
      navigateWithTransition('/login');
    }
  };

  const handleSignOut = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent triggering the parent click handler
      try {
        setIsSigningOut(true);
        // Navigate to /login FIRST, before clearing auth state. This unmounts
        // AuthGuard before isAuthenticated flips false, so it never fires its
        // own competing redirect or flashes its fallback. /login also matches
        // AuthGuard's safety-net redirect target, so the two can't disagree.
        // Then clear the session — AuthProvider's onAuthStateChange listener
        // also calls reset() on the SIGNED_OUT event, but by then we're
        // already on a public route.
        await navigateWithTransition('/login');
        await authService.signOut();
        reset();
      } catch (error) {
        console.error('Sign out error:', error);
      } finally {
        setIsSigningOut(false);
      }
    },
    [reset, navigateWithTransition],
  );

  // IMPORTANT: Before hydration OR while auth is still initializing, show placeholder
  // This prevents hydration mismatch AND flash of wrong content
  // Also wait for auth to be initialized before showing "Not logged in"
  if (!isHydrated || (!isInitialized && !cachedRole)) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="w-4 h-4" />
        <span className="text-sm text-transparent">Loading...</span>
      </div>
    );
  }

  // If we have cached role but waiting for display name, show loading
  if (cachedRole && !hasDisplayNameSource) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="w-4 h-4" />
        <span className="text-sm text-transparent">Loading...</span>
      </div>
    );
  }

  // After hydration: If we can show immediately (have role + display name), do it
  if (canShowImmediately) {
    const isAdmin = profile?.role === 'admin' || cachedRole === 'admin';
    const displayName =
      profile?.displayName || cachedDisplayName || user?.email?.split('@')[0];

    return (
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50 cursor-pointer hover:bg-slate-800/70 transition-colors"
          onClick={handleClick}
          title="Go to Dashboard"
        >
          {isAdmin ? (
            <Crown className="w-4 h-4 text-yellow-400" />
          ) : (
            <User className="w-4 h-4 text-blue-400" />
          )}
          <span className="text-sm text-white">{displayName}</span>
          <span
            className={`px-2 py-1 text-xs font-medium rounded ${
              isAdmin
                ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
            }`}
          >
            {isAdmin ? 'Admin' : 'User'}
          </span>
        </div>
        <button
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="flex items-center justify-center p-2 bg-slate-800/50 rounded-lg border border-slate-700/50 cursor-pointer hover:bg-red-500/20 hover:border-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Sign out"
        >
          <LogOut className="w-4 h-4 text-slate-400 hover:text-red-400" />
        </button>
      </div>
    );
  }

  // No cached role - check auth state
  if (!isAuthenticated || !user) {
    return (
      <div
        className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50 cursor-pointer hover:bg-slate-800/70 transition-colors"
        onClick={handleClick}
        title="Click to login"
      >
        <LogIn className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-400">Not logged in</span>
      </div>
    );
  }

  // Authenticated but still loading profile (no cache)
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="w-4 h-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        <span className="text-sm text-slate-400">Loading...</span>
      </div>
    );
  }

  // Fresh profile data loaded
  const isAdmin = profile?.role === 'admin';
  const displayName =
    profile?.displayName || user.email?.split('@')[0] || 'User';

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50 cursor-pointer hover:bg-slate-800/70 transition-colors"
        onClick={handleClick}
        title="Go to Dashboard"
      >
        {isAdmin ? (
          <Crown className="w-4 h-4 text-yellow-400" />
        ) : (
          <User className="w-4 h-4 text-blue-400" />
        )}
        <span className="text-sm text-white">{displayName}</span>
        <span
          className={`px-2 py-1 text-xs font-medium rounded ${
            isAdmin
              ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
              : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
          }`}
        >
          {isAdmin ? 'Admin' : 'User'}
        </span>
      </div>
      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="flex items-center justify-center p-2 bg-slate-800/50 rounded-lg border border-slate-700/50 cursor-pointer hover:bg-red-500/20 hover:border-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Sign out"
      >
        <LogOut className="w-4 h-4 text-slate-400 hover:text-red-400" />
      </button>
    </div>
  );
}
