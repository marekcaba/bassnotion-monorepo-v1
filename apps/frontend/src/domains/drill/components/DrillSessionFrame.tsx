'use client';

/**
 * DrillSessionFrame — wraps the tutorial player with the drill session frame:
 *
 *   plan (gate) → running (the player) → summary
 *
 * Only mounted for drill tutorials (see isDrillTutorial). It owns the phase
 * (useDrillSession) and reads the same progress cache the player writes to via
 * useCompleteBlock, so completion flows through automatically: when the last
 * brick is marked complete, the frame flips to the summary.
 *
 * The player itself is unchanged — it renders during the 'running' phase. The
 * plan/summary screens replace it (not overlay) so audio isn't running behind
 * a recap.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import type { Tutorial } from '@bassnotion/contracts';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { useProgress } from '@/domains/progress/hooks/useProgress';
import { getDrillBricks } from '@/domains/drill/utils/drillBricks';
import { useDrillSession } from '@/domains/drill/hooks/useDrillSession';
import { useRecordSession, useStreak } from '@/domains/drill/hooks/useStreak';
import { ensureAudioReady } from '@/domains/playback/services/ensureAudioReady';
import { DrillPlanScreen, type FrontDoor } from './DrillPlanScreen';
import {
  DrillSummaryScreen,
  type DrillSummaryItem,
} from './DrillSummaryScreen';

// The player (and the whole audio/playback graph it pulls) only renders in the
// 'running' phase. Dynamic-import it so the gym overlay, the gym-floor chooser,
// and the drill 'plan'/'summary' screens paint from a tiny chunk with no audio
// bundle. By the time the user presses Start, the background warm-up (or the
// ensureAudioReady() kick in useDrillSession.start) has the engine ready.
// The player chunk import — shared between the dynamic() component and the preload (so the
// "Are you ready?" step can warm THIS chunk, not just the audio engine + data).
const importPlayerChunk = () =>
  import('@/domains/widgets/components/YouTubeWidgetPage/YouTubeWidgetPage');

const YouTubeWidgetPage = dynamic(
  () => importPlayerChunk().then((m) => ({ default: m.YouTubeWidgetPage })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[50vh] items-center justify-center text-sm text-white/50">
        Loading rep…
      </div>
    ),
  },
);

/** Preload the player chunk (idempotent — webpack/Next dedupe the import). Called on the "Are you
 *  ready?" step (and the gym's ready placeholder) so the chunk is already downloaded when "Let's go"
 *  flips to the running phase — no "Loading rep…". Exported so the gym overlay can warm it early. */
export function preloadPlayerChunk() {
  void importPlayerChunk().catch(() => {
    /* best-effort warm — the dynamic() loader still handles a real load failure */
  });
}

interface DrillSessionFrameProps {
  tutorial: Tutorial;
  tutorialSlug: string;
  /** Exercise entities from useTutorialExercises — forwarded verbatim to the
   *  player (which types this as any[]). Drills rarely carry exercises, but a
   *  mixed tutorial might. */
  exercises: unknown[];
  /** Story 5: this is the short FLOOR session (one 3-min brick). Completing it
   *  records a FLOOR rep (showed up) — it advances the floor streak but NOT the
   *  ceiling (which is the full focused rep). Defaults to false (full rep). */
  isFloor?: boolean;
  /** Inline the plan screen (no full-height self-centering) so it flows in a
   *  parent column — the gym stacks its status/path strip above the drill. */
  inline?: boolean;
  /** Bare plan screen (no card chrome) so it nests inside a parent panel — the
   *  gym merges stats + path + drill into one console card. */
  bare?: boolean;
  /** Front-door plan screen (the gym): the centered "Six minutes." invitation
   *  with the giant CTA, no brick list. Only affects the 'plan' phase. */
  frontDoor?: FrontDoor;
  /** Skip the "Six minutes." front door and land DIRECTLY on the "Are you ready?" prep step —
   *  used when the player already committed elsewhere (the Backstage "Start today's rep" CTA). */
  autoStart?: boolean;
  /** Skip BOTH the front door AND the "Are you ready?" step — start the rep RUNNING immediately.
   *  Used on /gym/rep, where the front door + ready already happened on /gym before navigating. */
  autoRun?: boolean;
  /** Where the summary's "done" goes. Default '/' ; /gym/rep passes '/gym' (back to the floor). */
  onExitTo?: string;
  /** When true, DON'T show the summary here — the moment the rep completes, navigate to onExitTo.
   *  Used on /gym/rep so the recap appears back in the /gym OVERLAY (in place, over the gym), not
   *  as a terminal screen on the rep leaf. Standalone drill tutorials leave this off (summary
   *  shows in place — there's no gym overlay to bounce to). */
  redirectOnSummary?: boolean;
  /** Override "Let's go" on the ready step: instead of running the rep IN PLACE (start()), call
   *  this — the /gym overlay uses it to fade out + navigate to /gym/rep, where the rep runs on the
   *  leather. When unset, "Let's go" runs in place (the standalone drill-tutorial behavior). */
  onLetsGo?: () => void;
}

