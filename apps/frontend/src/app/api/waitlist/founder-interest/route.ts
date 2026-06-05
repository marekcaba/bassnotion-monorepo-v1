import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { founderInterestSchema } from '@bassnotion/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json(
      { ok: false, error: 'Service unavailable' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON' },
      { status: 400 },
    );
  }

  const parsed = founderInterestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const userAgent = request.headers.get('user-agent') ?? null;
  // request-time referrer = the page the click happened on (the
  // bassicology.com page itself). Distinct from the visitor's FIRST-touch
  // referrer in `attribution.referrer`, captured client-side on mount.
  const requestReferrer = request.headers.get('referer') ?? null;

  const { error: insertError } = await supabase
    .from('founder_interest')
    .insert({
      email: parsed.data.email,
      metadata: {
        userAgent,
        requestReferrer,
        attribution: parsed.data.attribution ?? null,
        // founder_interest has no dedicated column; metadata keeps the row
        // joinable to this visitor's funnel_events without a schema change.
        anonymousId: parsed.data.anonymousId ?? null,
      },
    });

  if (insertError) {
    console.error('[founder-interest] insert failed', {
      code: insertError.code,
      message: insertError.message,
    });
    return NextResponse.json(
      { ok: false, error: 'Could not record interest — try again in a moment' },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
