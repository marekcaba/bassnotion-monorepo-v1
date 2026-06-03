import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MembershipService } from '../services/membership.service.js';
import type { SubscriptionRepository } from '../repositories/subscription.repository.js';
import type { FounderMemberRepository } from '../repositories/founder-member.repository.js';
import type { SupabaseService } from '../../../infrastructure/supabase/supabase.service.js';

const USER_ID = 'user-1';
const EMAIL = 'founder@example.com';

function makeService(opts: {
  founder?: unknown;
  findThrows?: boolean;
  grantThrows?: boolean;
}) {
  const findByEmail = vi.fn(async () => {
    if (opts.findThrows) throw new Error('db down');
    return opts.founder ?? null;
  });
  const grantLifetimeMembership = vi.fn(async () => {
    if (opts.grantThrows) throw new Error('grant failed');
  });
  // grantFounderMembershipByEmail isn't exercised by these tests (it's the
  // webhook path); a stub Supabase service keeps the constructor satisfied.
  const supabaseService = {
    getClient: () => ({}),
  } as unknown as SupabaseService;
  const service = new MembershipService(
    { grantLifetimeMembership } as unknown as SubscriptionRepository,
    { findByEmail } as unknown as FounderMemberRepository,
    supabaseService,
  );
  return { service, findByEmail, grantLifetimeMembership };
}

describe('MembershipService.grantFounderMembershipIfEligible', () => {
  beforeEach(() => vi.clearAllMocks());

  it('grants a lifetime membership when the email is a founder', async () => {
    const { service, grantLifetimeMembership } = makeService({
      founder: { email: EMAIL },
    });
    const granted = await service.grantFounderMembershipIfEligible(
      USER_ID,
      EMAIL,
    );
    expect(granted).toBe(true);
    expect(grantLifetimeMembership).toHaveBeenCalledWith(USER_ID, 'founder');
  });

  it('does nothing when the email is NOT a founder', async () => {
    const { service, grantLifetimeMembership } = makeService({ founder: null });
    const granted = await service.grantFounderMembershipIfEligible(
      USER_ID,
      EMAIL,
    );
    expect(granted).toBe(false);
    expect(grantLifetimeMembership).not.toHaveBeenCalled();
  });

  it('returns false for a missing/empty email (no lookup)', async () => {
    const { service, findByEmail } = makeService({});
    expect(await service.grantFounderMembershipIfEligible(USER_ID, null)).toBe(
      false,
    );
    expect(
      await service.grantFounderMembershipIfEligible(USER_ID, undefined),
    ).toBe(false);
    expect(findByEmail).not.toHaveBeenCalled();
  });

  it('never throws — returns false if the founder lookup fails', async () => {
    const { service } = makeService({ findThrows: true });
    const granted = await service.grantFounderMembershipIfEligible(
      USER_ID,
      EMAIL,
    );
    expect(granted).toBe(false);
  });

  it('never throws — returns false if the grant write fails', async () => {
    const { service } = makeService({
      founder: { email: EMAIL },
      grantThrows: true,
    });
    const granted = await service.grantFounderMembershipIfEligible(
      USER_ID,
      EMAIL,
    );
    expect(granted).toBe(false);
  });
});
