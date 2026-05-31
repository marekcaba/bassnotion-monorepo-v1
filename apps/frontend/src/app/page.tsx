import {
  FOUNDER_CARD_CONFIG_DEFAULTS,
  type FounderCardConfig,
  founderCardConfigSchema,
  type GrooveCardBlockConfig,
  type TutorialBlock,
} from '@bassnotion/contracts';

import { WaitlistClient } from './WaitlistClient';

export const dynamic = 'force-dynamic';

/**
 * Slug of the tutorial whose first groove-card block drives the waitlist
 * demo. Admin keeps this row up to date in /app; the public homepage
 * SSRs its title + groove config from here.
 */
const FEATURED_GROOVE_SLUG = 'waitlist-groove';

export interface FeaturedGroove {
  /** Tutorial.title — shown as the card headline. */
  tutorialTitle: string;
  /** First groove-card block's config — drives stems, BPM, key sets, etc. */
  grooveConfig: GrooveCardBlockConfig;
}

/**
 * Server-side fetch of the admin-editable founder-card config so the
 * homepage SSRs with the live copy + sizes — no flash of default text.
 *
 * Failure paths intentionally swallow and return defaults: if the
 * backend or Supabase is briefly unreachable, the homepage MUST still
 * render. The defaults mirror the seeded DB row so visitors see the
 * exact same card whether or not the fetch succeeded.
 */
async function loadFounderCardConfig(): Promise<FounderCardConfig> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return FOUNDER_CARD_CONFIG_DEFAULTS;
  try {
    const res = await fetch(`${apiUrl}/api/v1/founders/card-config`, {
      cache: 'no-store',
    });
    if (!res.ok) return FOUNDER_CARD_CONFIG_DEFAULTS;
    const json = await res.json();
    const parsed = founderCardConfigSchema.safeParse(json);
    return parsed.success ? parsed.data : FOUNDER_CARD_CONFIG_DEFAULTS;
  } catch {
    return FOUNDER_CARD_CONFIG_DEFAULTS;
  }
}

/**
 * Server-side fetch of the featured waitlist groove. Pulls the tutorial
 * by its constant slug (`waitlist-groove`), then extracts the first
 * groove-card block's config plus the tutorial title for the headline.
 *
 * Returns `null` on any failure (missing API URL, non-200, no row,
 * no groove-card block, malformed shape) so `WaitlistGrooveCard` can
 * fall back to its bundled `WAITLIST_DEMO_CONFIG` — same discipline as
 * `loadFounderCardConfig`. The page must always render.
 */
async function loadFeaturedGroove(): Promise<FeaturedGroove | null> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  try {
    // Public TutorialsController is mounted at `/tutorials/:slug`, no
    // `/api/v1` prefix (see backend `main.ts` — no global prefix). The
    // admin controller takes `/api/v1/tutorials/:id` (UUID-typed param)
    // which 500s when you pass it a slug. The Nest router happens to
    // match `:id` first when both controllers share `:slug`/`:id` at the
    // same base, so always hit the explicit public route.
    const res = await fetch(`${apiUrl}/tutorials/${FEATURED_GROOVE_SLUG}`, {
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
    // Defense in depth: the backend's findBySlug only checks
    // `is_active = true` (not `status === 'published'`), so a draft row
    // would otherwise leak onto the public marketing page. Falling back
    // to the bundled config keeps drafts private until the admin
    // explicitly publishes.
    if (tutorial.status !== 'published') return null;
    const grooveBlock = tutorial.blocks.find(
      (b): b is TutorialBlock<'groove-card'> => b.type === 'groove-card',
    );
    if (!grooveBlock) return null;
    // Legacy 5-key-set shape coercion lives inside useGrooveCardPlayback
    // — DB rows written before LAUNCH-02.5e still carry `config.keys[]`
    // and `config.stems` is undefined until they're re-saved. Passing
    // through here is intentional.
    return {
      tutorialTitle: tutorial.title,
      grooveConfig: grooveBlock.config,
    };
  } catch {
    return null;
  }
}

export default async function WaitlistPage() {
  const [cardConfig, featuredGroove] = await Promise.all([
    loadFounderCardConfig(),
    loadFeaturedGroove(),
  ]);
  return (
    <WaitlistClient cardConfig={cardConfig} featuredGroove={featuredGroove} />
  );
}
