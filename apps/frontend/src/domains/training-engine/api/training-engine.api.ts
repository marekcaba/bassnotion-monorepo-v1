/**
 * Frontend API client for the backend training-engine endpoints.
 *
 * Uses the shared `apiClient` singleton (auth token attached automatically).
 * All endpoints are AuthGuard-protected on the backend → calls before login 401.
 */

import type {
  RepResult,
  RepResultInput,
  GoalEnrollment,
  TutorialBlock,
  GraduationSummary,
  GraduationDoor,
  MonthInReview,
  TopicProgress,
  EnrollableGoal,
  GymExercise,
  Gig,
  CreateGigInput,
  UpdateGigInput,
  PlaybackContext,
  TakeResult,
  TakeResultWithSignedUrl,
} from '@bassnotion/contracts';
import { apiClient } from '@/lib/api-client';
import { supabase } from '@/infrastructure/supabase/client';

/**
 * Attach the current Supabase session token to the shared apiClient before an
 * authed call. Mirrors useStreak/use-user-profile: these endpoints are
 * AuthGuard-protected, and the gym hooks can fire before AuthProvider has set
 * the token on mount — so we set it here per-call rather than rely on ordering.
 * Throws if there is no session (caller gates on isAuthenticated upstream).
 */
async function ensureAuthToken(): Promise<void> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('User not authenticated');
  }
  apiClient.setAuthToken(session.access_token);
}

/**
 * A FRESH session access token. getSession() returns the CACHED session, which on a long-idle tab
 * can be EXPIRED — sending it gives a backend "Auth session missing!" 401 even though
 * autoRefreshToken is on (the background refresh hasn't run yet). So: if the cached token is expired
 * or within 60s of it, force a refreshSession() first. Returns null if there's genuinely no session.
 */
async function freshAccessToken(): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  const session = data.session;
  if (!session?.access_token) return null;

  const nowSec = Math.floor(Date.now() / 1000);
  const expiresAt = session.expires_at ?? 0;
  if (expiresAt - nowSec > 60) return session.access_token; // still comfortably valid

  // Expired / about to expire → refresh. (The E2E mock client has no refreshSession; guard it.)
  const auth = supabase.auth as {
    refreshSession?: () => Promise<{
      data: { session: { access_token?: string } | null };
    }>;
  };
  if (typeof auth.refreshSession === 'function') {
    const refreshed = await auth.refreshSession();
    return refreshed.data.session?.access_token ?? session.access_token;
  }
  return session.access_token;
}

/**
 * RAW authed GET — token attached EXPLICITLY per-request, bypassing the shared apiClient. Use this
 * for reads that fire concurrently on a page mount (the calendar + take history + others all hit
 * the backstage at once): apiClient's mutable singleton Authorization header + its GET-dedupe race,
 * so a concurrent call can clobber the header or reuse a stale/tokenless request → an "Invalid
 * token" / "No token provided" 401. Attaching a FRESH token to THIS fetch sidesteps both + the
 * stale-cached-session expiry. */
