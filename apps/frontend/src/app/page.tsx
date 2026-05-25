import {
  FOUNDER_CARD_CONFIG_DEFAULTS,
  type FounderCardConfig,
  founderCardConfigSchema,
} from '@bassnotion/contracts';

import { WaitlistClient } from './WaitlistClient';

export const dynamic = 'force-dynamic';

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

export default async function WaitlistPage() {
  const cardConfig = await loadFounderCardConfig();
  return <WaitlistClient cardConfig={cardConfig} />;
}
