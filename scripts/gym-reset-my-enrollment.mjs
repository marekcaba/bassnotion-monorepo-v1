/**
 * One-off: inspect (and optionally delete) a user's Bass Gym enrollment(s) so
 * the gym shows the goal picker again. Defaults to DRY-RUN (inspect only).
 *
 *   node scripts/gym-reset-my-enrollment.mjs <email>            # inspect only
 *   node scripts/gym-reset-my-enrollment.mjs <email> --delete   # actually delete
 *
 * Deletes goal_enrollments for the user; climb_states + rep_results cascade via
 * FK. PROD data (local hits prod) — review the dry-run output first.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import ws from 'ws';

const env = Object.fromEntries(
  readFileSync('apps/backend/.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
// Disable realtime (Node 20 has no native WebSocket; this script is REST-only)
// and auth session persistence (one-shot service-role script).
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: ws },
});

const email = process.argv[2];
const doDelete = process.argv.includes('--delete');
if (!email) {
  console.error('Usage: node scripts/gym-reset-my-enrollment.mjs <email> [--delete]');
  process.exit(1);
}

const { data: prof } = await sb
  .from('profiles')
  .select('id, role, email')
  .eq('email', email)
  .maybeSingle();
if (!prof) {
  console.error(`No profile found for ${email}`);
  process.exit(1);
}
console.log('USER:', { id: prof.id, role: prof.role, email: prof.email });

const { data: enrollments } = await sb
  .from('goal_enrollments')
  .select('id, goal_id, status, started_at')
  .eq('user_id', prof.id);

console.log(`ENROLLMENTS (${enrollments?.length ?? 0}):`);
for (const e of enrollments ?? []) {
  const { count: reps } = await sb
    .from('rep_results')
    .select('*', { count: 'exact', head: true })
    .eq('goal_enrollment_id', e.id);
  const { count: climbs } = await sb
    .from('climb_states')
    .select('*', { count: 'exact', head: true })
    .eq('goal_enrollment_id', e.id);
  console.log(
    `  - ${e.id} | goal ${e.goal_id} | status ${e.status} | ${reps ?? 0} reps | ${climbs ?? 0} climb_states`,
  );
}

if (!doDelete) {
  console.log('\nDRY RUN — nothing deleted. Re-run with --delete to remove these.');
  process.exit(0);
}

const { error } = await sb
  .from('goal_enrollments')
  .delete()
  .eq('user_id', prof.id);
if (error) {
  console.error('DELETE FAILED:', error.message);
  process.exit(1);
}
console.log('\n✅ Deleted all enrollments for this user (climb_states + rep_results cascaded).');
console.log('Reopen /app/gym → you should see the goal picker.');
