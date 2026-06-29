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
import { useTakeReplayer } from './useTakeReplayer';

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
          <TakePlayer take={take} title={title} />
        ) : (
          <p className="font-mono text-[10px] uppercase tracking-[1px] text-[#5A5660]">
            (audio unavailable)
          </p>
        )}
      </div>
    </div>
  );
}

/** The take's player. When the take has a backing recipe (backingLayers), play it IN CONTEXT —
 *  the bass clip + the click/drone/drums it was recorded over (useTakeReplayer). Otherwise fall
 *  back to a bare <audio> for the clip alone. */
function TakePlayer({
  take,
  title,
}: {
  take: TakeResultWithSignedUrl;
  title: string;
}) {
  const backing = take.playbackContext?.backingLayers ?? null;
  const preRollSec = take.playbackContext?.preRollSec ?? null;
  const inContext = !!backing && backing.length > 0;
  const { status, play, stop } = useTakeReplayer(
    take.audioUrl,
    backing,
    preRollSec,
  );

  if (!inContext) {
    // No backing recipe — bare clip playback (older takes, or a take recorded dry).
    return (
      <audio
        controls
        preload="none"
        src={take.audioUrl ?? undefined}
        aria-label={`Playback of ${title}`}
        className="h-9 w-full"
      />
    );
  }

  const playing = status === 'playing';
  const loading = status === 'loading';

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => (playing ? stop() : void play())}
        disabled={loading}
        aria-label={playing ? 'Stop' : 'Play in context'}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#E8A44A] text-black transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {playing ? <StopGlyph /> : <PlayGlyph />}
      </button>
      <div className="min-w-0">
        <div className="font-mono text-[10px] uppercase tracking-[1px] text-[#8A8690]">
          {loading ? 'Loading…' : playing ? 'Playing in context' : 'Play in context'}
        </div>
        <div className="text-[10px] text-[#5A5660]">
          your take + the backing it was recorded over
        </div>
      </div>
    </div>
  );
}

function PlayGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}
function StopGlyph() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <rect x="6" y="6" width="12" height="12" rx="1.5" />
    </svg>
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
