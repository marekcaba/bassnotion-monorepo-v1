import { Injectable, Logger } from '@nestjs/common';

import { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';

export interface FunnelStats {
  totals: {
    waitlist: number;
    founderInterestClicks: number;
    founderMembersLive: number;
    founderMembersTest: number;
  };
  conversion: {
    waitlistToInterestPct: number | null;
    interestToFounderPct: number | null;
    waitlistToFounderPct: number | null;
  };
  topUtmSources: Array<{ source: string; count: number }>;
  topUtmCampaigns: Array<{ campaign: string; count: number }>;
  generatedAt: string;
}

interface MetadataRow {
  metadata: { attribution?: { utmSource?: string; utmCampaign?: string } } | null;
}

/**
 * Server-side aggregator for the /admin/funnels page. Reads from
 * waitlist / founder_interest / founder_members using the service-role
 * Supabase client (mediated by SupabaseService). Returns counts only —
 * no PII leaves this method.
 *
 * Top-N aggregations are computed in-process rather than as Postgres
 * GROUP BY queries because the row counts are small (<10k expected pre-
 * launch) and the metadata is JSONB; pulling the column once and
 * aggregating in Node is simpler than the equivalent SQL.
 */
@Injectable()
export class AdminFunnelsService {
  private readonly logger = new Logger(AdminFunnelsService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async getStats(): Promise<FunnelStats> {
    const client = this.supabaseService.getClient();

    // Three counts in parallel — small queries, no cross-table join.
    const [waitlistRes, interestRes, foundersLiveRes, foundersTestRes] =
      await Promise.all([
        client
          .from('waitlist')
          .select('id', { count: 'exact', head: true }),
        client
          .from('founder_interest')
          .select('id', { count: 'exact', head: true }),
        client
          .from('founder_members')
          .select('id', { count: 'exact', head: true })
          .eq('mode', 'live'),
        client
          .from('founder_members')
          .select('id', { count: 'exact', head: true })
          .eq('mode', 'test'),
      ]);

    for (const res of [waitlistRes, interestRes, foundersLiveRes, foundersTestRes]) {
      if (res.error) {
        this.logger.error('Funnel count query failed', {
          code: res.error.code,
          message: res.error.message,
        });
        throw res.error;
      }
    }

    const waitlist = waitlistRes.count ?? 0;
    const founderInterestClicks = interestRes.count ?? 0;
    const founderMembersLive = foundersLiveRes.count ?? 0;
    const founderMembersTest = foundersTestRes.count ?? 0;

    // Pull the metadata column from waitlist only for the top-N aggregation.
    // We use waitlist (not founder_interest) because waitlist is the broadest
    // funnel entry — most people will sign up before clicking the founder
    // button, so the attribution distribution there is the most complete.
    const { data: waitlistMetaRows, error: metaError } = await client
      .from('waitlist')
      .select('metadata');

    if (metaError) {
      this.logger.error('Funnel metadata query failed', {
        code: metaError.code,
        message: metaError.message,
      });
      throw metaError;
    }

    const sourceCounts = new Map<string, number>();
    const campaignCounts = new Map<string, number>();

    for (const row of (waitlistMetaRows as MetadataRow[] | null) ?? []) {
      const attr = row.metadata?.attribution;
      if (!attr) continue;
      if (attr.utmSource) {
        sourceCounts.set(
          attr.utmSource,
          (sourceCounts.get(attr.utmSource) ?? 0) + 1,
        );
      }
      if (attr.utmCampaign) {
        campaignCounts.set(
          attr.utmCampaign,
          (campaignCounts.get(attr.utmCampaign) ?? 0) + 1,
        );
      }
    }

    const topUtmSources = sortAndTake(sourceCounts, 5).map(([source, count]) => ({
      source,
      count,
    }));
    const topUtmCampaigns = sortAndTake(campaignCounts, 5).map(
      ([campaign, count]) => ({ campaign, count }),
    );

    return {
      totals: {
        waitlist,
        founderInterestClicks,
        founderMembersLive,
        founderMembersTest,
      },
      conversion: {
        waitlistToInterestPct: pct(founderInterestClicks, waitlist),
        interestToFounderPct: pct(founderMembersLive, founderInterestClicks),
        waitlistToFounderPct: pct(founderMembersLive, waitlist),
      },
      topUtmSources,
      topUtmCampaigns,
      generatedAt: new Date().toISOString(),
    };
  }
}

function sortAndTake(
  counts: Map<string, number>,
  n: number,
): Array<[string, number]> {
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function pct(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}
