'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table';
import { Plus, Edit, Trash, Search, Eye } from 'lucide-react';
import { useTutorialRepository } from '@/domains/tutorials/hooks/useTutorialRepository';
import { Tutorial } from '@/domains/tutorials/entities/tutorial.entity';
import { TutorialSlug } from '@/domains/tutorials/value-objects/tutorial-slug.vo';
import { TutorialId } from '@/domains/tutorials/value-objects/tutorial-id.vo';
import { TutorialLevel } from '@/domains/tutorials/value-objects/tutorial-level.vo';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { useAuth } from '@/domains/user/hooks/use-auth';

export default function AdminTutorialsPage() {
  const router = useRouter();
  const { correlationId, logger } = useCorrelation('AdminTutorialsPage');
  const { isReady, isAuthenticated } = useAuth();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const tutorialRepo = useTutorialRepository();

  useEffect(() => {
    // OPTIMIZATION: Prevent multiple loads in React Strict Mode
    let mounted = true;

    const initialize = async () => {
      // Wait for authentication to be ready before making API calls
      if (isReady && isAuthenticated && mounted) {
        await loadTutorials();
      } else if (isReady && !isAuthenticated && mounted) {
        // If auth is ready but user is not authenticated, redirect to login
        router.push('/login');
      }
    };

    initialize();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, isAuthenticated]); // Only reload if auth state actually changes

  const loadTutorials = async () => {
    try {
      setIsLoading(true);
      logger.info('Loading tutorials');
      const result = await tutorialRepo.findAll();
      if (result.isSuccess()) {
        setTutorials(result.value.items);
        logger.info('Tutorials loaded', { count: result.value.items.length });
      } else {
        logger.error('Failed to load tutorials', result.error);
      }
    } catch (error) {
      logger.error('Error loading tutorials', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = async () => {
    try {
      setIsCreating(true);
      logger.info('Creating new draft tutorial');

      // Create a draft immediately in the database
      const draft = Tutorial.create({
        title: 'Untitled Tutorial',
        description: 'Add your tutorial description here',
        youtubeId: '',
        duration: 0,
        authorName: 'Admin',
        level: TutorialLevel.create('beginner'),
        tags: [],
        sections: [],
        slug: TutorialSlug.create(`tutorial-${Date.now()}`),
        status: 'draft',
      });

      const result = await tutorialRepo.create(draft);

      if (result.isSuccess()) {
        logger.info('Draft tutorial created', { id: result.value.id.value });
        // Navigate to edit page with real ID
        router.push(`/admin/tutorials/${result.value.slug.value}/edit`);
      } else {
        logger.error('Failed to create draft tutorial', result.error);
        alert('Failed to create new tutorial. Please try again.');
      }
    } catch (error) {
      logger.error('Error creating draft tutorial', error);
      alert('An error occurred while creating the tutorial.');
    } finally {
      setIsCreating(false);
    }
  };

  const handleEdit = (slug: string) => {
    router.push(`/admin/tutorials/${slug}/edit`);
  };

  const handleView = (slug: string) => {
    // Preview a tutorial in the modern in-app route (the legacy /library browser was removed).
    window.open(`/tutorials/${slug}`, '_blank');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tutorial?')) {
      return;
    }

    try {
      logger.info('Deleting tutorial', { id });

      // Create TutorialId value object for the delete method
      const tutorialId = TutorialId.create(id);
      const result = await tutorialRepo.delete(tutorialId);

      if (result.isSuccess) {
        logger.info('Tutorial deleted successfully', { id });
        await loadTutorials(); // Reload the list after successful delete
      } else {
        logger.error('Failed to delete tutorial', {
          id,
          error: result.error?.message,
        });
        alert(
          `Failed to delete tutorial: ${result.error?.message || 'Unknown error'}`,
        );
      }
    } catch (error) {
      logger.error('Error deleting tutorial', error);
      alert('An error occurred while deleting the tutorial');
    }
  };

  const filteredTutorials = tutorials.filter(
    (tutorial) =>
      tutorial.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tutorial.description.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  // Show auth checking state
  if (!isReady) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-500">Checking authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading tutorials...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tutorials</h1>
          <p className="text-gray-500 mt-1">Manage your educational content</p>
        </div>
        <Button onClick={handleCreateNew} size="lg" disabled={isCreating}>
          <Plus className="w-5 h-5 mr-2" />
          {isCreating ? 'Creating...' : 'Create Tutorial'}
        </Button>
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search tutorials..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>All Tutorials ({filteredTutorials.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredTutorials.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">
                {searchQuery
                  ? 'No tutorials found matching your search.'
                  : 'No tutorials created yet.'}
              </p>
              {!searchQuery && (
                <Button onClick={handleCreateNew} variant="outline">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Tutorial
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Exercises</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTutorials.map((tutorial) => (
                  <TableRow key={tutorial.id.value}>
                    <TableCell className="font-medium">
                      <div>
                        <p className="font-semibold">{tutorial.title}</p>
                        <p className="text-sm text-gray-500 line-clamp-1">
                          {tutorial.description}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          tutorial.level.value === 'beginner'
                            ? 'default'
                            : tutorial.level.value === 'intermediate'
                              ? 'secondary'
                              : 'destructive'
                        }
                      >
                        {tutorial.level.value}
                      </Badge>
                    </TableCell>
                    <TableCell>{tutorial.getDurationFormatted()}</TableCell>
                    <TableCell>{tutorial.exerciseCount}</TableCell>
                    <TableCell>
                      {tutorial.isPublished() ? (
                        <Badge className="bg-green-600">Published</Badge>
                      ) : tutorial.isArchived() ? (
                        <Badge variant="secondary">Archived</Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-yellow-500 text-yellow-500"
                        >
                          Draft
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{tutorial.viewCount || 0}</TableCell>
                    <TableCell>
                      {new Date(tutorial.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleView(tutorial.slug.value)}
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(tutorial.slug.value)}
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(tutorial.id.value)}
                          title="Delete"
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
