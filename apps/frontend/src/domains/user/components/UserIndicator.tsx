'use client';

import React from 'react';
import { User, Crown, LogIn } from 'lucide-react';
import { useAuth } from '../hooks/use-auth';
import { useUserProfile } from '../hooks/use-user-profile';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

export function UserIndicator() {
  const { isAuthenticated, user } = useAuth();
  const { profile, isLoading, cachedRole, cachedDisplayName, isHydrated } = useUserProfile();
  const { navigateWithTransition } = useViewTransitionRouter();

  // We need BOTH cached role AND a display name source to show immediately
  // Otherwise we'd show "User" placeholder which looks bad
  const hasDisplayNameSource = cachedDisplayName || profile?.displayName || user?.email;
  const canShowImmediately = !!cachedRole && !!hasDisplayNameSource;

  const handleClick = () => {
    if (isAuthenticated || cachedRole) {
      navigateWithTransition('/dashboard');
    } else {
      navigateWithTransition('/login');
    }
  };

  // IMPORTANT: Before hydration OR while waiting for display name, show placeholder
  // This prevents hydration mismatch AND the "User" → real name flash
  if (!isHydrated || (cachedRole && !hasDisplayNameSource)) {
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
  const displayName = profile?.displayName || user.email?.split('@')[0] || 'User';

  return (
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
  );
}
