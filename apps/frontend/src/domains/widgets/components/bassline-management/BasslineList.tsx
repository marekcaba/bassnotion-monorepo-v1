'use client';

import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Badge } from '@/shared/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';
import { useToast } from '@/shared/hooks/use-toast';
import { UserBasslinesAPI } from '../../api/user-basslines';
import type {
  SavedBassline,
  BasslineListFilters,
  ExerciseDifficulty,
} from '@bassnotion/contracts';

interface BasslineListProps {
  onLoadBassline?: (bassline: SavedBassline) => void;
  onEditBassline?: (bassline: SavedBassline) => void;
  refreshTrigger?: number; // For external refresh
}

export function BasslineList({
  onLoadBassline,
  onEditBassline,
  refreshTrigger = 0,
}: BasslineListProps) {
  const [basslines, setBasslines] = useState<SavedBassline[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<
    ExerciseDifficulty | 'all'
  >('all');
  const [sortBy, setSortBy] = useState<
    'name' | 'createdAt' | 'updatedAt' | 'difficulty'
  >('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedBasslines, setSelectedBasslines] = useState<Set<string>>(
    new Set(),
  );

  const { toast } = useToast();

  const limit = 10; // Items per page

  const loadBasslines = async () => {
    setIsLoading(true);
    try {
      const filters: Partial<BasslineListFilters> = {
        search: searchTerm || undefined,
        difficulty:
          selectedDifficulty !== 'all' ? selectedDifficulty : undefined,
        sortBy,
        sortOrder,
        page,
        limit,
      };

      const response = await UserBasslinesAPI.getUserBasslines(filters);
      setBasslines(response.basslines);
      setTotal(response.total);
    } catch (error: any) {
      console.error('Error loading basslines:', error);
      toast({
        title: 'Error',
        description: 'Failed to load basslines',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBasslines();
  }, [searchTerm, selectedDifficulty, sortBy, sortOrder, page, refreshTrigger]);

  const handleDelete = async (basslineId: string) => {
    if (
      !confirm(
        'Are you sure you want to delete this bassline? This action cannot be undone.',
      )
    ) {
      return;
    }

    try {
      await UserBasslinesAPI.deleteBassline(basslineId);
      toast({
        title: 'Success',
        description: 'Bassline deleted successfully',
        variant: 'default',
      });
      loadBasslines(); // Refresh list
    } catch (error: any) {
      console.error('Error deleting bassline:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete bassline',
        variant: 'destructive',
      });
    }
  };

  const handleDuplicate = async (bassline: SavedBassline) => {
    const newName = prompt(
      `Enter name for duplicated bassline:`,
      `${bassline.name} (Copy)`,
    );
    if (!newName) return;

    try {
      await UserBasslinesAPI.duplicateBassline(bassline.id, {
        newName,
        includeDescription: true,
      });
      toast({
        title: 'Success',
        description: 'Bassline duplicated successfully',
        variant: 'default',
      });
      loadBasslines(); // Refresh list
    } catch (error: any) {
      console.error('Error duplicating bassline:', error);
      toast({
        title: 'Error',
        description: 'Failed to duplicate bassline',
        variant: 'destructive',
      });
    }
  };

  const handleRename = async (bassline: SavedBassline) => {
    const newName = prompt(
      `Enter new name for "${bassline.name}":`,
      bassline.name,
    );
    if (!newName || newName === bassline.name) return;

    try {
      await UserBasslinesAPI.renameBassline(bassline.id, {
        newName,
      });
      toast({
        title: 'Success',
        description: 'Bassline renamed successfully',
        variant: 'default',
      });
      loadBasslines(); // Refresh list
    } catch (error: any) {
      console.error('Error renaming bassline:', error);
      toast({
        title: 'Error',
        description: 'Failed to rename bassline',
        variant: 'destructive',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedBasslines.size === 0) return;

    if (
      !confirm(
        `Are you sure you want to delete ${selectedBasslines.size} bassline(s)? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await Promise.all(
        Array.from(selectedBasslines).map((id) =>
          UserBasslinesAPI.deleteBassline(id),
        ),
      );
      toast({
        title: 'Success',
        description: `${selectedBasslines.size} bassline(s) deleted successfully`,
        variant: 'default',
      });
      setSelectedBasslines(new Set());
      loadBasslines();
    } catch (error: any) {
      console.error('Error in bulk delete:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete some basslines',
        variant: 'destructive',
      });
    }
  };

  const toggleBasslineSelection = (basslineId: string) => {
    const newSelection = new Set(selectedBasslines);
    if (newSelection.has(basslineId)) {
      newSelection.delete(basslineId);
    } else {
      newSelection.add(basslineId);
    }
    setSelectedBasslines(newSelection);
  };

  const selectAllBasslines = () => {
    if (selectedBasslines.size === basslines.length) {
      setSelectedBasslines(new Set());
    } else {
      setSelectedBasslines(new Set(basslines.map((b) => b.id)));
    }
  };

  const getDifficultyColor = (difficulty: ExerciseDifficulty) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800';
      case 'advanced':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            placeholder="Search basslines..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={selectedDifficulty}
            onChange={(e) =>
              setSelectedDifficulty(
                e.target.value as ExerciseDifficulty | 'all',
              )
            }
          >
            <option value="all">All Difficulties</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>

          <select
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [newSortBy, newSortOrder] = e.target.value.split('-');
              setSortBy(newSortBy as typeof sortBy);
              setSortOrder(newSortOrder as typeof sortOrder);
            }}
          >
            <option value="updatedAt-desc">Recently Updated</option>
            <option value="createdAt-desc">Recently Created</option>
            <option value="name-asc">Name A-Z</option>
            <option value="name-desc">Name Z-A</option>
            <option value="difficulty-asc">Difficulty (Easy First)</option>
            <option value="difficulty-desc">Difficulty (Hard First)</option>
          </select>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedBasslines.size > 0 && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
          <span className="text-sm text-blue-800">
            {selectedBasslines.size} bassline(s) selected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkDelete}
            className="text-red-600 hover:text-red-700"
          >
            Delete Selected
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedBasslines(new Set())}
          >
            Clear Selection
          </Button>
        </div>
      )}

      {/* Selection Controls */}
      {basslines.length > 0 && (
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={selectedBasslines.size === basslines.length}
            onChange={selectAllBasslines}
          />
          <span className="text-sm text-gray-600">
            Select all ({basslines.length} basslines)
          </span>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="text-center py-8">
          <div className="text-gray-500">Loading basslines...</div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && basslines.length === 0 && (
        <div className="text-center py-8">
          <div className="text-gray-500">
            {searchTerm || selectedDifficulty !== 'all'
              ? 'No basslines match your filters'
              : 'No saved basslines yet'}
          </div>
          {searchTerm || selectedDifficulty !== 'all' ? (
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => {
                setSearchTerm('');
                setSelectedDifficulty('all');
              }}
            >
              Clear Filters
            </Button>
          ) : null}
        </div>
      )}

      {/* Basslines Grid */}
      {!isLoading && basslines.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {basslines.map((bassline) => (
            <Card key={bassline.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedBasslines.has(bassline.id)}
                      onChange={() => toggleBasslineSelection(bassline.id)}
                    />
                    <CardTitle className="text-lg truncate">
                      {bassline.name}
                    </CardTitle>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        ⋮
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem
                        onClick={() => onLoadBassline?.(bassline)}
                      >
                        Load
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => onEditBassline?.(bassline)}
                      >
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleRename(bassline)}>
                        Rename
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDuplicate(bassline)}
                      >
                        Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(bassline.id)}
                        className="text-red-600"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {bassline.description && (
                  <p className="text-sm text-gray-600 line-clamp-2">
                    {bassline.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-1">
                  <Badge
                    className={getDifficultyColor(bassline.metadata.difficulty)}
                  >
                    {bassline.metadata.difficulty}
                  </Badge>
                  <Badge variant="outline">{bassline.notes.length} notes</Badge>
                  <Badge variant="outline">{bassline.metadata.tempo} BPM</Badge>
                  <Badge variant="outline">{bassline.metadata.key}</Badge>
                </div>

                {bassline.metadata.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {bassline.metadata.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {bassline.metadata.tags.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{bassline.metadata.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="text-xs text-gray-500">
                  <div>Created: {formatDate(bassline.createdAt)}</div>
                  {bassline.updatedAt !== bassline.createdAt && (
                    <div>Updated: {formatDate(bassline.updatedAt)}</div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => onLoadBassline?.(bassline)}
                    className="flex-1"
                  >
                    Load
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onEditBassline?.(bassline)}
                  >
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)}{' '}
            of {total} basslines
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <span className="px-3 py-1 text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
