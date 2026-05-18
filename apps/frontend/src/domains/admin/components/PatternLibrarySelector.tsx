'use client';

/**
 * PatternLibrarySelector Component
 * Modal for browsing and selecting drum patterns from the library
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogPortal,
  DialogOverlay,
} from '@/shared/components/ui/dialog';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import { Badge } from '@/shared/components/ui/badge';
import {
  Search,
  Music,
  Clock,
  BarChart3,
  Star,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  usePatternLibrary,
  useRecordPatternUsage,
} from '../hooks/usePatternLibrary.js';
import {
  convertLibraryPatternToDrumHits,
  getPatternSummary,
} from '../utils/patternConverter.js';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import type {
  PatternLibraryItem,
  PatternGenre,
  PatternDifficulty,
  DrumHit,
} from '@bassnotion/contracts';
import { GENRE_DISPLAY_NAMES, GENRE_COLORS } from '@bassnotion/contracts';

interface PatternLibrarySelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (drumHits: DrumHit[], pattern: PatternLibraryItem) => void;
  /** Target number of bars for the exercise */
  targetBars?: number;
  /** Target BPM for the exercise */
  targetBpm?: number;
  /** Current time signature for filtering */
  timeSignature?: { numerator: number; denominator: number };
}

/**
 * Difficulty badge color mapping
 */
const DIFFICULTY_COLORS: Record<PatternDifficulty, string> = {
  beginner: 'bg-green-100 text-green-700 border-green-300',
  intermediate: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  advanced: 'bg-red-100 text-red-700 border-red-300',
};

/**
 * Pattern card component for displaying individual patterns
 */
