-- founder_members.stripe_customer_id → nullable.
--
-- Founder purchases via a Stripe Payment Link with customer_creation:'if_required'
-- (the old default) don't create a Customer object, so session.customer is null.
-- The column was NOT NULL, which forced storing '' (a lie — it reads as "has a
-- value"). Make it nullable so "no customer" is stored honestly as NULL. New
-- founder links use customer_creation:'always' and will populate a real cus_ id.
--
-- Also normalize any existing '' to NULL.

ALTER TABLE public.founder_members
  ALTER COLUMN stripe_customer_id DROP NOT NULL;

UPDATE public.founder_members
  SET stripe_customer_id = NULL
  WHERE stripe_customer_id = '';
