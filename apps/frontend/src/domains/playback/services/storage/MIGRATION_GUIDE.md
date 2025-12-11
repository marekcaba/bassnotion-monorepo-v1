# SupabaseAssetClient Migration Guide

## Overview

The SupabaseAssetClient has been refactored from a 3,301-line god object into a ~400-line facade that delegates to modular, reusable services. This migration guide helps you transition from the old implementation to the new architecture.

## Architecture Changes

### Before (God Object)

```
SupabaseAssetClient (3,301 lines)
├── Connection Management
├── Authentication
├── Security Monitoring
├── CDN Optimization
├── Health Monitoring
├── Performance Analytics
├── Error Recovery
└── Bucket Management
```

### After (Modular Architecture)

```
SupabaseAssetClient (Facade ~400 lines)
├── Shared Infrastructure (/shared/infrastructure/storage/)
│   ├── SupabaseClientManager (connection pooling)
│   ├── FileStorageService (basic storage operations)
│   ├── AuthenticationManager (auth & tokens)
│   ├── SecurityMonitor (security tracking)
│   ├── CDNService (CDN optimization)
│   └── MonitoringService (health & performance)
│
└── Playback Domain Adapters (/domains/playback/services/storage/)
    ├── AudioStorageService (audio-specific features)
    ├── PlaybackAuthenticationManager (playback auth)
    ├── PlaybackCDNService (audio CDN optimization)
    └── PlaybackMonitoringService (audio monitoring)
```

## Migration Steps

### Step 1: Update Imports (No Breaking Changes)

The facade maintains the same public API, so existing code continues to work:

```typescript
// Old import - STILL WORKS
import { SupabaseAssetClient } from '@/domains/playback/services/storage/SupabaseAssetClient';

// New import for facade
import { SupabaseAssetClient } from '@/domains/playback/services/storage/SupabaseAssetClientFacade';
```

### Step 2: Gradual Migration to Modular Services

For new features, use the modular services directly:

```typescript
// OLD: Everything through SupabaseAssetClient
const client = SupabaseAssetClient.getInstance(config);
await client.downloadAsset('sample.mp3');
const metrics = client.getMetrics();

// NEW: Use specific services
import { AudioStorageService } from '@/domains/playback/services/storage/AudioStorageService';
import { PlaybackMonitoringService } from '@/domains/playback/services/storage/monitoring';

const storage = new AudioStorageService(storageService);
const monitoring = new PlaybackMonitoringService(monitoringConfig);

await storage.downloadAudio('sample.mp3');
const metrics = monitoring.getPlaybackMetrics();
```

### Step 3: Service-by-Service Migration

#### Storage Operations

```typescript
// OLD
const client = SupabaseAssetClient.getInstance(config);
await client.uploadAsset('path/to/file', data);
await client.downloadAsset('path/to/file');
await client.deleteAsset('path/to/file');

// NEW
import { AudioStorageService } from '@/domains/playback/services/storage/AudioStorageService';
const storage = new AudioStorageService(fileStorageService);
await storage.upload('path/to/file', data);
await storage.downloadAudio('path/to/file');
await storage.delete('path/to/file');
```

#### Authentication

```typescript
// OLD (embedded in SupabaseAssetClient)
// Authentication was automatic

// NEW
import { PlaybackAuthenticationManager } from '@/domains/playback/services/storage/auth';
const authManager = new PlaybackAuthenticationManager(
  config,
  supabaseClient,
  metrics,
);
await authManager.authenticate();
const headers = await authManager.getPlaybackAuthHeaders();
```

#### CDN Optimization

```typescript
// OLD
const client = SupabaseAssetClient.getInstance(config);
// CDN was automatic in downloadAsset

// NEW
import { PlaybackCDNService } from '@/domains/playback/services/storage/cdn';
const cdn = new PlaybackCDNService(cdnConfig);
const optimalUrl = await cdn.getOptimalAudioEndpoint('sample.mp3', 'high');
```

#### Monitoring

```typescript
// OLD
const client = SupabaseAssetClient.getInstance(config);
const health = await client.getHealthStatus();

// NEW
import { PlaybackMonitoringService } from '@/domains/playback/services/storage/monitoring';
const monitoring = new PlaybackMonitoringService(config);
const health = await monitoring.getPlaybackHealthStatus();
const metrics = monitoring.getPlaybackMetrics();
```

## Benefits of Migration

1. **Reduced Complexity**: From 3,301 lines to ~400 lines in the facade
2. **Reusability**: Shared infrastructure can be used by other domains
3. **Testability**: Each service can be tested independently
4. **Maintainability**: Clear separation of concerns
5. **Performance**: Better resource management with specialized services
6. **Type Safety**: Stronger TypeScript types with focused interfaces

## Deprecation Timeline

1. **Current**: Facade available, original still works
2. **Next Minor Version**: Deprecation warnings added
3. **Next Major Version**: Original SupabaseAssetClient removed

## Getting Help

- See the [shared infrastructure documentation](/apps/frontend/src/shared/infrastructure/storage/README.md)
- Check domain adapter examples in other domains
- Review test files for usage examples

## Common Issues

### Issue: "Cannot find module" errors

**Solution**: Update your imports to use the facade or modular services

### Issue: Missing authentication

**Solution**: Initialize PlaybackAuthenticationManager if using services directly

### Issue: CDN not optimizing

**Solution**: Initialize PlaybackCDNService and call initialize()

### Issue: No monitoring data

**Solution**: Start PlaybackMonitoringService with `.start()`
