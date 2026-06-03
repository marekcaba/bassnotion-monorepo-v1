-- R3.2 — backfill founder memberships for founders who ALREADY have an account.
--
-- Founders paid one-time ("lifetime, no monthly fee") but founder_members has no
-- user_id and never granted entitlement, so existing founders with accounts are
-- stranded on free caps. New founders are handled at signup
-- (AuthService.registerUser → MembershipService.grantFounderMembershipIfEligible);
-- this migration covers anyone who signed up BEFORE that landed.
--
-- Grants a synthetic lifetime `subscriptions` row — the SAME shape
-- grantLifetimeMembership() writes (sentinel stripe ids, status active,
-- far-future period) — so /billing/access → useEntitlement treats them as
-- members via the one entitlement path. Idempotent: ON CONFLICT on the unique
-- stripe_subscription_id sentinel makes re-running a no-op.

INSERT INTO public.subscriptions (
  user_id,
  stripe_customer_id,
  stripe_subscription_id,
  stripe_price_id,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end
)
SELECT
  p.id,
  'lifetime_founder',
  'lifetime_' || p.id,          -- matches grantLifetimeMembership sentinel
  'lifetime_founder',
  'active',
  NOW(),
  '2099-12-31T00:00:00Z'::timestamptz,
  false
FROM public.founder_members fm
JOIN public.profiles p ON p.email = fm.email   -- email is CITEXT → case-insensitive
ON CONFLICT (stripe_subscription_id) DO NOTHING;
