'use client';

/**
 * Admin Segments Page
 *
 * CRUD for video segments in the segment-based assessment.
 */

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Textarea } from '@/shared/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Plus, Edit, Trash, Video, ExternalLink, Save } from 'lucide-react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { apiClient } from '@/lib/api-client';
import type {
  VideoSegment,
  SegmentTopic,
  SkillBucket,
} from '@bassnotion/contracts';

const SEGMENT_TOPICS: { value: SegmentTopic; label: string }[] = [
  { value: 'level_intro', label: 'Level Intro' },
  { value: 'skill_check_response', label: 'Skill Check Response' },
  { value: 'goals_beginner', label: 'Goals (Beginner)' },
  { value: 'goals_intermediate', label: 'Goals (Intermediate)' },
  { value: 'struggle_true_beginner', label: 'Struggle: True Beginner' },
  { value: 'struggle_solid_beginner', label: 'Struggle: Solid Beginner' },
  {
    value: 'struggle_beginner_with_gaps',
    label: 'Struggle: Beginner with Gaps',
  },
  {
    value: 'struggle_intermediate_theory_gaps',
    label: 'Struggle: Intermediate Theory',
  },
  {
    value: 'struggle_solid_intermediate',
    label: 'Struggle: Solid Intermediate',
  },
  { value: 'learning_style', label: 'Learning Style' },
  { value: 'practice_time', label: 'Practice Time' },
  { value: 'genre', label: 'Genre' },
  { value: 'genre_acknowledgment', label: 'Genre Acknowledgment' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'equipment_response', label: 'Equipment Response' },
  { value: 'commitment', label: 'Commitment' },
];

const SKILL_BUCKETS: { value: SkillBucket; label: string }[] = [
  { value: 'true_beginner', label: 'True Beginner' },
  { value: 'solid_beginner', label: 'Solid Beginner' },
  { value: 'beginner_with_gaps', label: 'Beginner with Gaps' },
  { value: 'intermediate_theory_gaps', label: 'Intermediate (Theory)' },
  { value: 'solid_intermediate', label: 'Solid Intermediate' },
];

