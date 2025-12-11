# API Optimization & Request Deduplication Guide

## Overview

This guide documents BassNotion's multi-layer API optimization strategy to minimize database queries and reduce costs at scale. Our approach combines FAANG-level patterns from Netflix (aggregation), Facebook (batching), Stripe (deduplication), and Google (caching).

## Why API Optimization Matters

### Cost at Scale

Database queries are **the primary cost driver** for SaaS applications:

```
Current (Unoptimized):
├─ 1,000 users/day   → 6,000 DB queries    → Free tier
├─ 10,000 users/day  → 60,000 DB queries   → $25/mo (Supabase Pro)
└─ 100,000 users/day → 600,000 DB queries  → $200+/mo

With Optimization (90% cache hit rate):
├─ 1,000 users/day   → 600 DB queries      → Free tier ✅
├─ 10,000 users/day  → 6,000 DB queries    → Free tier ✅
└─ 100,000 users/day → 60,000 DB queries   → $25/mo ✅
```

**At 100k users/day**: Save **$175/month** with proper optimization!

### Performance Benefits

- **Faster page loads**: Fewer API calls = reduced latency
- **Better UX**: Users don't hit rate limits
- **Reduced server load**: Less CPU/memory usage

---

## Our Multi-Layer Optimization Strategy

### Layer 1: Request Deduplication (Frontend)

**Pattern**: Stripe, Amazon
**Location**: `apps/frontend/src/lib/api-client.ts`
**Cost**: FREE
**Savings**: 33-50% fewer API calls

#### How It Works

When multiple React components request the same URL simultaneously (e.g., during initial render), they share a single HTTP request instead of making duplicates.

```typescript
// Before optimization:
Component A → GET /api/user/profile  (Request #1)
Component B → GET /api/user/profile  (Request #2 - duplicate!)
Component C → GET /api/user/profile  (Request #3 - duplicate!)
                                      ─────────────────────────
                                      3 API calls = 3 DB queries

// After optimization:
Component A →
Component B → GET /api/user/profile  (Single shared request)
Component C →
                                      ─────────────────────────
                                      1 API call = 1 DB query ✅
```

#### Implementation

The ApiClient maintains a Map of in-flight GET requests:

```typescript
class ApiClient {
  private pendingRequests = new Map<string, Promise<any>>();

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const cacheKey = method === 'GET' ? `${method}:${url}` : null;

    // Check if identical request is already in flight
    if (cacheKey && this.pendingRequests.has(cacheKey)) {
      logger.debug('Deduplicating request (reusing in-flight request)');
      return this.pendingRequests.get(cacheKey)!;
    }

    // Make request and cache the promise
    const fetchPromise = fetch(url, config);
    if (cacheKey) {
      this.pendingRequests.set(cacheKey, fetchPromise);
      fetchPromise.finally(() => this.pendingRequests.delete(cacheKey));
    }

    return fetchPromise;
  }
}
```

#### When It Helps

- **Page load**: Multiple components fetching user profile
- **Re-renders**: React strict mode double-renders
- **Race conditions**: Parallel useEffect calls
- **Component trees**: Parent + children fetching same data

---

### Layer 2: React Query Cache (Frontend)

**Pattern**: Google, Airbnb
**Location**: React Query hooks throughout codebase
**Cost**: FREE
**Savings**: 70-90% fewer API calls on navigation

#### How It Works

React Query caches API responses in memory. When navigating between pages, data is served from cache instead of re-fetching.

```typescript
// Example: Tutorial exercises hook
const { data: exercises } = useQuery({
  queryKey: ['exercises', tutorialId],
  queryFn: () => fetchExercises(tutorialId),
  staleTime: 30 * 60 * 1000, // 30 minutes (aggressive caching)
  gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
});
```

#### Configuration

