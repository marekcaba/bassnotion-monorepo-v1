'use client';

/**
 * GymGoalSettings — "Your Bass Gym goal" section for /app/settings.
 *
 * Shows the member's current active goal and lets them CHANGE it mid-cycle
 * (founder: goal management lives in the user dashboard, not the gym). Switching
 * is gated server-side to once per billing period — a 2nd switch returns a 400
 * which we surface inline. Reuses the same switchGoal endpoint the gym used.
 */

import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';

import {
  fetchMyEnrollments,
  fetchEnrollableGoals,
  switchGoal,
} from '@/domains/training-engine/api/training-engine.api';
import { useAuth } from '@/domains/user/hooks/use-auth';

export function GymGoalSettings() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: enrollments, isLoading: enrollLoading } = useQuery({
    queryKey: ['gym', 'my-enrollments'],
    queryFn: fetchMyEnrollments,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const { data: goals } = useQuery({
    queryKey: ['gym', 'enrollable-goals'],
    queryFn: fetchEnrollableGoals,
    enabled: isAuthenticated && picking,
    staleTime: 60_000,
  });

  const active = enrollments?.find((e) => e.status === 'active') ?? null;

  const switchMutation = useMutation({
    mutationFn: (slug: string) => switchGoal(slug),
    onSuccess: () => {
      setPicking(false);
      setError(null);
      qc.invalidateQueries({ queryKey: ['gym'] });
    },
    onError: (e: unknown) => {
      setError(e instanceof Error ? e.message : 'Could not switch goal');
    },
  });

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Your Bass Gym goal</h2>
        <p className="mt-1 text-sm text-zinc-400">
          The goal your daily rep is built around. You can change it once per
          membership period.
        </p>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      {enrollLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : !active ? (
        <p className="text-sm text-zinc-500">
          No active goal yet — open the Gym to set one up.
        </p>
      ) : (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
          <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            Current goal
          </div>
          <div className="mt-1 text-base text-zinc-100">
            Active — set up in the Gym
          </div>
        </div>
      )}

      {!picking ? (
        active && (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setPicking(true);
            }}
            className="rounded-md border border-zinc-700 px-3 py-2 text-sm text-zinc-200 transition-colors hover:border-amber-600/60 hover:text-white"
          >
            Change goal
          </button>
        )
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">
            Pick a new goal — your current one closes and the new one runs for
            the rest of this period.
          </p>
          {(goals ?? []).length === 0 ? (
            <p className="text-sm text-zinc-500">No other goals available.</p>
          ) : (
            <div className="space-y-2">
              {(goals ?? []).map((g) => (
                <button
                  key={g.slug}
                  type="button"
                  disabled={switchMutation.isPending}
                  onClick={() => switchMutation.mutate(g.slug)}
                  className="block w-full rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 text-left transition-colors hover:border-amber-600/60 disabled:opacity-50"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-zinc-100">{g.title}</span>
                    <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-zinc-500">
                      {g.topicCount > 0
                        ? `${g.topicCount} topics · ${g.totalQuota} reps`
                        : g.targetTempoBpm
                          ? `${g.targetTempoBpm} BPM`
                          : g.type}
                    </span>
                  </div>
                  {g.description && (
                    <p className="mt-1 text-xs text-zinc-400">
                      {g.description}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => setPicking(false)}
            className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
