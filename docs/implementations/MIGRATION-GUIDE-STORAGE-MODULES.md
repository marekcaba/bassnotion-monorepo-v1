# Storage Modules Migration Guide

## Overview

This guide documents the migration from legacy storage implementations to the new modular storage architecture, specifically focusing on the transition from `SupabaseAssetClient` to `SupabaseProviderAdvanced`.

## Key Changes

### 1. Legacy Architecture (Before)

```typescript
// Direct usage of SupabaseAssetClient
import { SupabaseAssetClient } from './SupabaseAssetClient';

const storageClient = SupabaseAssetClient.getInstance(config);
await storageClient.initialize();
await storageClient.downloadAsset(bucket, path, options);
```

### 2. New Architecture (After)

```typescript
// Using SupabaseProviderAdvanced from modules
import { createSupabaseProviderAdvanced } from '../../modules/storage/providers';

const storageProvider = createSupabaseProviderAdvanced({
  supabaseUrl: config.supabaseUrl,
  supabaseKey: config.supabaseKey,
  bucketName: config.bucketName,
  // Advanced features
  enableVersioning: true,
  enableCircuitBreaker: true,
  enableBatchOperations: true,
  enableCDNOptimization: true,
});

// No explicit initialization needed
await storageProvider.download(path);
```

## Migration Example: AudioSampleManager

### Before (Using SupabaseAssetClient)

```typescript
export class AudioSampleManager {
  private storageClient: SupabaseAssetClient;

  constructor(config: AudioSampleManagerConfig) {
    this.storageClient = SupabaseAssetClient.getInstance(
      config.storageClientConfig,
    );
  }

  async initialize() {
    await this.storageClient.initialize();
  }

  async loadSample(sampleId: string) {
    const downloadResult = await this.storageClient.downloadAsset(
      metadata.bucket,
      metadata.path,
      downloadOptions,
    );
    // Process result...
  }
}
```

### After (Using SupabaseProviderAdvanced)

```typescript
export class AudioSampleManager {
  private storageProvider: SupabaseProviderAdvanced;

  constructor(config: AudioSampleManagerConfig) {
    const providerConfig: SupabaseProviderAdvancedConfig = {
      supabaseUrl: config.storageClientConfig.supabaseUrl,
      supabaseKey: config.storageClientConfig.supabaseAnonKey,
      bucketName: config.storageClientConfig.bucketName,
      defaultTimeout: 30000,
      maxRetries: 3,
      retryDelay: 1000,
      enableCDN: true,
      // Enable advanced features
      enableVersioning: true,
      enableCircuitBreaker: true,
      enableBatchOperations: true,
      enableCDNOptimization: true,
    };

    this.storageProvider = createSupabaseProviderAdvanced(providerConfig);
  }

  async initialize() {
    // Storage provider initializes automatically on first use
    // No need to explicitly initialize
  }

  async loadSample(sampleId: string) {
    const downloadResult = await this.storageProvider.download(metadata.path);

    if (!downloadResult.success || !downloadResult.data) {
      throw new Error(`Failed to download: ${downloadResult.error?.message}`);
    }
    // Process result...
  }
}
```

## New Features Available

### 1. Batch Operations

```typescript
// Load multiple samples efficiently
const results = await storageProvider.batchDownload([
  'samples/bass1.wav',
  'samples/bass2.wav',
  'samples/bass3.wav',
]);

// Upload multiple files
const uploadResults = await storageProvider.batchUpload([
  { data: file1, options: { path: 'samples/new1.wav' } },
  { data: file2, options: { path: 'samples/new2.wav' } },
]);
```

### 2. Version Management

```typescript
// Get version history
const history = await storageProvider.getVersionHistory('samples/bass.wav');

// Restore a specific version
await storageProvider.restoreVersion('samples/bass.wav', 'v1.2.3');
```

### 3. Health Monitoring

```typescript
// Check system health
const health = await storageProvider.healthCheck();
console.log(health.status); // 'healthy' | 'degraded' | 'unhealthy'

// Get detailed metrics
const metrics = storageProvider.getAdvancedMetrics();
console.log(metrics.cacheHits, metrics.averageLatency);
```

### 4. Circuit Breaker Protection

```typescript
// Automatic fault tolerance
// If storage fails repeatedly, circuit breaker opens
// preventing cascading failures
const status = storageProvider.getCircuitBreakerStatus();
console.log(status); // 'closed' | 'open' | 'half-open'
```

### 5. CDN Optimization

```typescript
// Automatic CDN routing for optimal performance
// CDN cache management
await storageProvider.purgeCDNCache(['samples/old.wav']);
```

## Migration Steps

### Step 1: Update Imports

