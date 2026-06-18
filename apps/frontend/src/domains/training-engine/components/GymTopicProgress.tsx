'use client';

/**
 * GymTopicProgress — the content-ladder PATH (epic §3 Build B): the ~3-4 TOPIC
 * quota meters the student fills toward the goal. One row per topic; the goal is
 * done when every row is full. Internal "stages" are NEVER surfaced — the student
 * only sees the quota fill (founder decision §4: show present state, not a future
 * timeline).
 *
 * This is the "climb" view. It used to live inline in the gym; it moved to the
 * user dashboard (/app/settings → GymClimbCard), so it's a shared component now.
 *
 * Viz: a horizontal row of DOTS per topic — one bold dot per rep, filled
 * left→right (filled = the topic's skill color, empty = dark disc), with a
 * colored tag pill + an NN/NN count. No card chrome of its own.
 */

import type { TopicProgress } from '@bassnotion/contracts';

/**
 * Per-position skill colors — the SAME palette as the /app SessionCard tags
 * (NodeMatrix LEVEL_COLORS). Each topic is colored by its POSITION so the 3–4
 * topics are always visually distinct (like the home tags), not all sharing a
 * stage-1 color.
 */
const LEVEL_COLORS: Record<number, { base: string; glow: string }> = {
  1: { base: '#E8A44A', glow: 'rgba(232,164,74,0.25)' }, // orange
  2: { base: '#5B8DEF', glow: 'rgba(91,141,239,0.25)' }, // blue
  3: { base: '#6BCF8E', glow: 'rgba(107,207,142,0.25)' }, // green
  4: { base: '#C77DFF', glow: 'rgba(199,125,255,0.25)' }, // purple
  5: { base: '#FF7EB3', glow: 'rgba(255,126,179,0.25)' }, // pink
};
export function colorForLevel(level: number): { base: string; glow: string } {
  const clamped = Math.min(Math.max(1, level), 5);
  // LEVEL_COLORS is dense 1..5, so this is always defined; the fallback satisfies
  // noUncheckedIndexedAccess (and guards a non-integer level defensively).
  return LEVEL_COLORS[clamped] ?? LEVEL_COLORS[1]!;
}

/** A single topic's quota as a row of dots — one per rep, filling left→right.
 *  Filled = solid color; empty = dark disc. Flex row with a capped dot size so a
 *  quota of 4 shows fat dots and 12 shows smaller ones, both on one line.
 *  Staggered fill, left to right. */
function QuotaMeter({
  logged,
  quota,
  color,
}: {
  logged: number;
  quota: number;
  /** The topic's skill color (filled dots + glow). */
  color: { base: string; glow: string };
}) {
  const filled = Math.min(logged, quota);
  const n = Math.max(1, quota);
  return (
    <div
      className="flex w-full items-center gap-[clamp(3px,1.5%,7px)]"
      aria-hidden
    >
      {Array.from({ length: n }).map((_, i) => {
        const isOn = i < filled;
        return (
          <span
            key={i}
            className="aspect-square min-w-0 flex-1 rounded-full transition-all duration-500"
            style={{
              transitionDelay: `${i * 45}ms`,
              maxWidth: 16,
              background: isOn ? color.base : 'rgba(255,255,255,0.06)',
              boxShadow: isOn ? `0 0 6px ${color.glow}` : 'none',
            }}
          />
        );
      })}
    </div>
  );
}

/** The path — a clean list of per-topic quota meters with a colored tag pill,
 *  topic title, and an NN/NN mono count. No card chrome of its own. */
export function GymTopicProgress({ topics }: { topics: TopicProgress[] }) {
  const done = topics.filter((t) => t.isComplete).length;
  const allDone = done === topics.length && topics.length > 0;

  return (
    <div className="px-[22px] pb-[22px] pt-[18px]">
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-[#5A5660]">
          {allDone ? 'Goal — complete' : 'Your path'}
        </p>
        <p className="font-mono text-[10px] tabular-nums tracking-[1px] text-[#5A5660]">
          <span className={allDone ? 'text-[#E8A44A]' : 'text-[#8A8690]'}>
            {done}
          </span>
          <span> / {topics.length} topics</span>
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {topics.map((t, i) => {
          const shown = Math.min(t.repsLogged, t.repQuota);
          const c = colorForLevel(i + 1);
          return (
            <div key={t.topicId} className="flex flex-col gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    className="shrink-0 rounded-full border px-2 py-[2px] font-mono text-[9px] uppercase tracking-[0.5px]"
                    style={{
                      color: c.base,
                      borderColor: c.glow,
                      background: `${c.base}14`,
                    }}
                    title={t.title}
                  >
                    {t.title}
                  </span>
                  {t.isComplete && (
                    <svg
                      viewBox="0 0 24 24"
                      className="size-3 shrink-0 fill-none stroke-[3]"
                      style={{ stroke: c.base }}
                      aria-hidden
                    >
                      <polyline points="4,12 10,18 20,6" />
                    </svg>
                  )}
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums">
                  {/* single-digit-min (3/10), not 00/10 */}
                  <span style={{ color: t.isComplete ? c.base : '#E8E4DD' }}>
                    {shown}
                  </span>
                  <span className="text-[#5A5660]">/{t.repQuota}</span>
                </span>
              </div>
              <QuotaMeter logged={t.repsLogged} quota={t.repQuota} color={c} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
