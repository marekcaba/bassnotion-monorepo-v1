-- ============================================================================
-- SECURITY FIX: Revoke anonymous access to check_user_exists function
-- ============================================================================
--
-- This migration addresses an email enumeration vulnerability where attackers
-- could determine if an email exists in the system by calling the check_user_exists
-- RPC function without authentication.
--
-- Previously: Both 'anon' and 'authenticated' roles could call this function
-- Now: Only 'authenticated' users can call this function
--
-- The frontend MagicLinkSignIn component has been updated to no longer use
-- this function. Instead, it sends magic links with shouldCreateUser: true,
-- which handles both existing and new users without revealing existence.
-- ============================================================================

-- Revoke access from anonymous users
revoke execute on function public.check_user_exists(text) from anon;

-- Keep access for authenticated users (may be needed for admin functions)
-- grant execute on function public.check_user_exists(text) to authenticated;
-- (already granted in original migration)

-- Add a comment documenting the security considerations
comment on function public.check_user_exists(text) is
  'SECURITY: This function is restricted to authenticated users only to prevent email enumeration attacks. Do NOT grant access to anon role.';