Replace all imports of `SupabaseAssetClient` with the new provider:

```typescript
// Old
import { SupabaseAssetClient } from './storage/SupabaseAssetClient';

// New
import {
  createSupabaseProviderAdvanced,
  type SupabaseProviderAdvancedConfig,
} from '../../modules/storage/providers';
```

### Step 2: Update Configuration

Map your existing configuration to the new format:

```typescript
const providerConfig: SupabaseProviderAdvancedConfig = {
  // Basic configuration (same as before)
  supabaseUrl: oldConfig.supabaseUrl,
  supabaseKey: oldConfig.supabaseAnonKey,
  bucketName: oldConfig.bucketName,

  // New advanced features
  enableVersioning: true,
  enableCircuitBreaker: true,
  enableBatchOperations: true,
  enableCDNOptimization: true,

  // Advanced configuration
  versionStrategy: 'timestamp',
  maxVersions: 10,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000,
  batchConcurrency: 5,
  batchSize: 100,
};
```

### Step 3: Update Method Calls

Map old method calls to new ones:

| Old Method                                 | New Method                           | Notes                     |
| ------------------------------------------ | ------------------------------------ | ------------------------- |
| `downloadAsset(bucket, path, options)`     | `download(path, options)`            | Bucket is in config       |
| `uploadAsset(bucket, path, data, options)` | `upload(data, { path, ...options })` | Different parameter order |
| `deleteAsset(bucket, path)`                | `delete(path)`                       | Simpler interface         |
| `runCleanup('orphaned')`                   | Not needed                           | Handled internally        |
| `initialize()`                             | Not needed                           | Auto-initializes          |
| `dispose()`                                | Not needed                           | Auto-cleanup              |

### Step 4: Add Error Handling

The new provider returns structured results:

```typescript
const result = await storageProvider.download(path);
if (!result.success) {
  console.error('Download failed:', result.error);
  return;
}
// Use result.data
```

### Step 5: Leverage New Features

Take advantage of the enhanced capabilities:

```typescript
// Enable monitoring
const metrics = storageProvider.getAdvancedMetrics();
logger.info('Storage metrics:', metrics);

// Use batch operations for performance
const samples = await storageProvider.batchDownload(samplePaths);

// Monitor health
const health = await storageProvider.healthCheck();
if (health.status === 'unhealthy') {
  logger.error('Storage unhealthy:', health.details);
}
```

## Testing the Migration

### Unit Tests

```typescript
// Mock the new provider
vi.mock('../../../modules/storage/providers', () => ({
  createSupabaseProviderAdvanced: vi.fn(() => ({
    download: vi.fn().mockResolvedValue({
      success: true,
      data: mockData,
    }),
    // ... other methods
  })),
}));
```

### Integration Tests

```typescript
// Test with real provider
const provider = createSupabaseProviderAdvanced(testConfig);
const result = await provider.download('test.wav');
expect(result.success).toBe(true);
```

## Benefits of Migration

1. **Modular Architecture**: Separate concerns into focused modules
2. **Enhanced Reliability**: Built-in circuit breaker and retry logic
3. **Better Performance**: Batch operations and CDN optimization
4. **Improved Monitoring**: Comprehensive metrics and health checks
5. **Version Control**: Built-in asset versioning
6. **Type Safety**: Better TypeScript support
7. **Easier Testing**: Cleaner interfaces and better mocking

## Common Issues and Solutions

### Issue: Missing initialization

**Solution**: The new provider auto-initializes. Remove `await provider.initialize()` calls.

### Issue: Different method signatures

**Solution**: Refer to the method mapping table above. Parameters have been simplified.

### Issue: Missing cleanup/dispose

**Solution**: The new provider manages its own lifecycle. Remove explicit cleanup calls.

### Issue: Bucket parameter required

**Solution**: Bucket is now part of the configuration, not passed to each method.

## Rollback Plan

If you need to rollback:

1. The old `SupabaseAssetClient` is still available (though deprecated)
2. Revert your imports and method calls
3. Re-add initialization and disposal calls
4. Remove usage of new features (batch, versioning, etc.)

## Future Considerations

The modular architecture allows for:

- Easy addition of new storage providers (S3, Azure, etc.)
- Plugin-based feature extensions
- Better tree-shaking and code splitting
- Gradual migration of remaining legacy code

## Resources

- [SupabaseProviderAdvanced API Reference](./API-REFERENCE-SUPABASE-PROVIDER-ADVANCED.md)
- [Migration Plan Document](./MIGRATION-PLAN-SUPABASE-ASSET-CLIENT.md)
- [Test Examples](../../apps/frontend/src/domains/playback/services/storage/__tests__/)