async function authedGet<T>(path: string): Promise<T> {
  const token = await freshAccessToken();
  if (!token) throw new Error('User not authenticated');
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GET ${path} failed (${res.status}): ${body}`);
  }
  return (await res.json()) as T;
}

/** GET /api/v1/training-engine/enrollments — the caller's goal enrollments. Raw-fetch authed
 *  (concurrent backstage mount → singleton-token race; see authedGet). */
export async function fetchMyEnrollments(): Promise<GoalEnrollment[]> {
  return authedGet<GoalEnrollment[]>('/api/v1/training-engine/enrollments');
}

/** GET /api/v1/training-engine/goals — enrollable goals for the picker. */
export async function fetchEnrollableGoals(): Promise<EnrollableGoal[]> {
  await ensureAuthToken();
  return apiClient.get<EnrollableGoal[]>('/api/v1/training-engine/goals');
}

/**
 * GET /api/v1/training-engine/gym-exercises — the authored exercise LIBRARY a student
 * picks from in a gym tool (scales today). Read-only; optionally filter by equipment
 * (e.g. 'scales') and kind ('scale_path' | 'groove'). Returns ALL keys/variants — the
 * tool selects key/position/tempo at runtime.
 */
export async function fetchGymExercises(filters?: {
  equipment?: string;
  kind?: string;
}): Promise<GymExercise[]> {
  await ensureAuthToken();
  const qs = new URLSearchParams();
  if (filters?.equipment) qs.set('equipment', filters.equipment);
  if (filters?.kind) qs.set('kind', filters.kind);
  const suffix = qs.toString() ? `?${qs}` : '';
  const { exercises } = await apiClient.get<{ exercises: GymExercise[] }>(
    `/api/v1/training-engine/gym-exercises${suffix}`,
  );
  return exercises;
}

/**
 * POST /api/v1/training-engine/goals/:slug/enroll — idempotent enroll.
 * Optional `startTempoBpm` is the placement (where the climb starts); absent
 * falls back to the goal target server-side.
 */
export async function enrollInGoal(
  slug: string,
  startTempoBpm?: number,
): Promise<GoalEnrollment> {
  await ensureAuthToken();
  return apiClient.post<GoalEnrollment>(
    `/api/v1/training-engine/goals/${encodeURIComponent(slug)}/enroll`,
    typeof startTempoBpm === 'number' ? { startTempoBpm } : {},
  );
}

/**
 * POST /api/v1/training-engine/goals/:slug/switch — switch the active goal
 * mid-cycle (abandon current + enroll new, same billing period). The backend
 * 400s if the student already switched this period.
 */
export async function switchGoal(
  slug: string,
  startTempoBpm?: number,
): Promise<GoalEnrollment> {
  await ensureAuthToken();
  return apiClient.post<GoalEnrollment>(
    `/api/v1/training-engine/goals/${encodeURIComponent(slug)}/switch`,
    typeof startTempoBpm === 'number' ? { startTempoBpm } : {},
  );
}

/**
 * POST /api/v1/training-engine/enrollments/:id/today-rep — plan + mint today's
 * rep; returns the virtual-tutorial slug the gym renders through.
 */
export async function planTodayRep(
  enrollmentId: string,
  /** Story 5: 'floor' plans the short 3-min session; default 'full'. */
  mode: 'full' | 'floor' = 'full',
): Promise<{
  slug: string;
  bricks: TutorialBlock[];
  /** The goal's user-facing title (coach header names the goal). */
  goalTitle?: string | null;
  /** Content-ladder (Build B): per-topic quota bars for the gym path view.
   *  Present only on a multi-topic goal; absent for single-focal SPEED. */
  topicProgress?: TopicProgress[];
  /** True when today's rep is already done (UTC) — the gym shows the completed state. */
  doneTodayUtc?: boolean;
}> {
  await ensureAuthToken();
  return apiClient.post<{
    slug: string;
    bricks: TutorialBlock[];
    goalTitle?: string | null;
    topicProgress?: TopicProgress[];
    doneTodayUtc?: boolean;
  }>(
    `/api/v1/training-engine/enrollments/${encodeURIComponent(
      enrollmentId,
    )}/today-rep`,
    { mode },
  );
}

/** GET .../enrollments/:id/graduation — read-time day-30 summary (no mutation). */
export async function fetchGraduation(
  enrollmentId: string,
): Promise<GraduationSummary> {
  await ensureAuthToken();
  return apiClient.get<GraduationSummary>(
    `/api/v1/training-engine/enrollments/${encodeURIComponent(
      enrollmentId,
    )}/graduation`,
  );
}

/** GET .../enrollments/:id/month-in-review — the day-30 recap (Story 6). */
export async function fetchMonthInReview(
  enrollmentId: string,
): Promise<MonthInReview> {
  await ensureAuthToken();
  return apiClient.get<MonthInReview>(
    `/api/v1/training-engine/enrollments/${encodeURIComponent(
      enrollmentId,
    )}/month-in-review`,
  );
}

/** POST .../enrollments/:id/graduate — walk through one of the 3 doors. */
export async function graduate(
  enrollmentId: string,
  door: GraduationDoor,
): Promise<GoalEnrollment> {
  await ensureAuthToken();
  return apiClient.post<GoalEnrollment>(
    `/api/v1/training-engine/enrollments/${encodeURIComponent(
      enrollmentId,
    )}/graduate`,
    { door },
  );
}

/**
 * POST /api/v1/training-engine/rep-results
 *
 * The RepResultSink's client side — appends one rep to the engine's append-only
 * history. A SIBLING write to the drill executor's `completeBlock`: the two
 * serve different purposes (block_completions = the drill UI's unlock/summary
 * state; rep_results = the engine's own source of truth that generateRep reads).
 */
export async function appendRepResult(
  input: RepResultInput,
): Promise<RepResult> {
  await ensureAuthToken();
  return apiClient.post<RepResult>(
    '/api/v1/training-engine/rep-results',
    input,
  );
}

/** GET /api/v1/training-engine/enrollments/:enrollmentId/rep-results. Raw-fetch authed (concurrent
 *  backstage mount → singleton-token race; see authedGet). */
export async function fetchRepHistory(
  enrollmentId: string,
): Promise<RepResult[]> {
  return authedGet<RepResult[]>(
    `/api/v1/training-engine/enrollments/${encodeURIComponent(
      enrollmentId,
    )}/rep-results`,
  );
}

// ── Gig submissions (the admin-authored, goal-bound deliverables) ────────────

/** GET the caller's gigs — the "submit this" deliverables they inherit via their enrolled
 *  goals (soonest in the cycle first). */
export async function fetchMyGigs(): Promise<Gig[]> {
  await ensureAuthToken();
  const { gigs } = await apiClient.get<{ gigs: Gig[] }>(
    '/api/v1/training-engine/recordings/gigs',
  );
  return gigs;
}

/** GET ONE gig by id (the perform route), with the caller's existing take for it (if any).
 *  404s if the gig doesn't exist OR the caller isn't enrolled in its goal. */
export async function fetchGig(id: string): Promise<{
  gig: Gig;
  existingTake: TakeResultWithSignedUrl | null;
}> {
  await ensureAuthToken();
  return apiClient.get<{
    gig: Gig;
    existingTake: TakeResultWithSignedUrl | null;
  }>(`/api/v1/training-engine/recordings/gigs/${encodeURIComponent(id)}`);
}

/**
 * GET the caller's submitted takes (history), each with a short-lived signed audio URL.
 *
 * Uses a RAW fetch with the session token set EXPLICITLY per-request (not the shared apiClient).
 * The apiClient attaches auth via a mutable singleton header + dedupes GETs by URL — both race on
 * the backstage mount, where several authed hooks fire at once: a concurrent tokenless GET to the
 * same path can be reused, or another call can clear the singleton's header between set and fetch,
 * yielding a 401 ("No token provided") that silently empties the list. Attaching the token to THIS
 * request (like submitTake does) sidesteps both. */
export async function fetchMyTakeHistory(): Promise<TakeResultWithSignedUrl[]> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('User not authenticated');
  }

  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const res = await fetch(
    `${baseUrl}/api/v1/training-engine/recordings/takes`,
    { headers: { Authorization: `Bearer ${session.access_token}` } },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Failed to load takes (${res.status}): ${body}`);
  }
  const { takes } = (await res.json()) as { takes: TakeResultWithSignedUrl[] };
  return takes;
}