```typescript
// Default React Query configuration
queryClient.setDefaultOptions({
  queries: {
    staleTime: 30 * 60 * 1000, // Data fresh for 30 min
    gcTime: 60 * 60 * 1000, // Keep in cache for 1 hour
    refetchOnWindowFocus: false, // Don't refetch on tab switch
    refetchOnMount: false, // Don't refetch on remount
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors (including 429 rate limits)
      if (error.status >= 400 && error.status < 500) return false;
      return failureCount < 3;
    },
  },
});
```

#### When It Helps

- **Navigation**: User goes Page A → Page B → Page A (cache hit!)
- **Multiple users**: User A fetches tutorial → User B gets from cache
- **Component remounts**: React doesn't re-fetch on unmount/remount

---

### Layer 3: Backend Response Caching (Planned - Phase 2)

**Pattern**: Netflix, Reddit
**Location**: `apps/backend/src/infrastructure/cache/` (to be created)
**Cost**: FREE (in-memory) or $5/mo (Redis)
**Savings**: 90%+ fewer DB queries at scale

#### How It Will Work

Backend caches database query results. Multiple users share the same cached response.

```typescript
// Pseudo-code for Phase 2
async findBySlug(slug: string): Promise<Tutorial> {
  const cacheKey = `tutorial:slug:${slug}`;

  // Check cache first
  const cached = await this.cache.get(cacheKey);
  if (cached) return cached;

  // Query database
  const tutorial = await this.db.query(...);

  // Cache result for 1 hour
  await this.cache.set(cacheKey, tutorial, 3600);

  return tutorial;
}
```

#### Cache Duration Strategy

```typescript
const CACHE_DURATION = {
  userProfile: 15 * 60, // 15 minutes (can change frequently)
  tutorial: 60 * 60, // 1 hour (rarely changes)
  exercises: 60 * 60, // 1 hour (rarely changes)
  creatorStats: 24 * 60 * 60, // 24 hours (changes very slowly)
};
```

#### When It Helps

- **Popular content**: 100 users viewing same tutorial = 1 DB query
- **High traffic**: Shared cache across all users
- **Repeat visitors**: Same user loads same page multiple times

---

## Request Deduplication Deep Dive

### How to Use

Request deduplication is **automatic** for all GET requests through `apiClient`:

```typescript
import { apiClient } from '@/lib/api-client';

// These calls will be deduplicated automatically
const profile = await apiClient.get('/api/user/profile');
const tutorials = await apiClient.get('/api/v1/tutorials');
```

### What Gets Deduplicated

✅ **Deduplicated (GET requests only)**:

- `apiClient.get('/api/user/profile')`
- `apiClient.get('/api/v1/tutorials')`
- `apiClient.get('/api/v1/exercises/tutorial/123')`

❌ **NOT deduplicated (mutations)**:

- `apiClient.post('/api/exercises', data)` - Each POST is unique
- `apiClient.put('/api/tutorials/123', data)` - Each PUT is unique
- `apiClient.delete('/api/exercises/456')` - Each DELETE is unique

### Debugging

Enable debug logging to see deduplication in action:

```bash
# In browser console
localStorage.setItem('debug', 'ApiClient');

# You'll see logs like:
# "Deduplicating request (reusing in-flight request)" { url: "/api/user/profile" }
```

### Testing Deduplication

