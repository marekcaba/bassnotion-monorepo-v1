/**
 * Shared TanStack Query keys for the gym/training-engine, USER-SCOPED.
 *
 * The userId segment is mandatory: AuthProvider calls queryClient.clear() on an
 * identity change, but scoping the key to the user is belt-and-suspenders so a
 * prefetched/cached entry can never leak across an account switch.
 *
 * Both the login-time prefetch (AppGymWarmup) and useGymSession read these, so
 * the gym opens from a warm cache instead of re-running its fetch chain.
 */
export const gymKeys = {
  enrollments: (userId: string) => ['gym', 'my-enrollments', userId] as const,
  todayRep: (userId: string, enrollmentId: string, mode: 'full' | 'floor') =>
    ['gym', 'today-rep', userId, enrollmentId, mode] as const,
};
