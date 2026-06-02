import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { waitlistEntrySchema } from '@bassnotion/contracts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function POST(request: Request) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
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

  // Honeypot: if the hidden `website` field is filled, it's a bot.
  // Respond 200 so the bot thinks it worked, but don't write anything.
  if (
    typeof body === 'object' &&
    body !== null &&
    'website' in body &&
    typeof (body as { website: unknown }).website === 'string' &&
    (body as { website: string }).website.length > 0
  ) {
    return NextResponse.json({ ok: true, position: 0, alreadyOnList: false });
  }

  const parsed = waitlistEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' },
      { status: 400 },
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });

  const userAgent = request.headers.get('user-agent') ?? null;
  // request-time referrer = the page the form was submitted from (the
  // bassicology.com page itself, almost always). Distinct from the
  // visitor's FIRST-touch referrer in `attribution.referrer`, which is
  // captured client-side on initial page load.
  const requestReferrer = request.headers.get('referer') ?? null;

  const { error: insertError } = await supabase.from('waitlist').insert({
    email: parsed.data.email,
    level: parsed.data.level,
    // Top-level column (not metadata) so the row joins to this visitor's
    // funnel_events. Null-tolerant for older cached clients that omit it.
    anonymous_id: parsed.data.anonymousId ?? null,
    metadata: {
      userAgent,
      requestReferrer,
      // Default 'beta' for callers that omit the field — current frontend
      // sends it explicitly, this just makes the schema change non-breaking
      // for any older client still in cache when we ship.
      signupIntent: parsed.data.signupIntent ?? 'beta',
      attribution: parsed.data.attribution ?? null,
    },
  });

  // 23505 = unique_violation. Treat duplicate as success so we don't leak
  // which emails are registered — and the user gets the same UX either way.
  const isDuplicate = insertError?.code === '23505';
  if (insertError && !isDuplicate) {
    console.error('[waitlist] insert failed', {
      code: insertError.code,
      message: insertError.message,
      details: insertError.details,
      hint: insertError.hint,
    });
    return NextResponse.json(
      { ok: false, error: 'Could not save your spot — try again in a moment' },
      { status: 500 },
    );
  }

  // Best-effort position lookup. The waitlist table has no SELECT policy for
  // anon, so this will return null; we fall back to a stable display number.
  const { count } = await supabase
    .from('waitlist')
    .select('id', { count: 'exact', head: true });

  return NextResponse.json({
    ok: true,
    position: count ?? 0,
    alreadyOnList: isDuplicate,
  });
}