```typescript
describe('Request Deduplication', () => {
  it('should deduplicate identical GET requests', async () => {
    // Make 3 simultaneous requests for same endpoint
    const [result1, result2, result3] = await Promise.all([
      apiClient.get('/api/user/profile'),
      apiClient.get('/api/user/profile'),
      apiClient.get('/api/user/profile'),
    ]);

    // All should return same result
    expect(result1).toEqual(result2);
    expect(result2).toEqual(result3);

    // Only 1 actual HTTP request should have been made
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

---

## Common Patterns

### Pattern 1: Shared Profile Hook

**Problem**: `useAuth()` and `useUserProfile()` both fetch user data.

**Solution**: Both hooks now use `apiClient.get()`, which deduplicates the requests automatically.

```typescript
// In use-user-profile.ts
export function useUserProfile() {
  const fetchProfile = async () => {
    // Uses apiClient which has built-in deduplication
    const result = await apiClient.get<ProfileResponse>('/api/user/profile');
    setProfile(result.data);
  };

  useEffect(() => {
    fetchProfile();
  }, [user?.id]);
}
```

### Pattern 2: Conditional API Calls

**Problem**: Fetching data that might already be in props.

**Solution**: Skip API call if data already exists.

```typescript
// In CreatorInfoSection.tsx
export function CreatorInfoSection({ tutorialData }: Props) {
  const hasSubscriberCount = tutorialData?.creator_subscriber_count > 0;

  // Only fetch if we don't have subscriber count already
  const { subscriberCount } = useYouTubeChannelData(
    hasSubscriberCount ? undefined : channelUrl, // undefined = skip query
    creatorName,
  );

  // Use tutorial data if available, otherwise use API data
  const displayCount = hasSubscriberCount
    ? tutorialData.creator_subscriber_count
    : subscriberCount;
}
```

### Pattern 3: Parallel Queries with Deduplication

**Problem**: Multiple queries need to run in parallel, but some might be duplicates.

**Solution**: Use Promise.all + apiClient (automatic deduplication).

```typescript
// These will deduplicate automatically if any are identical
const [profile, tutorials, exercises, creators] = await Promise.all([
  apiClient.get('/api/user/profile'), // Deduplicated if called elsewhere
  apiClient.get('/api/v1/tutorials'), // Independent
  apiClient.get('/api/v1/exercises'), // Independent
  apiClient.get('/api/creators/stats'), // Independent
]);
```

---

## Monitoring & Metrics

### Key Metrics to Track

1. **API Call Reduction**

   ```typescript
   // Before optimization
   Network tab: 6 calls to /api/user/profile

   // After optimization
   Network tab: 1 call to /api/user/profile ✅
   Console: "Deduplicating request (reusing in-flight request)" x5
   ```

2. **Cache Hit Rate**

   ```typescript
   // React Query DevTools
   Query: ['exercises', 'tutorial-123']
   Status: Success (from cache) ✅
   Fetch Status: idle
   Data Updated At: 2 minutes ago
   ```

3. **Database Query Count**
   ```sql
   -- Monitor in Supabase dashboard
   SELECT COUNT(*) FROM logs
   WHERE timestamp > NOW() - INTERVAL '1 hour'
   AND query_type = 'SELECT';
   ```

### What to Look For

✅ **Good signs**:

- Fewer duplicate API calls in Network tab
- "Deduplicating request" logs in console
- React Query showing "from cache" in DevTools
- Lower Supabase query count in dashboard

❌ **Red flags**:

- Same API call appearing multiple times simultaneously
- React Query always showing "fetching" (not using cache)
- Hitting rate limits (429 errors)
- High Supabase query count relative to user count

---

## Best Practices

### DO ✅

1. **Always use `apiClient`** instead of raw `fetch()`

   ```typescript
   // Good
   const data = await apiClient.get('/api/endpoint');

   // Bad - no deduplication
   const response = await fetch('/api/endpoint');
   ```

2. **Set appropriate cache times** in React Query

   ```typescript
   // Good - aggressive caching for rarely-changing data
   staleTime: 30 * 60 * 1000; // 30 minutes

   // Bad - too aggressive for frequently-changing data
   staleTime: 0; // Always refetch
   ```

3. **Skip API calls when data exists**

   ```typescript
   // Good - conditional fetching
   enabled: !hasData;

   // Bad - fetch even if we have data
   enabled: true;
   ```

4. **Use React Query for data fetching**

   ```typescript
   // Good - built-in caching + deduplication
   const { data } = useQuery(['key'], fetchFn);

   // Bad - manual state management
   const [data, setData] = useState();
   useEffect(() => {
     fetch().then(setData);
   }, []);
   ```

### DON'T ❌

1. **Don't bypass apiClient for API calls**

   ```typescript
   // Bad - no deduplication, no correlation IDs, no error handling
   fetch('/api/endpoint');
   ```

2. **Don't set staleTime to 0 unnecessarily**

   ```typescript
   // Bad - defeats caching purpose
   staleTime: 0;
   ```

3. **Don't make API calls in render**

   ```typescript
   // Bad - can cause infinite loops + duplicate calls
   function Component() {
     fetch('/api/data'); // ❌
     return <div>...</div>;
   }

   // Good - use hooks
   function Component() {
     const { data } = useQuery(['data'], fetchData);
     return <div>...</div>;
   }
   ```

4. **Don't ignore React Query cache**
   ```typescript
   // Bad - forcing refetch defeats optimization
   const { data, refetch } = useQuery(['key'], fetchFn);
   useEffect(() => {
     refetch();
   }, []); // ❌
   ```

---

## Troubleshooting

### Issue: "Still seeing duplicate API calls"

**Check**:

1. Are you using `apiClient.get()` or raw `fetch()`?
2. Are calls happening simultaneously or sequentially?
3. Check React strict mode (development) - double renders are expected

**Solution**:

```typescript
// Ensure all API calls use apiClient
import { apiClient } from '@/lib/api-client';
const data = await apiClient.get('/api/endpoint');
```

### Issue: "React Query not caching"

**Check**:

1. Is `staleTime` set appropriately?
2. Are query keys consistent?
3. Is `enabled: false` preventing queries?

**Solution**:

```typescript
// Ensure consistent query keys
const { data } = useQuery({
  queryKey: ['exercises', tutorialId], // Same key = shared cache
  queryFn: () => fetchExercises(tutorialId),
  staleTime: 30 * 60 * 1000,
});
```

### Issue: "Hitting rate limits (429 errors)"

**Check**:

1. Are optimizations actually enabled?
2. Check browser Network tab for duplicate calls
3. Look for retry loops

**Solution**:

```typescript
// Don't retry on 429
retry: (failureCount, error) => {
  if (error.status === 429) return false;
  return failureCount < 3;
};
```

---

## Phase 2: Backend Caching (Roadmap)

### Planned Implementation

```typescript
// Install LRU cache
pnpm add lru-cache