export function DrillSessionFrame({
  tutorial,
  tutorialSlug,
  exercises,
  isFloor = false,
  inline = false,
  bare = false,
  frontDoor,
  autoStart = false,
  autoRun = false,
  onExitTo = '/',
  redirectOnSummary = false,
  onLetsGo,
}: DrillSessionFrameProps) {
  const { profile } = useUserProfile();
  const { navigateWithTransition } = useViewTransitionRouter();
  const router = useRouter();

  // Same query key the player uses → shared cache. The player marks blocks
  // complete (useCompleteBlock updates this cache), so completedIds here update
  // reactively without a refetch.
  const { data: progress } = useProgress(tutorialSlug, {
    enabled: !!profile?.id,
  });

  const bricks = useMemo(() => getDrillBricks(tutorial), [tutorial]);
  const brickIds = useMemo(() => bricks.map((b) => b.id), [bricks]);

  const completedIds = useMemo(
    () =>
      new Set(
        (progress?.blocks ?? [])
          .filter((b) => b.completed)
          .map((b) => b.blockId),
      ),
    [progress],
  );

  const { phase, start, restart, complete } = useDrillSession({
    isDrill: true,
    brickIds,
    completedIds,
  });

  // "Are you ready?" prep step — sits BETWEEN the plan front door (or the backstage CTA) and the
  // running rep. The front-door Start advances to it (not straight to start()); "Let's go" then
  // calls start(). With autoStart (from backstage) we land on it directly, skipping the front door.
  const [showReady, setShowReady] = useState(false);
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStart && phase === 'plan' && !autoStartedRef.current) {
      autoStartedRef.current = true;
      setShowReady(true);
    }
    // Re-arm if we cycle back to a fresh plan (run-it-again).
    if (phase !== 'plan') setShowReady(false);
    if (phase === 'plan' && !autoStart) autoStartedRef.current = false;
  }, [autoStart, phase]);

  // autoRun (/gym/rep): the front door + "Are you ready?" already happened on /gym, so start the rep
  // RUNNING immediately on mount — no plan, no ready re-prompt. Once only (a "run it again" from the
  // summary still routes through the normal plan, since restart() sets phase back to 'plan').
  const autoRanRef = useRef(false);
  useEffect(() => {
    if (autoRun && phase === 'plan' && !autoRanRef.current) {
      autoRanRef.current = true;
      start();
    }
  }, [autoRun, phase, start]);

  // Bump the practice streak when the session is completed (phase → summary).
  // Fire once per visit (the ref guard); the server is idempotent per day, so a
  // duplicate would be harmless anyway. A "run it again" → plan → summary cycle
  // re-arms it, but the same-day server no-op keeps the count correct.
  const recordSession = useRecordSession();
  // The already-cached streak (the user's streak BEFORE this session). Used as
  // the summary's immediate fallback so the "🔥 N-day streak" line is present
  // the instant the summary renders, instead of popping in 1-3s later when the
  // record mutation's round-trip resolves. The mutation result (the post-record
  // value) replaces it as soon as it lands — same calendar day, so it differs by
  // at most the +1 this session earned.
  const cachedStreak = useStreak();
  const recordedRef = useRef(false);
  useEffect(() => {
    if (phase === 'summary' && !recordedRef.current) {
      recordedRef.current = true;
      // A FULL rep (all bricks) = a CEILING rep (advances floor + ceiling). A
      // FLOOR session (Story 5: the short 3-min version) advances the floor
      // streak only — "showed up", streak safe, but not the full-focus ceiling.
      recordSession.mutate(!isFloor);
    }
    if (phase === 'plan') {
      recordedRef.current = false; // re-arm for a fresh run
    }
  }, [phase, recordSession, isFloor]);

  // /gym/rep: the moment the rep completes, DON'T show the summary here — bounce to onExitTo so the
  // recap appears in the /gym overlay instead (in place, over the gym). One-shot per summary.
  // Use a PLAIN router.replace (not a view transition): a view transition keeps THIS page's
  // summary painted while /gym fades in, so both recaps flash at once. A plain replace swaps
  // without lingering the outgoing summary.
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (redirectOnSummary && phase === 'summary' && !redirectedRef.current) {
      redirectedRef.current = true;
      router.replace(onExitTo);
    }
    if (phase !== 'summary') redirectedRef.current = false;
  }, [redirectOnSummary, phase, onExitTo, router]);

  const summaryItems = useMemo<DrillSummaryItem[]>(() => {
    const dataById = new Map(
      (progress?.blocks ?? []).map((b) => [b.blockId, b.data ?? null]),
    );
    return bricks.map((brick) => ({
      brick,
      result: dataById.get(brick.id) ?? null,
    }));
  }, [bricks, progress]);

  if (phase === 'plan') {
    // The "Are you ready?" prep step (reached via the front-door Start, or directly via autoStart).
    // "Let's go" runs the rep IN PLACE (start) UNLESS onLetsGo overrides it — the /gym overlay passes
    // an override that fades out + navigates to /gym/rep, where the rep runs on the leather instead.
    if (showReady) {
      return <ReadyScreen onGo={onLetsGo ?? start} inline={inline} />;
    }
    return (
      <DrillPlanScreen
        title={tutorial.title}
        bricks={bricks}
        // Front-door Start → the prep step (not straight into the rep).
        onStart={() => setShowReady(true)}
        inline={inline}
        bare={bare}
        frontDoor={frontDoor}
      />
    );
  }

  // 'running' → the normal player. In the 'summary' phase, the STANDALONE case (drill tutorial)
  // lays the recap on top as a glass overlay in place. The /gym/rep case (redirectOnSummary) never
  // renders the summary here — the effect above bounces to /gym, where the recap shows in the gym
  // overlay. Either way the player stays MOUNTED (playback already stopped).
  return (
    <>
      <YouTubeWidgetPage
        tutorialData={tutorial}
        tutorialSlug={tutorialSlug}
        exercises={exercises}
        hideChrome
        // The last brick's "Complete the rep" click flips to the summary (works on replay too —
        // bypasses the auto-flip's completedThisAttempt guard).
        onRepComplete={complete}
      />
      {phase === 'summary' && !redirectOnSummary && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-10 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
        >
          <DrillSummaryScreen
            title={tutorial.title}
            items={summaryItems}
            onRestart={restart}
            onDone={() => navigateWithTransition(onExitTo)}
            // Post-record value once the mutation lands; until then the cached
            // pre-session streak so the line never pops in from nothing.
            streak={recordSession.data ?? cachedStreak.data ?? null}
          />
        </div>
      )}
    </>
  );
}

