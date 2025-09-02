/**
 * Storage Providers Module
 * 
 * Exports all storage providers and registers them with the factory
 */

import { StorageProviderFactory, StorageProviderType } from './StorageProvider.js';
import { SupabaseProvider } from './SupabaseProvider.js';
import { LocalProvider } from './LocalProvider.js';

// Register providers with factory
StorageProviderFactory.register(StorageProviderType.SUPABASE, SupabaseProvider as any);
StorageProviderFactory.register(StorageProviderType.LOCAL, LocalProvider as any);

// Re-export everything
export * from './StorageProvider.js';
export * from './SupabaseProvider.js';
export * from './LocalProvider.js';