/** POST a new gig on a goal (admin builder). Returns the created gig. */
export async function createGig(input: CreateGigInput): Promise<Gig> {
  await ensureAuthToken();
  const { gig } = await apiClient.post<{ gig: Gig }>(
    '/api/v1/training-engine/admin/gigs',
    input,
  );
  return gig;
}

/** GET every gig (admin management list), optionally scoped to one goal. */
export async function fetchAdminGigs(goalId?: string): Promise<Gig[]> {
  await ensureAuthToken();
  const suffix = goalId ? `?goalId=${encodeURIComponent(goalId)}` : '';
  const { gigs } = await apiClient.get<{ gigs: Gig[] }>(
    `/api/v1/training-engine/admin/gigs${suffix}`,
  );
  return gigs;
}

/** PATCH a gig's parameters (admin). Returns the updated gig. */
export async function updateGig(
  id: string,
  patch: UpdateGigInput,
): Promise<Gig> {
  await ensureAuthToken();
  const { gig } = await apiClient.patch<{ gig: Gig }>(
    `/api/v1/training-engine/admin/gigs/${encodeURIComponent(id)}`,
    patch,
  );
  return gig;
}

/** DELETE a gig (admin). Submitted takes survive (gig_id → SET NULL). */
export async function deleteGig(id: string): Promise<void> {
  await ensureAuthToken();
  await apiClient.delete(
    `/api/v1/training-engine/admin/gigs/${encodeURIComponent(id)}`,
  );
}

/** The grade + stats that ride along with a submitted take (the non-file metadata). */
export interface SubmitTakeMeta {
  gigId?: string;
  station: string;
  exerciseName?: string;
  scaleKey?: string;
  tempoBpm?: number;
  timingScore?: number;
  pitchScore?: number;
  jitterMs?: number;
  offsetMs?: number;
  noteCount?: number;
  /** The reconstruction recipe — what backing to load to replay this take in context. Serialized
   *  to a JSON string in the FormData (the backend parses it). */
  playbackContext?: PlaybackContext;
}

/**
 * POST a submitted take: the compressed audio blob + its grade/stats, multipart.
 * NOT via apiClient.post (that JSON-stringifies the body) — multipart needs the browser to set
 * the boundary, so we hand-build the FormData + fetch with the session token.
 */
export async function submitTake(
  audio: Blob,
  meta: SubmitTakeMeta,
): Promise<TakeResult> {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error('User not authenticated');
  }

  const form = new FormData();
  form.append('audio', audio, 'take.ogg');
  for (const [k, v] of Object.entries(meta)) {
    if (v === undefined || v === null) continue;
    // Objects (playbackContext) go as JSON; scalars as strings. String(obj) would yield
    // "[object Object]" — the backend parses playbackContext with JSON.parse.
    form.append(k, typeof v === 'object' ? JSON.stringify(v) : String(v));
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  const res = await fetch(
    `${baseUrl}/api/v1/training-engine/recordings/submit`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: form, // NO Content-Type header — the browser sets the multipart boundary.
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Submit failed (${res.status}): ${body}`);
  }
  return (await res.json()) as TakeResult;
}