function PatternCard({
  pattern,
  onSelect,
  isSelected,
  onHover,
}: {
  pattern: PatternLibraryItem;
  onSelect: () => void;
  isSelected: boolean;
  onHover: () => void;
}) {
  const summary = useMemo(() => getPatternSummary(pattern), [pattern]);

  return (
    <div
      className={`
        relative p-4 rounded-lg border-2 cursor-pointer transition-all
        hover:shadow-md hover:border-blue-400
        ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'}
      `}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      {/* Featured badge */}
      {pattern.isFeatured && (
        <div className="absolute -top-2 -right-2">
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
        </div>
      )}

      {/* Pattern name and genre */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-gray-900 line-clamp-1">
          {pattern.name}
        </h3>
        <Badge
          variant="outline"
          className="shrink-0 text-xs"
          style={{
            backgroundColor: `${GENRE_COLORS[pattern.genre]}20`,
            borderColor: GENRE_COLORS[pattern.genre],
            color: GENRE_COLORS[pattern.genre],
          }}
        >
          {GENRE_DISPLAY_NAMES[pattern.genre]}
        </Badge>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 line-clamp-2 mb-3">
        {pattern.description}
      </p>

      {/* Stats row */}
      <div className="flex items-center gap-3 text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <Music className="h-3 w-3" />
          <span>
            {pattern.timeSignature.numerator}/
            {pattern.timeSignature.denominator}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>
            {pattern.bars} {pattern.bars === 1 ? 'bar' : 'bars'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <BarChart3 className="h-3 w-3" />
          <span>{summary.hitCount} hits</span>
        </div>
      </div>

      {/* Difficulty and BPM range */}
      <div className="flex items-center justify-between mt-3">
        <Badge
          variant="outline"
          className={`text-xs ${DIFFICULTY_COLORS[pattern.difficulty]}`}
        >
          {pattern.difficulty}
        </Badge>
        <span className="text-xs text-gray-500">
          {pattern.bpmRange.min}-{pattern.bpmRange.max} BPM
        </span>
      </div>

      {/* Tags */}
      {pattern.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {pattern.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded"
            >
              {tag}
            </span>
          ))}
          {pattern.tags.length > 3 && (
            <span className="text-xs text-gray-400">
              +{pattern.tags.length - 3}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function PatternLibrarySelector({
  isOpen,
  onClose,
  onSelect,
  targetBars,
  targetBpm,
  timeSignature,
}: PatternLibrarySelectorProps) {
  const { correlationId, logger } = useCorrelation('PatternLibrarySelector');

  // Filter state
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState<PatternGenre | 'all'>('all');
  const [difficulty, setDifficulty] = useState<PatternDifficulty | 'all'>(
    'all',
  );
  const [page, setPage] = useState(1);
  const [selectedPatternId, setSelectedPatternId] = useState<string | null>(
    null,
  );

  const ITEMS_PER_PAGE = 12;

  // Build filter object
  const filter = useMemo(
    () => ({
      search: search || undefined,
      genre: genre !== 'all' ? genre : undefined,
      difficulty: difficulty !== 'all' ? difficulty : undefined,
      timeSignatureNumerator: timeSignature?.numerator,
      timeSignatureDenominator: timeSignature?.denominator,
      bpm: targetBpm,
      page,
      limit: ITEMS_PER_PAGE,
      sortBy: 'usageCount' as const,
      sortOrder: 'desc' as const,
    }),
    [search, genre, difficulty, timeSignature, targetBpm, page],
  );

  // Fetch patterns
  const { data, isLoading, isError, error } = usePatternLibrary(filter, isOpen);
  const recordUsage = useRecordPatternUsage();

  // Handle pattern selection
  const handleSelectPattern = useCallback(
    (pattern: PatternLibraryItem) => {
      logger.info('Pattern selected', {
        correlationId,
        patternId: pattern.id,
        patternName: pattern.name,
      });

      // Convert pattern to DrumHit array
      const drumHits = convertLibraryPatternToDrumHits(pattern, {
        targetBars,
        targetBpm,
        regenerateIds: true,
      });

      // Record usage (non-blocking)
      recordUsage.mutate(pattern.id);

      // Call the onSelect callback
      onSelect(drumHits, pattern);
      onClose();
    },
    [
      logger,
      correlationId,
      targetBars,
      targetBpm,
      recordUsage,
      onSelect,
      onClose,
    ],
  );

  // Handle pattern hover (for preview)
  const handlePatternHover = useCallback((patternId: string) => {
    setSelectedPatternId(patternId);
  }, []);

  // Reset filters
  const handleResetFilters = useCallback(() => {
    setSearch('');
    setGenre('all');
    setDifficulty('all');
    setPage(1);
  }, []);

  // Pagination
  const totalPages = data ? Math.ceil(data.total / ITEMS_PER_PAGE) : 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogOverlay className="z-[100]" />
        <DialogPrimitive.Content className="fixed left-[50%] top-[50%] z-[100] w-full translate-x-[-50%] translate-y-[-50%] gap-4 border bg-white dark:bg-gray-900 p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg sm:max-w-[900px] max-h-[85vh] overflow-hidden flex flex-col">
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground z-10">
            <span className="h-4 w-4">✕</span>
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Music className="h-5 w-5 text-blue-600" />
              Pattern Library
            </DialogTitle>
          </DialogHeader>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 p-4 bg-gray-50 rounded-lg">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search patterns..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>

            {/* Genre filter */}
            <Select
              value={genre}
              onValueChange={(value) => {
                setGenre(value as PatternGenre | 'all');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Genre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genres</SelectItem>
                {Object.entries(GENRE_DISPLAY_NAMES).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Difficulty filter */}
            <Select
              value={difficulty}
              onValueChange={(value) => {
                setDifficulty(value as PatternDifficulty | 'all');
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Difficulty" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                <SelectItem value="beginner">Beginner</SelectItem>
                <SelectItem value="intermediate">Intermediate</SelectItem>
                <SelectItem value="advanced">Advanced</SelectItem>
              </SelectContent>
            </Select>

            {/* Reset button */}
            <Button variant="ghost" size="sm" onClick={handleResetFilters}>
              Reset
            </Button>
          </div>

          {/* Context info */}
          {(targetBars || targetBpm || timeSignature) && (
            <div className="flex items-center gap-2 text-sm text-gray-600 px-1">
              <span>Showing patterns compatible with:</span>
              {targetBars && (
                <Badge variant="secondary">{targetBars} bars</Badge>
              )}
              {targetBpm && <Badge variant="secondary">{targetBpm} BPM</Badge>}
              {timeSignature && (
                <Badge variant="secondary">
                  {timeSignature.numerator}/{timeSignature.denominator}
                </Badge>
              )}
            </div>
          )}

          {/* Pattern grid */}
          <div className="flex-1 overflow-y-auto min-h-[300px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <span className="ml-2 text-gray-600">Loading patterns...</span>
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center h-full text-red-600">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p>Failed to load patterns</p>
                <p className="text-sm text-gray-500">
                  {error instanceof Error ? error.message : 'Unknown error'}
                </p>
              </div>
            ) : data?.patterns.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Music className="h-12 w-12 mb-3 opacity-30" />
                <p className="font-medium">No patterns found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-1">
                {data?.patterns.map((pattern) => (
                  <PatternCard
                    key={pattern.id}
                    pattern={pattern}
                    isSelected={selectedPatternId === pattern.id}
                    onSelect={() => handleSelectPattern(pattern)}
                    onHover={() => handlePatternHover(pattern.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {data && data.total > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-sm text-gray-500">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1}-
                {Math.min(page * ITEMS_PER_PAGE, data.total)} of {data.total}{' '}
                patterns
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="text-sm text-gray-600 px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
