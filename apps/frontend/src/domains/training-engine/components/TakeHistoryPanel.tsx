'use client';

/**
 * TakeHistoryPanel — "Your recordings": the user's submitted, graded takes
 * (admin-assigned deliverables), newest-first, with in-place audio playback.
 *
 * READ-ONLY. It only reads useTakeHistory() (a signed-URL-bearing GET) — opening
 * the panel never mutates anything. Visual language matches the gym dashboard
 * cards (GymClimbCard / GymTopicProgress): dark #141318 cards, mono micro-labels,
 * the #E8A44A accent, and a soft top hairline.
 */

import type { TakeResultWithSignedUrl } from '@bassnotion/contracts';

import { useTakeHistory } from '../hooks/useTakeHistory';

/** A 0-100 grade → its badge color. Green ≥80, amber ≥50, red below. */
function gradeColor(score: number): { fg: string; bg: string; border: string } {
  if (score >= 80) {
    return { fg: '#6BCF8E', bg: 'rgba(107,207,142,0.10)', border: 'rgba(107,207,142,0.25)' };
  }
  if (score >= 50) {
    return { fg: '#E8A44A', bg: 'rgba(232,164,74,0.10)', border: 'rgba(232,164,74,0.25)' };
  }
  return { fg: '#FF7E7E', bg: 'rgba(255,126,126,0.10)', border: 'rgba(255,126,126,0.25)' };
}

/** ISO timestamp → a short, friendly date like "Jun 29". Falls back to the raw
 *  string if it can't parse, so a bad value never throws in render. */
function formatTakeDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** A single 0-100 score as a small colored badge (e.g. "timing 84"). */
function ScoreBadge({ label, score }: { label: string; score: number }) {
  const c = gradeColor(score);
  return (
    <span
      className="rounded-full border px-2 py-[2px] font-mono text-[10px] tabular-nums tracking-[0.5px]"
      style={{ color: c.fg, background: c.bg, borderColor: c.border }}
    >
      <span className="uppercase opacity-70">{label}</span>{' '}
      <span className="font-medium">{score}</span>
    </span>
  );
}

/** One submitted take: title + date, score badges, key·tempo, and a player. */
function TakeCard({ take }: { take: TakeResultWithSignedUrl }) {
  const title = take.exerciseName ?? take.station;
  const keyTempo =
    take.scaleKey && take.tempoBpm
      ? `${take.scaleKey} · ${take.tempoBpm}bpm`
      : (take.scaleKey ?? (take.tempoBpm ? `${take.tempoBpm}bpm` : null));

  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-[#141318] p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="min-w-0 truncate text-sm font-medium text-[#E8E4DD]" title={title}>
          {title}
        </p>
        <time
          dateTime={take.submittedAt}
          className="shrink-0 font-mono text-[10px] uppercase tracking-[1px] text-[#5A5660]"
        >
          {formatTakeDate(take.submittedAt)}
        </time>
      </div>

      {(take.timingScore !== null || take.pitchScore !== null || keyTempo) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {take.timingScore !== null && (
            <ScoreBadge label="timing" score={take.timingScore} />
          )}
          {take.pitchScore !== null && (
            <ScoreBadge label="pitch" score={take.pitchScore} />
          )}
          {keyTempo && (
            <span className="font-mono text-[10px] tracking-[0.5px] text-[#8A8690]">
              {keyTempo}
            </span>
          )}
        </div>
      )}

      <div className="mt-3">
        {take.audioUrl ? (
          <audio
            controls
            preload="none"
            src={take.audioUrl}
            aria-label={`Playback of ${title}, submitted ${formatTakeDate(
              take.submittedAt,
            )}`}
            className="h-9 w-full"
          />
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[1px] text-[#5A5660]">
            (audio unavailable)
          </p>
        )}
      </div>
    </div>
  );
}

export function TakeHistoryPanel() {
  const { takes, isLoading, error } = useTakeHistory();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white">Your recordings</h2>
        <p className="mt-1 text-sm text-zinc-400">
          The takes you’ve submitted — graded, newest first, with playback.
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2.5" aria-hidden>
          {[0, 1].map((i) => (
            <div
              key={i}
              className="h-[120px] animate-pulse rounded-[14px] border border-white/[0.06] bg-[#141318]"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-zinc-500">{error}</p>
      ) : takes.length === 0 ? (
        <p className="text-sm text-zinc-500">
          No recordings submitted yet — your assignments will appear in the gym.
        </p>
      ) : (
        <div className="space-y-2.5">
          {takes.map((take) => (
            <TakeCard key={take.id} take={take} />
          ))}
        </div>
      )}
    </div>
  );
}
