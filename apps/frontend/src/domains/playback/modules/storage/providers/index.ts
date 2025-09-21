/**
 * Storage Providers Module
 *
 * Exports all storage providers and registers them with the factory
 */

import {
  StorageProviderFactory,
  StorageProviderType,
} from './StorageProvider.js';
import { SupabaseProvider } from './SupabaseProvider.js';
import { LocalProvider } from './LocalProvider.js';

// Register providers with factory
StorageProviderFactory.register(
  StorageProviderType.SUPABASE,
  SupabaseProvider as any,
);
StorageProviderFactory.register(
  StorageProviderType.LOCAL,
  LocalProvider as any,
);

// Re-export base interface and types from StorageProvider
export type { StorageProvider } from './StorageProvider.js';
export type {
  StorageResult,
  UploadOptions,
  DownloadOptions,
  ListOptions,
  StorageObject,
} from './StorageProvider.js';

// Re-export classes and enums from StorageProvider
export { StorageProviderFactory } from './StorageProvider.js';
export { StorageProviderType } from './StorageProvider.js';

// Re-export provider implementations with their own types
export { SupabaseProvider } from './SupabaseProvider.js';
export { LocalProvider } from './LocalProvider.js';
export {
  SupabaseProviderAdvanced,
  createSupabaseProviderAdvanced,
} from './SupabaseProviderAdvanced.js';

// Re-export provider-specific types with prefixes to avoid conflicts
export type {
  StorageResult as SupabaseStorageResult,
  UploadOptions as SupabaseUploadOptions,
  DownloadOptions as SupabaseDownloadOptions,
  ListOptions as SupabaseListOptions,
  StorageObject as SupabaseStorageObject,
} from './SupabaseProvider.js';

export type {
  SupabaseProviderAdvancedConfig,
  AdvancedStorageMetrics,
} from './SupabaseProviderAdvanced.js';

export type {
  LocalStorageResult,
  LocalStorageObject,
} from './LocalProvider.js';
