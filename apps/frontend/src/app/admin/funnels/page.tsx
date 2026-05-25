'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/infrastructure/supabase/client';

interface FunnelStats {
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

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; stats: FunnelStats }
  | { kind: 'error'; message: string };

export default function FunnelsPage() {
  const [state, setState] = useState<LoadState>({ kind: 'idle' });

  const fetchStats = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL;
      if (!apiUrl) {
        throw new Error('NEXT_PUBLIC_API_URL is not configured');
      }
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      if (!token) {
        throw new Error('Not signed in — log in as admin first.');
      }
      const res = await fetch(`${apiUrl}/api/v1/founders/admin/funnels`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `Access denied (${res.status}). Your account needs profiles.role='admin'.`,
        );
      }
      if (!res.ok) {
        throw new Error(`Backend returned ${res.status}`);
      }
      const stats = (await res.json()) as FunnelStats;
      setState({ kind: 'ready', stats });
    } catch (err) {
      setState({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-baseline justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Funnels</h1>
        <button
          type="button"
          onClick={fetchStats}
          disabled={state.kind === 'loading'}
          className="text-sm font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          {state.kind === 'loading' ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {state.kind === 'idle' || state.kind === 'loading' ? (
        <div className="text-gray-500">Loading…</div>
      ) : state.kind === 'error' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <div className="font-medium">Couldn&apos;t load funnel stats</div>
          <div className="text-sm mt-1">{state.message}</div>
        </div>
      ) : (
        <FunnelsView stats={state.stats} />
      )}
    </div>
  );
}

function FunnelsView({ stats }: { stats: FunnelStats }) {
  const { totals, conversion, topUtmSources, topUtmCampaigns, generatedAt } =
    stats;

  return (
    <div className="space-y-8">
      {/* Aggregate totals */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Totals
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label="Waitlist signups" value={totals.waitlist} />
          <Stat
            label="Founder-button clicks"
            value={totals.founderInterestClicks}
          />
          <Stat
            label="Founders (live)"
            value={totals.founderMembersLive}
            highlight
          />
          <Stat
            label="Founders (test)"
            value={totals.founderMembersTest}
            subtle
          />
        </div>
      </section>

      {/* Conversion rates */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Conversion
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <RatioRow
            label="Waitlist → click"
            pct={conversion.waitlistToInterestPct}
          />
          <RatioRow
            label="Click → founder"
            pct={conversion.interestToFounderPct}
          />
          <RatioRow
            label="Waitlist → founder"
            pct={conversion.waitlistToFounderPct}
          />
        </div>
      </section>

      {/* Top UTM sources */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Top UTM sources (from waitlist signups)
        </h2>
        <TopList items={topUtmSources} keyField="source" />
      </section>

      {/* Top UTM campaigns */}
      <section>
        <h2 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
          Top UTM campaigns (from waitlist signups)
        </h2>
        <TopList items={topUtmCampaigns} keyField="campaign" />
      </section>

      <div className="text-xs text-gray-400">
        Generated {new Date(generatedAt).toLocaleString()}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
  subtle = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  subtle?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? 'border-orange-300 bg-orange-50'
          : subtle
            ? 'border-gray-200 bg-gray-50'
            : 'border-gray-200 bg-white'
      }`}
    >
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div
        className={`mt-1 text-2xl font-semibold ${
          highlight ? 'text-orange-700' : 'text-gray-900'
        }`}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

function RatioRow({ label, pct }: { label: string; pct: number | null }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">
        {pct == null ? '—' : `${pct.toFixed(1)}%`}
      </div>
    </div>
  );
}

function TopList<K extends string>({
  items,
  keyField,
}: {
  items: Array<{ count: number } & Record<K, string>>;
  keyField: K;
}) {
  if (items.length === 0) {
    return (
      <div className="text-sm text-gray-400">
        No attributed signups yet. Try sharing a link with{' '}
        <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
          ?utm_source=youtube
        </code>{' '}
        appended.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              {String(keyField)}
            </th>
            <th className="px-4 py-2 text-right text-xs font-medium uppercase tracking-wide text-gray-500">
              Signups
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {items.map((item) => (
            <tr key={item[keyField]}>
              <td className="px-4 py-2 text-sm text-gray-900">
                {item[keyField]}
              </td>
              <td className="px-4 py-2 text-right text-sm tabular-nums text-gray-900">
                {item.count.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
