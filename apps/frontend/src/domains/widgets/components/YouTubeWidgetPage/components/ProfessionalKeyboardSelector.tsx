'use client';

/**
 * Story 3.16: Enhanced Audio Sample Integration
 * ProfessionalKeyboardSelector - UI component for selecting professional keyboard sounds
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';

export interface KeyboardInstrument {
  id: string;
  name: string;
  description: string;
  category: 'piano' | 'electric-piano' | 'organ' | 'synthesizer';
  quality: 'exceptional' | 'professional' | 'standard';
  size: number; // bytes
  sampleCount: number;
  brand?: string;
  isDefault?: boolean;
  previewUrl?: string;
}

interface ProfessionalKeyboardSelectorProps {
  availableInstruments: KeyboardInstrument[];
  currentInstrument: KeyboardInstrument | null;
  isLoading: boolean;
  onInstrumentSelect: (instrument: KeyboardInstrument) => void;
  onInstrumentPreview?: (instrument: KeyboardInstrument) => void;
  className?: string;
}

interface InstrumentCardProps {
  instrument: KeyboardInstrument;
  isSelected: boolean;
  isLoading: boolean;
  onSelect: () => void;
  onPreview?: () => void;
}

/**
 * Individual instrument card component
 */
const InstrumentCard: React.FC<InstrumentCardProps> = ({
  instrument,
  isSelected,
  isLoading,
  onSelect,
  onPreview,
}) => {
  const formatSize = useCallback((bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)}MB`;
  }, []);

  const getQualityColor = useCallback((quality: string) => {
    switch (quality) {
      case 'exceptional':
        return 'bg-emerald-100 text-emerald-800';
      case 'professional':
        return 'bg-blue-100 text-blue-800';
      case 'standard':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }, []);

  const getCategoryIcon = useCallback((category: string) => {
    switch (category) {
      case 'piano':
        return '🎹';
      case 'electric-piano':
        return '⚡';
      case 'organ':
        return '🎵';
      case 'synthesizer':
        return '🎛️';
      default:
        return '🎹';
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
        {/* Instrument header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-lg">
                {getCategoryIcon(instrument.category)}
              </span>
              <h3 className="font-semibold text-sm">{instrument.name}</h3>
            </div>
            <p className="text-xs text-gray-600 line-clamp-2">
              {instrument.description}
            </p>
            {instrument.brand && (
              <p className="text-xs text-gray-500">by {instrument.brand}</p>
            )}
          </div>
          {instrument.isDefault && (
            <Badge variant="outline" className="text-xs">
              Default
            </Badge>
          )}
        </div>

        {/* Quality and metadata */}
        <div className="flex flex-wrap gap-1">
          <Badge className={`text-xs ${getQualityColor(instrument.quality)}`}>
            {instrument.quality}
          </Badge>
        </div>

        {/* Instrument stats */}
        <div className="flex justify-between text-xs text-gray-500">
          <span>{instrument.sampleCount} samples</span>
          <span>{formatSize(instrument.size)}</span>
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
          {onPreview && instrument.previewUrl && (
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
 * Main professional keyboard selector component
 */
export const ProfessionalKeyboardSelector: React.FC<
  ProfessionalKeyboardSelectorProps
> = ({
  availableInstruments,
  currentInstrument,
  isLoading,
  onInstrumentSelect,
  onInstrumentPreview,
  className = '',
}) => {
  const [activeTab, setActiveTab] =
    useState<KeyboardInstrument['category']>('piano');
  const [loadingInstrument, setLoadingInstrument] = useState<string | null>(
    null,
  );

  // Group instruments by category
  const instrumentsByCategory = useMemo(() => {
    if (!availableInstruments || !Array.isArray(availableInstruments)) {
      return {} as Record<KeyboardInstrument['category'], KeyboardInstrument[]>;
    }
    const grouped = availableInstruments.reduce(
      (acc, instrument) => {
        if (!acc[instrument.category]) {
          acc[instrument.category] = [];
        }
        acc[instrument.category].push(instrument);
        return acc;
      },
      {} as Record<KeyboardInstrument['category'], KeyboardInstrument[]>,
    );

    // Sort each category by quality and name
    Object.keys(grouped).forEach((category) => {
      grouped[category as KeyboardInstrument['category']].sort((a, b) => {
        // First by quality (exceptional > professional > standard)
        const qualityOrder = { exceptional: 3, professional: 2, standard: 1 };
        const qualityDiff = qualityOrder[b.quality] - qualityOrder[a.quality];
        if (qualityDiff !== 0) return qualityDiff;

        // Then by name
        return a.name.localeCompare(b.name);
      });
    });

    return grouped;
  }, [availableInstruments]);

  // Handle instrument selection with loading state
  const handleInstrumentSelect = useCallback(
    async (instrument: KeyboardInstrument) => {
      setLoadingInstrument(instrument.id);
      try {
        await onInstrumentSelect(instrument);
      } finally {
        setLoadingInstrument(null);
      }
    },
    [onInstrumentSelect],
  );

  // Handle instrument preview
  const handleInstrumentPreview = useCallback(
    (instrument: KeyboardInstrument) => {
      onInstrumentPreview?.(instrument);
    },
    [onInstrumentPreview],
  );

  // Check if an instrument is currently selected
  const isInstrumentSelected = useCallback(
    (instrument: KeyboardInstrument) => {
      return currentInstrument?.id === instrument.id;
    },
    [currentInstrument],
  );

  // Check if an instrument is currently loading
  const isInstrumentLoading = useCallback(
    (instrument: KeyboardInstrument) => {
      return loadingInstrument === instrument.id || isLoading;
    },
    [loadingInstrument, isLoading],
  );

  // Auto-switch to tab with selected instrument
  React.useEffect(() => {
    if (currentInstrument && currentInstrument.category !== activeTab) {
      setActiveTab(currentInstrument.category);
    }
  }, [currentInstrument, activeTab]);

  const categoryNames = {
    piano: 'Piano',
    'electric-piano': 'Electric Piano',
    organ: 'Organ',
    synthesizer: 'Synthesizer',
  };

  const categories: KeyboardInstrument['category'][] = [
    'piano',
    'electric-piano',
    'organ',
    'synthesizer',
  ];
  const availableCategories = categories.filter(
    (cat) => instrumentsByCategory[cat]?.length > 0,
  );

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Professional Keyboards</h2>
        {currentInstrument && (
          <Badge variant="outline" className="text-sm">
            {currentInstrument.name}
          </Badge>
        )}
      </div>

      {/* Instrument category tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as KeyboardInstrument['category'])
        }
      >
        <TabsList className="grid w-full grid-cols-4">
          {availableCategories.map((category) => (
            <TabsTrigger key={category} value={category} className="text-xs">
              {categoryNames[category]} (
              {instrumentsByCategory[category]?.length || 0})
            </TabsTrigger>
          ))}
        </TabsList>

        {availableCategories.map((category) => (
          <TabsContent key={category} value={category} className="space-y-3">
            {instrumentsByCategory[category]?.length === 0 ? (
              <Card className="p-6 text-center">
                <p className="text-gray-500">
                  No {categoryNames[category].toLowerCase()} instruments
                  available
                </p>
                <p className="text-sm text-gray-400 mt-1">
                  Professional instruments will appear here once loaded
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {instrumentsByCategory[category]?.map((instrument) => (
                  <InstrumentCard
                    key={instrument.id}
                    instrument={instrument}
                    isSelected={isInstrumentSelected(instrument)}
                    isLoading={isInstrumentLoading(instrument)}
                    onSelect={() => handleInstrumentSelect(instrument)}
                    onPreview={() => handleInstrumentPreview(instrument)}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Loading state */}
      {isLoading && (
        <Card className="p-4">
          <div className="flex items-center justify-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">
              Loading professional keyboards...
            </span>
          </div>
        </Card>
      )}
    </div>
  );
};

export default ProfessionalKeyboardSelector;