// Create cache service
export class CacheService {
  private cache = new LRU({
    max: 500,              // Max 500 entries
    ttl: 1000 * 60 * 60,   // 1 hour default
  });

  get(key: string): any {
    return this.cache.get(key);
  }

  set(key: string, value: any, ttlMs?: number): void {
    this.cache.set(key, value, { ttl: ttlMs });
  }
}

// Use in repositories
async findBySlug(slug: string): Promise<Tutorial> {
  const cacheKey = `tutorial:slug:${slug}`;

  const cached = this.cache.get(cacheKey);
  if (cached) return cached;

  const tutorial = await this.db.query(...);

  this.cache.set(cacheKey, tutorial, 60 * 60 * 1000);

  return tutorial;
}
```

### Expected Impact

- **Additional 70% reduction** in database queries
- **Sub-100ms response times** for cached data
- **Shared cache across all users** (massive savings at scale)

---

## Summary

✅ **Request deduplication**: Prevents duplicate simultaneous API calls (33-50% reduction)
✅ **React Query caching**: Serves data from memory on navigation (70-90% reduction)
✅ **Conditional fetching**: Skip calls when data already exists
✅ **Cost optimization**: Save $175/month at 100k users/day
✅ **Performance boost**: Faster page loads, better UX

**Next Steps**:

1. Review Network tab to verify deduplication working
2. Check React Query DevTools to monitor cache hits
3. Monitor Supabase dashboard for query count reduction
4. Plan Phase 2 (backend caching) for additional 70% savings

---

## Related Documentation

- [Rate Limiting Guide](./RATE_LIMITING_GUIDE.md) - Handling rate limit errors
- [Correlation & Logging](./CORRELATION_AND_LOGGING.md) - Debugging API calls
- [React Query Integration](../2.%20Technical%20docs/7.%20React-Query-Integration.md) - Using React Query
- [Developer Guide](./DEVELOPER_GUIDE.md) - Overall development practices
