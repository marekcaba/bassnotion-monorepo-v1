/**
 * /free/[slug] — the YouTube-funnel landing page.
 *
 * Each YouTube video's description box links here with the slug of the
 * tutorial whose groove was featured in that video (e.g.
 * /free/test-groove-2). The page is deliberately minimal: leather
 * background, the one groove card centered, a single Sign up button
 * beneath it. Nothing else — no nav, no footer, no marketing copy. The
 * card itself is the pitch.
 *
 * Public route (sits beside /register, /login — NOT under /app), so no
 * AuthGuard: an anonymous visitor can play the card right away. The card
 * is fully playable but free-tier CAPPED (tempo / transpose / loop-range /
 * solo) via `enableCaps` — every groove card is free, but the levers are
 * tiered, and each cap edge nudges the visitor to Sign up.
 *
 * The groove is resolved exactly like the homepage's featured groove:
 * fetch the public tutorial by slug and extract its first groove-card
 * block's config. Funnel tutorials MUST be `free`-tier (the public
 * `/tutorials/:slug` route 403s a logged-out visitor on member/product
 * tiers — that's a gate, not a leak, but it would break the funnel).
 *
 * The Sign up button carries `?from=<slug>` so we can attribute which
 * video converted (and later deep-link the visitor back post-signup).
 * The /register page safely ignores `from` today.
 */

import type {
  GrooveCardBlockConfig,
  TutorialBlock,
} from '@bassnotion/contracts';
import { LeatherBackground } from '@/shared/components/LeatherBackground';
import { FreeGrooveExperience } from './FreeGrooveExperience';
import { FreeGrooveNotFound } from './FreeGrooveNotFound';

export const dynamic = 'force-dynamic';

// Dark base the leather texture's `mix-blend-mode: screen` reads against.
// Warm near-black in the same family as the card surface (#100E0D) so the
// card sits in a continuous leather field.
const PAGE_BG =
  'radial-gradient(ellipse at 50% 0%, hsl(20 8% 9%) 0%, hsl(18 6% 6%) 55%, hsl(0 0% 3%) 100%)';

/**
 * Resolve the groove for `slug` from the public tutorial route — the same
 * source the homepage uses (`/tutorials/:slug` → first groove-card block).
 * Returns null on any failure (missing API URL, 403 gated tutorial, 404,
 * unpublished, no groove-card block, malformed shape) so the page renders
 * the graceful not-found surface instead of throwing. A mistyped or gated
 * link should land somewhere that converts, not a stack trace.
 *
 * Mirrors `loadFeaturedGroove` in app/page.tsx — see its comments for why
 * the public route (no `/api/v1` prefix) is the right one to hit.
 */
async function loadGrooveBySlug(
  slug: string,
): Promise<{ config: GrooveCardBlockConfig; title: string } | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  try {
    const res = await fetch(`${apiUrl}/tutorials/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      tutorial?: {
        title?: string;
        status?: string;
        blocks?: TutorialBlock[];
      };
    };
    const tutorial = json.tutorial;
    if (!tutorial || !tutorial.title || !Array.isArray(tutorial.blocks)) {
      return null;
    }
    // Keep drafts off the public funnel page (findBySlug only checks
    // is_active, not status) — same defence as the homepage.
    if (tutorial.status !== 'published') return null;
    const grooveBlock = tutorial.blocks.find(
      (b): b is TutorialBlock<'groove-card'> => b.type === 'groove-card',
    );
    if (!grooveBlock || !grooveBlock.config?.stems?.bass) return null;
    return {
      // The tutorial title drives the card headline (admin edits it in the
      // /app tutorial editor), matching the homepage's behaviour.
      config: { ...grooveBlock.config, title: tutorial.title },
      title: tutorial.title,
    };
  } catch {
    return null;
  }
}

export default async function FreeGroovePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const groove = await loadGrooveBySlug(slug);

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden text-[#E8E8E8] font-dm-body"
      style={{ background: PAGE_BG }}
    >
      <LeatherBackground />

      <main className="relative z-10 flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-16">
        {groove ? (
          // max-w-3xl (768px) matches the in-app player's groove-card wrapper
          // in YouTubeWidgetPage so the card renders at the same width here as
          // it does inside /app. The Sign up button lives INSIDE the
          // experience (a client island) so it can reveal itself the first
          // time the visitor hits a capped lever.
          <div className="w-full max-w-3xl">
            <FreeGrooveExperience config={groove.config} slug={slug} />
          </div>
        ) : (
          <FreeGrooveNotFound />
        )}
      </main>
    </div>
  );
}