/**
 * ReadyScreen — the "Are you ready?" prep beat between the front door (or the Backstage CTA) and the
 * rep itself. A calm moment to get set; "Let's go" starts the rep. Mirrors the gym front-door
 * aesthetic (eyebrow / serif headline / coach line / big amber CTA).
 */
function ReadyScreen({
  onGo,
  inline,
}: {
  onGo: () => void;
  inline?: boolean;
}) {
  // While the student reads "take a breath", warm BOTH heavy things so "Let's go" has zero wait:
  //   1. the audio engine (ensureAudioReady — idempotent/deduped; start() reuses it),
  //   2. the PLAYER CHUNK (preloadPlayerChunk — the YouTubeWidgetPage bundle that otherwise shows
  //      "Loading rep…" while it downloads on the phase flip to running).
  useEffect(() => {
    void ensureAudioReady();
    preloadPlayerChunk();
  }, []);

  return (
    <div
      className={
        inline
          ? 'flex w-full flex-col items-center text-center'
          : 'flex min-h-[70vh] w-full flex-col items-center justify-center text-center'
      }
    >
      <p className="mb-4 font-mono text-[11px] uppercase tracking-[3px] text-[#7d786d]">
        Six minutes · one rep
      </p>
      <h1 className="mb-5 font-serif text-[clamp(38px,9vw,56px)] font-normal leading-none text-[#f5f2ea]">
        Are you ready?
      </h1>
      <p className="mb-11 max-w-[26rem] text-[16px] italic leading-relaxed text-[#9a9488]">
        Get your bass set, take a breath. When you press go, the count-in starts
        — give it your full focus.
      </p>
      <button
        type="button"
        onClick={onGo}
        className="flex w-full max-w-[26rem] items-center justify-center gap-3 rounded-[14px] bg-gradient-to-br from-[#E8A44A] to-[#D4903A] px-6 py-6 text-[20px] font-semibold text-[#3a2606] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(232,164,74,0.35)]"
      >
        Let&apos;s go
      </button>
    </div>
  );
}
