'use client';

/**
 * Story 3.16: Enhanced Audio Sample Integration
 * HybridDrumKitSelector - UI component for selecting between admin-curated and Hydrogen drum kits
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';
import {
  DrumKitMetadata,
  DrumLibraryIndex,
} from '../../../../../playback/services/HybridDrumSampleManager';

interface HybridDrumKitSelectorProps {
  libraryIndex: DrumLibraryIndex | null;
  currentKit: DrumKitMetadata | null;
  isLoading: boolean;
  onKitSelect: (kitId: string, source: 'admin' | 'hydrogen') => void;
  onPreviewKit?: (kitId: string, source: 'admin' | 'hydrogen') => void;
  className?: string;
}

interface DrumKitCardProps {
  kit: DrumKitMetadata;
  isSelected: boolean;
  isLoading: boolean;
  onSelect: () => void;
  onPreview?: () => void;
}

/**
 * Individual drum kit card component
 */
const DrumKitCard: React.FC<DrumKitCardProps> = ({
  kit,
  isSelected,
  isLoading,
  onSelect,
  onPreview,
}) => {
  const formatSize = useCallback((bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)}MB`;
  }, []);

  const getQualityColor = useCallback((quality: string) => {
    switch (quality) {
      case 'studio':
        return 'bg-green-100 text-green-800';
      case 'performance':
        return 'bg-blue-100 text-blue-800';
      case 'practice':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getStyleColor = useCallback((style: string) => {
    switch (style) {
      case 'rock':
        return 'bg-red-100 text-red-800';
      case 'jazz':
        return 'bg-purple-100 text-purple-800';
      case 'electronic':
        return 'bg-cyan-100 text-cyan-800';
      case 'latin':
        return 'bg-orange-100 text-orange-800';
      case 'hip-hop':
        return 'bg-indigo-100 text-indigo-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  return (
    <Card
      className={`p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
      }`}
      onClick={onSelect}
    >
      <div className="space-y-3">
        {/* Kit header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h3 className="font-semibold text-sm">{kit.name}</h3>
            <p className="text-xs text-gray-600 line-clamp-2">
              {kit.description}
            </p>
          </div>
          {kit.source === 'hydrogen' && (
            <Badge variant="outline" className="text-xs">
              Hydrogen
            </Badge>
          )}
        </div>

        {/* Kit metadata */}
        <div className="flex flex-wrap gap-1">
          <Badge className={`text-xs ${getQualityColor(kit.quality)}`}>
            {kit.quality}
          </Badge>
          <Badge className={`text-xs ${getStyleColor(kit.style)}`}>
            {kit.style}
          </Badge>
        </div>

        {/* Kit stats */}
        <div className="flex justify-between text-xs text-gray-500">
          <span>{kit.sampleCount} samples</span>
          <span>{formatSize(kit.size)}</span>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isSelected ? 'default' : 'outline'}
            onClick={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            disabled={isLoading}
            className="flex-1 text-xs"
          >
            {isLoading ? 'Loading...' : isSelected ? 'Selected' : 'Select'}
          </Button>
          {onPreview && (
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                onPreview();
              }}
              className="text-xs px-2"
            >
              Preview
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

/**
 * Main hybrid drum kit selector component
 */
export const HybridDrumKitSelector: React.FC<HybridDrumKitSelectorProps> = ({
  libraryIndex,
  currentKit,
  isLoading,
  onKitSelect,
  onPreviewKit,
  className = '',
}) => {
  const [activeTab, setActiveTab] = useState<'hydrogen' | 'admin'>('hydrogen');
  const [loadingKit, setLoadingKit] = useState<string | null>(null);

  // Memoized kit lists
  const hydrogenKits = useMemo(
    () => libraryIndex?.hydrogenKits || [],
    [libraryIndex?.hydrogenKits],
  );

  const adminKits = useMemo(
    () => libraryIndex?.adminKits || [],
    [libraryIndex?.adminKits],
  );

  // Handle kit selection with loading state
  const handleKitSelect = useCallback(
    async (kitId: string, source: 'admin' | 'hydrogen') => {
      setLoadingKit(kitId);
      try {
        await onKitSelect(kitId, source);
      } finally {
        setLoadingKit(null);
      }
    },
    [onKitSelect],
  );

  // Handle kit preview
  const handleKitPreview = useCallback(
    (kitId: string, source: 'admin' | 'hydrogen') => {
      onPreviewKit?.(kitId, source);
    },
    [onPreviewKit],
  );

  // Check if a kit is currently selected
  const isKitSelected = useCallback(
    (kit: DrumKitMetadata) => {
      return currentKit?.id === kit.id && currentKit?.source === kit.source;
    },
    [currentKit],
  );

  // Check if a kit is currently loading
  const isKitLoading = useCallback(
    (kit: DrumKitMetadata) => {
      return loadingKit === kit.id || isLoading;
    },
    [loadingKit, isLoading],
  );

  // Auto-switch to tab with selected kit
  useEffect(() => {
    if (currentKit && currentKit.source !== activeTab) {
      setActiveTab(currentKit.source);
    }
  }, [currentKit, activeTab]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Drum Library</h2>
        {currentKit && (
          <Badge variant="outline" className="text-sm">
            {currentKit.name}
          </Badge>
        )}
      </div>

      {/* Kit source tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'hydrogen' | 'admin')}
      >
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="hydrogen" className="text-sm">
            Professional Kits ({hydrogenKits.length})
          </TabsTrigger>
          <TabsTrigger value="admin" className="text-sm">
            Curated Samples ({adminKits.length})
          </TabsTrigger>
        </TabsList>

        {/* Hydrogen kits */}
        <TabsContent value="hydrogen" className="space-y-3">
          {hydrogenKits.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-gray-500">No Hydrogen kits available</p>
              <p className="text-sm text-gray-400 mt-1">
                Professional drum kits will appear here once loaded
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {hydrogenKits.map((kit) => (
                <DrumKitCard
                  key={kit.id}
                  kit={kit}
                  isSelected={isKitSelected(kit)}
                  isLoading={isKitLoading(kit)}
                  onSelect={() => handleKitSelect(kit.id, 'hydrogen')}
                  onPreview={() => handleKitPreview(kit.id, 'hydrogen')}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Admin curated kits */}
        <TabsContent value="admin" className="space-y-3">
          {adminKits.length === 0 ? (
            <Card className="p-6 text-center">
              <p className="text-gray-500">
                No admin-curated samples available
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Custom samples uploaded by admins will appear here
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {adminKits.map((kit) => (
                <DrumKitCard
                  key={kit.id}
                  kit={kit}
                  isSelected={isKitSelected(kit)}
                  isLoading={isKitLoading(kit)}
                  onSelect={() => handleKitSelect(kit.id, 'admin')}
                  onPreview={() => handleKitPreview(kit.id, 'admin')}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Loading state */}
      {isLoading && (
        <Card className="p-4">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">
              Loading drum library...
            </span>
          </div>
        </Card>
      )}
    </div>
  );
};

export default HybridDrumKitSelector;
