'use client';

/**
 * Story 3.16: Enhanced Audio Sample Integration
 * MetronomeSampleSelector - UI component for selecting admin-curated metronome click sounds
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';

export interface MetronomeClickSample {
  id: string;
  name: string;
  description: string;
  category: 'wood' | 'metal' | 'electronic' | 'percussion';
  url: string;
  isDefault?: boolean;
}

interface MetronomeSampleSelectorProps {
  availableSamples: MetronomeClickSample[];
  currentSample: MetronomeClickSample | null;
  isLoading: boolean;
  onSampleSelect: (sample: MetronomeClickSample) => void;
  onSamplePreview?: (sample: MetronomeClickSample) => void;
  className?: string;
}

interface SampleCardProps {
  sample: MetronomeClickSample;
  isSelected: boolean;
  isLoading: boolean;
  onSelect: () => void;
  onPreview?: () => void;
}

/**
 * Individual sample card component
 */
const SampleCard: React.FC<SampleCardProps> = ({
  sample,
  isSelected,
  isLoading,
  onSelect,
  onPreview,
}) => {
  const getCategoryColor = useCallback((category: string) => {
    switch (category) {
      case 'wood':
        return 'bg-amber-100 text-amber-800';
      case 'metal':
        return 'bg-slate-100 text-slate-800';
      case 'electronic':
        return 'bg-cyan-100 text-cyan-800';
      case 'percussion':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  return (
    <Card
      className={`p-3 cursor-pointer transition-all duration-200 hover:shadow-sm ${
        isSelected ? 'ring-2 ring-blue-500 bg-blue-50' : 'hover:bg-gray-50'
      }`}
      onClick={onSelect}
    >
      <div className="space-y-2">
        {/* Sample header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <h4 className="font-medium text-sm">{sample.name}</h4>
            <p className="text-xs text-gray-600">{sample.description}</p>
          </div>
          {sample.isDefault && (
            <Badge variant="outline" className="text-xs">
              Default
            </Badge>
          )}
        </div>

        {/* Category badge */}
        <div className="flex items-center gap-2">
          <Badge className={`text-xs ${getCategoryColor(sample.category)}`}>
            {sample.category}
          </Badge>
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
              ▶
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
};

/**
 * Main metronome sample selector component
 */
export const MetronomeSampleSelector: React.FC<
  MetronomeSampleSelectorProps
> = ({
  availableSamples,
  currentSample,
  isLoading,
  onSampleSelect,
  onSamplePreview,
  className = '',
}) => {
  const [loadingSample, setLoadingSample] = useState<string | null>(null);

  // Group samples by category
  const samplesByCategory = useMemo(() => {
    const grouped = availableSamples.reduce(
      (acc, sample) => {
        if (!acc[sample.category]) {
          acc[sample.category] = [];
        }
        acc[sample.category].push(sample);
        return acc;
      },
      {} as Record<string, MetronomeClickSample[]>,
    );

    // Sort each category alphabetically
    Object.keys(grouped).forEach((category) => {
      grouped[category].sort((a, b) => a.name.localeCompare(b.name));
    });

    return grouped;
  }, [availableSamples]);

  // Handle sample selection with loading state
  const handleSampleSelect = useCallback(
    async (sample: MetronomeClickSample) => {
      setLoadingSample(sample.id);
      try {
        await onSampleSelect(sample);
      } finally {
        setLoadingSample(null);
      }
    },
    [onSampleSelect],
  );

  // Handle sample preview
  const handleSamplePreview = useCallback(
    (sample: MetronomeClickSample) => {
      onSamplePreview?.(sample);
    },
    [onSamplePreview],
  );

  // Check if a sample is currently selected
  const isSampleSelected = useCallback(
    (sample: MetronomeClickSample) => {
      return currentSample?.id === sample.id;
    },
    [currentSample],
  );

  // Check if a sample is currently loading
  const isSampleLoading = useCallback(
    (sample: MetronomeClickSample) => {
      return loadingSample === sample.id || isLoading;
    },
    [loadingSample, isLoading],
  );

  const categoryOrder: Array<MetronomeClickSample['category']> = [
    'wood',
    'metal',
    'electronic',
    'percussion',
  ];
  const sortedCategories = categoryOrder.filter(
    (category) => samplesByCategory[category]?.length > 0,
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">Click Sounds</h3>
        {currentSample && (
          <Badge variant="outline" className="text-sm">
            {currentSample.name}
          </Badge>
        )}
      </div>

      {/* Sample categories */}
      {sortedCategories.length === 0 ? (
        <Card className="p-4 text-center">
          <p className="text-gray-500 text-sm">No click samples available</p>
          <p className="text-xs text-gray-400 mt-1">
            Admin-curated samples will appear here when available
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedCategories.map((category) => (
            <div key={category} className="space-y-2">
              {/* Category header */}
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-medium capitalize">{category}</h4>
                <Badge variant="outline" className="text-xs">
                  {samplesByCategory[category].length}
                </Badge>
              </div>

              {/* Category samples */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {samplesByCategory[category].map((sample) => (
                  <SampleCard
                    key={sample.id}
                    sample={sample}
                    isSelected={isSampleSelected(sample)}
                    isLoading={isSampleLoading(sample)}
                    onSelect={() => handleSampleSelect(sample)}
                    onPreview={() => handleSamplePreview(sample)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <Card className="p-3">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-600"></div>
            <span className="text-xs text-gray-600">
              Loading click samples...
            </span>
          </div>
        </Card>
      )}
    </div>
  );
};

export default MetronomeSampleSelector;