export default function AdminSegmentsPage() {
  const router = useRouter();
  const { logger } = useCorrelation('AdminSegmentsPage');
  const { isReady, isAuthenticated } = useAuth();

  const [segments, setSegments] = useState<VideoSegment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSegment, setEditingSegment] = useState<VideoSegment | null>(
    null,
  );

  const [form, setForm] = useState({
    videoLibraryId: '',
    videoId: '',
    name: '',
    slug: '',
    description: '',
    durationSeconds: 0,
    topic: 'level_intro' as SegmentTopic,
    targetBuckets: [] as SkillBucket[],
    sortOrder: 0,
    isActive: true,
  });

  const loadSegments = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await apiClient.get<{ segments: VideoSegment[] }>(
        '/api/v1/admin/assessment/v2/segments',
      );
      setSegments(result.segments || []);
    } catch (err) {
      logger.error('Failed to load segments', err);
      setError('Failed to load segments');
    } finally {
      setIsLoading(false);
    }
  }, [logger]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      loadSegments();
    } else if (isReady && !isAuthenticated) {
      router.push('/login');
    }
  }, [isReady, isAuthenticated, loadSegments, router]);

  const handleNew = () => {
    setEditingSegment(null);
    setForm({
      videoLibraryId: '',
      videoId: '',
      name: '',
      slug: '',
      description: '',
      durationSeconds: 0,
      topic: 'level_intro',
      targetBuckets: [],
      sortOrder: segments.length,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (segment: VideoSegment) => {
    setEditingSegment(segment);
    setForm({
      videoLibraryId: segment.videoLibraryId,
      videoId: segment.videoId,
      name: segment.name,
      slug: segment.slug,
      description: segment.description || '',
      durationSeconds: segment.durationSeconds || 0,
      topic: segment.topic,
      targetBuckets: segment.targetBuckets,
      sortOrder: segment.sortOrder,
      isActive: segment.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      if (editingSegment) {
        await apiClient.put(
          `/api/v1/admin/assessment/v2/segments/${editingSegment.id}`,
          form,
        );
      } else {
        await apiClient.post('/api/v1/admin/assessment/v2/segments', form);
      }
      setIsDialogOpen(false);
      await loadSegments();
    } catch (err) {
      logger.error('Failed to save segment', err);
      setError('Failed to save segment');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this segment?')) return;
    try {
      await apiClient.delete(`/api/v1/admin/assessment/v2/segments/${id}`);
      await loadSegments();
    } catch (err) {
      logger.error('Failed to delete segment', err);
      setError('Failed to delete segment');
    }
  };

  const toggleBucket = (bucket: SkillBucket) => {
    setForm((prev) => ({
      ...prev,
      targetBuckets: prev.targetBuckets.includes(bucket)
        ? prev.targetBuckets.filter((b) => b !== bucket)
        : [...prev.targetBuckets, bucket],
    }));
  };

  if (!isReady || isLoading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Video Segments</h1>
          <p className="text-gray-500 mt-1">
            Manage the video segments for the segment-based assessment
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-5 h-5 mr-2" />
          Add Segment
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Segments ({segments.length})</CardTitle>
          <CardDescription>
            Each segment is a short video that plays during the assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {segments.length === 0 ? (
            <div className="text-center py-12">
              <Video className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No segments configured yet.</p>
              <Button onClick={handleNew} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Segment
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {segments
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((segment) => (
                  <div
                    key={segment.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-12 text-center text-sm font-mono text-gray-500">
                      #{segment.sortOrder}
                    </div>

                    <Badge variant={segment.isActive ? 'default' : 'secondary'}>
                      {segment.isActive ? 'Active' : 'Inactive'}
                    </Badge>

                    <Badge variant="outline">
                      {SEGMENT_TOPICS.find((t) => t.value === segment.topic)
                        ?.label || segment.topic}
                    </Badge>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{segment.name}</p>
                      <p className="text-sm text-gray-500 truncate">
                        {segment.slug} • {segment.durationSeconds || 0}s
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {segment.targetBuckets.map((bucket) => (
                        <Badge
                          key={bucket}
                          variant="outline"
                          className="text-xs"
                        >
                          {SKILL_BUCKETS.find((b) => b.value === bucket)
                            ?.label || bucket}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <a
                        href={`https://iframe.mediadelivery.net/play/${segment.videoLibraryId}/${segment.videoId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-blue-500"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(segment)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleDelete(segment.id)}
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingSegment ? 'Edit Segment' : 'Add Segment'}
            </DialogTitle>
            <DialogDescription>
              Configure a video segment for the assessment flow
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Introduction to Bass"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="intro-bass"
                  className="mt-1"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Video Library ID</Label>
                <Input
                  value={form.videoLibraryId}
                  onChange={(e) =>
                    setForm({ ...form, videoLibraryId: e.target.value })
                  }
                  placeholder="583585"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Video ID (GUID)</Label>
                <Input
                  value={form.videoId}
                  onChange={(e) =>
                    setForm({ ...form, videoId: e.target.value })
                  }
                  placeholder="032167b4-e074-..."
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Brief description of this segment..."
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Topic</Label>
                <Select
                  value={form.topic}
                  onValueChange={(value) =>
                    setForm({ ...form, topic: value as SegmentTopic })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SEGMENT_TOPICS.map((topic) => (
                      <SelectItem key={topic.value} value={topic.value}>
                        {topic.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Duration (seconds)</Label>
                <Input
                  type="number"
                  value={form.durationSeconds}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      durationSeconds: parseInt(e.target.value) || 0,
                    })
                  }
                  min={0}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      sortOrder: parseInt(e.target.value) || 0,
                    })
                  }
                  min={0}
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label>Target Buckets</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {SKILL_BUCKETS.map((bucket) => (
                  <button
                    key={bucket.value}
                    type="button"
                    onClick={() => toggleBucket(bucket.value)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      form.targetBuckets.includes(bucket.value)
                        ? 'bg-purple-500 text-white border-purple-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {bucket.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={form.isActive}
                onChange={(e) =>
                  setForm({ ...form, isActive: e.target.checked })
                }
              />
              <Label htmlFor="isActive">Active</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
