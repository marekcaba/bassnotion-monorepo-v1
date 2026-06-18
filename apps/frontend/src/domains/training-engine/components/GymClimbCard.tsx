'use client';

/**
 * GymClimbCard — "Your climb" for /app/settings (the user dashboard). The climb
 * (reps banked, days shown up, topics done, + the per-topic path) used to live
 * inline in the gym; it moved here so the gym front door stays only the rep
 * (founder direction). Goal management already lives next to it (GymGoalSettings).
 *
 * READ-ONLY — no minting. It derives the topic progress CLIENT-SIDE from the
 * enrollment's frozen topics (goalSnapshot.topics) + the append-only rep history
 * (deriveTopicProgress is pure), and reads attendance off the graduation summary
 * (a read-time, no-mutation GET). So opening the dashboard never plans a rep.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { deriveTopicProgress } from '@bassnotion/contracts';

import {
  fetchMyEnrollments,
  fetchRepHistory,
  fetchGraduation,
} from '@/domains/training-engine/api/training-engine.api';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { GymTopicProgress } from './GymTopicProgress';

export function GymClimbCard() {
  const { isAuthenticated } = useAuth();

  const { data: enrollments, isLoading: enrollLoading } = useQuery({
    queryKey: ['gym', 'my-enrollments'],
    queryFn: fetchMyEnrollments,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const active = enrollments?.find((e) => e.status === 'active') ?? null;

  // The append-only rep history → quota tallies (pure client derivation).
  const { data: history } = useQuery({
    queryKey: ['gym', 'rep-history', active?.id],
    queryFn: () => fetchRepHistory(active!.id),
    enabled: isAuthenticated && !!active,
    staleTime: 60_000,
  });

  // Attendance ("showed up X of N days") rides the read-time graduation summary.
  const { data: graduation } = useQuery({
    queryKey: ['gym', 'graduation', active?.id],
    queryFn: () => fetchGraduation(active!.id),
    enabled: isAuthenticated && !!active,
    staleTime: 60_000,
  });

  const topicProgress = useMemo(() => {
    const topics = active?.goalSnapshot?.topics;
    if (!topics || topics.length === 0) return null;
    return deriveTopicProgress(topics, history ?? []);
  }, [active, history]);

  const repsBanked =
    topicProgress?.reduce((n, t) => n + Math.min(t.repsLogged, t.repQuota), 0) ??
    0;
  const repsTotal = topicProgress?.reduce((n, t) => n + t.repQuota, 0) ?? 0;
  const topicsDone = topicProgress?.filter((t) => t.isComplete).length ?? 0;
  const topicsTotal = topicProgress?.length ?? 0;
  const attendance =
    typeof graduation?.daysPracticedInWindow === 'number' &&
    typeof graduation?.windowDays === 'number'
      ? {
          daysPracticed: graduation.daysPracticedInWindow,
          windowDays: graduation.windowDays,
        }
      : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Your climb</h2>
        <p className="mt-1 text-sm text-zinc-400">
          How this month is stacking up — reps banked, days you showed up, and
          your progress across each topic.
        </p>
      </div>

      {enrollLoading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : !active ? (
        <p className="text-sm text-zinc-500">
          No active goal yet — open the Gym to set one up.
        </p>
      ) : (
        <>
          {/* Stat rail */}
          <div className="grid grid-cols-3 gap-2.5">
            {repsTotal > 0 && (
              <div className="col-span-3 rounded-lg border border-[#E8A44A]/20 bg-[#E8A44A]/[0.04] px-3 py-3.5 text-center sm:col-span-1">
                <div className="font-mono text-2xl font-light leading-none tabular-nums text-[#E8A44A]">
                  {repsBanked}
                  <span className="text-base text-[#5A5660]">/{repsTotal}</span>
                </div>
                <div className="mt-1 font-mono text-[9px] uppercase tracking-[1px] text-[#8A8690]">
                  Reps banked
                </div>
              </div>
            )}
            {attendance && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-3 text-center">
                <div className="font-mono text-lg font-medium tabular-nums text-[#E8E4DD]">
                  {attendance.daysPracticed}
                  <span className="text-[#5A5660]">
                    /{attendance.windowDays}
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[1px] text-[#5A5660]">
                  Days shown up
                </div>
              </div>
            )}
            {topicsTotal > 0 && (
              <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-3 text-center">
                <div className="font-mono text-lg font-medium tabular-nums">
                  <span
                    className={
                      topicsDone === topicsTotal
                        ? 'text-[#E8A44A]'
                        : 'text-[#E8E4DD]'
                    }
                  >
                    {topicsDone}
                  </span>
                  <span className="text-[#5A5660]">/{topicsTotal}</span>
                </div>
                <div className="mt-0.5 font-mono text-[9px] uppercase tracking-[1px] text-[#5A5660]">
                  Topics done
                </div>
              </div>
            )}
          </div>

          {/* The per-topic path */}
          {topicProgress && topicProgress.length > 0 ? (
            <div className="relative overflow-hidden rounded-[14px] border border-white/[0.06] bg-[#141318]">
              <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-[#E8A44A] to-transparent opacity-40" />
              <GymTopicProgress topics={topicProgress} />
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              Your goal’s progress will show here once you’ve banked a rep.
            </p>
          )}
        </>
      )}
    </div>
  );
}
