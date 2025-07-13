'use client';

import React from 'react';
import { User, Crown, LogIn } from 'lucide-react';
import { useAuth } from '../hooks/use-auth';
import { useUserProfile } from '../hooks/use-user-profile';

export function UserIndicator() {
  const { isAuthenticated, user } = useAuth();
  const { profile, isLoading } = useUserProfile();

  // Debug: Log profile data
  console.log('UserIndicator - Profile data:', {
    profile,
    isAuthenticated,
    user,
  });

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <LogIn className="w-4 h-4 text-slate-400" />
        <span className="text-sm text-slate-400">Not logged in</span>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
        <div className="w-4 h-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
        <span className="text-sm text-slate-400">Loading...</span>
      </div>
    );
  }

  const isAdmin = profile?.role === 'admin';
  const displayName =
    profile?.displayName || user.email?.split('@')[0] || 'User';

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
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
