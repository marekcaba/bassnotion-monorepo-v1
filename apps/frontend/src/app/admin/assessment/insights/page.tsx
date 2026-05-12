'use client';

/**
 * Admin Coach Insights Page
 *
 * CRUD for coach insight templates in the segment-based assessment.
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
import { Plus, Edit, Trash, MessageSquare, Save, User } from 'lucide-react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { apiClient } from '@/lib/api-client';
import type { CoachInsightTemplate, SkillBucket } from '@bassnotion/contracts';

const SKILL_BUCKETS: { value: SkillBucket; label: string; color: string }[] = [
  { value: 'true_beginner', label: 'True Beginner', color: 'bg-green-500' },
  { value: 'solid_beginner', label: 'Solid Beginner', color: 'bg-blue-500' },
  { value: 'beginner_with_gaps', label: 'Beginner with Gaps', color: 'bg-yellow-500' },
  { value: 'intermediate_theory_gaps', label: 'Intermediate (Theory)', color: 'bg-purple-500' },
  { value: 'solid_intermediate', label: 'Solid Intermediate', color: 'bg-pink-500' },
];

export default function AdminInsightsPage() {
  const router = useRouter();
  const { logger } = useCorrelation('AdminInsightsPage');
  const { isReady, isAuthenticated } = useAuth();

  const [insights, setInsights] = useState<CoachInsightTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInsight, setEditingInsight] = useState<CoachInsightTemplate | null>(null);

  const [form, setForm] = useState({
    targetBucket: 'true_beginner' as SkillBucket,
    targetGoal: '',
    targetStruggle: '',
    targetPracticeTime: '',
    insightTitle: '',
    insightBody: '',
    coachName: 'Coach',
    coachAvatarUrl: '',
    skillCheckAcknowledgment: '',
    day1Title: '',
    day1Description: '',
    day2Title: '',
    day2Description: '',
    day3Title: '',
    day3Description: '',
    ctaText: 'Start Your Journey',
    ctaLink: '',
    priority: 0,
    isActive: true,
  });

  const loadInsights = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await apiClient.get<{ insights: CoachInsightTemplate[] }>(
        '/api/v1/admin/assessment/v2/insights',
      );
      setInsights(result.insights || []);
    } catch (err) {
      logger.error('Failed to load insights', err);
      setError('Failed to load insights');
    } finally {
      setIsLoading(false);
    }
  }, [logger]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      loadInsights();
    } else if (isReady && !isAuthenticated) {
      router.push('/login');
    }
  }, [isReady, isAuthenticated, loadInsights, router]);

  const handleNew = () => {
    setEditingInsight(null);
    setForm({
      targetBucket: 'true_beginner',
      targetGoal: '',
      targetStruggle: '',
      targetPracticeTime: '',
      insightTitle: '',
      insightBody: '',
      coachName: 'Coach',
      coachAvatarUrl: '',
      skillCheckAcknowledgment: '',
      day1Title: 'Day 1: Foundation',
      day1Description: 'Start with the basics and build a solid foundation.',
      day2Title: 'Day 2: Practice',
      day2Description: 'Apply what you learned with guided exercises.',
      day3Title: 'Day 3: Play',
      day3Description: 'Put it all together with a real song.',
      ctaText: 'Start Your Journey',
      ctaLink: '',
      priority: insights.length,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (insight: CoachInsightTemplate) => {
    setEditingInsight(insight);
    setForm({
      targetBucket: insight.targetBucket,
      targetGoal: insight.targetGoal || '',
      targetStruggle: insight.targetStruggle || '',
      targetPracticeTime: insight.targetPracticeTime || '',
      insightTitle: insight.insightTitle,
      insightBody: insight.insightBody,
      coachName: insight.coachName,
      coachAvatarUrl: insight.coachAvatarUrl || '',
      skillCheckAcknowledgment: insight.skillCheckAcknowledgment || '',
      day1Title: insight.day1Title || '',
      day1Description: insight.day1Description || '',
      day2Title: insight.day2Title || '',
      day2Description: insight.day2Description || '',
      day3Title: insight.day3Title || '',
      day3Description: insight.day3Description || '',
      ctaText: insight.ctaText,
      ctaLink: insight.ctaLink || '',
      priority: insight.priority,
      isActive: insight.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload = {
        ...form,
        targetGoal: form.targetGoal || undefined,
        targetStruggle: form.targetStruggle || undefined,
        targetPracticeTime: form.targetPracticeTime || undefined,
        coachAvatarUrl: form.coachAvatarUrl || undefined,
        skillCheckAcknowledgment: form.skillCheckAcknowledgment || undefined,
        day1Title: form.day1Title || undefined,
        day1Description: form.day1Description || undefined,
        day2Title: form.day2Title || undefined,
        day2Description: form.day2Description || undefined,
        day3Title: form.day3Title || undefined,
        day3Description: form.day3Description || undefined,
        ctaLink: form.ctaLink || undefined,
      };

      if (editingInsight) {
        await apiClient.put(
          `/api/v1/admin/assessment/v2/insights/${editingInsight.id}`,
          payload,
        );
      } else {
        await apiClient.post('/api/v1/admin/assessment/v2/insights', payload);
      }
      setIsDialogOpen(false);
      await loadInsights();
    } catch (err) {
      logger.error('Failed to save insight', err);
      setError('Failed to save insight');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this insight?')) return;
    try {
      await apiClient.delete(`/api/v1/admin/assessment/v2/insights/${id}`);
      await loadInsights();
    } catch (err) {
      logger.error('Failed to delete insight', err);
      setError('Failed to delete insight');
    }
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
          <h1 className="text-3xl font-bold">Coach Insights</h1>
          <p className="text-gray-500 mt-1">
            Personalized coach messages shown on the results screen
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-5 h-5 mr-2" />
          Add Insight
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
          <CardTitle>Insights ({insights.length})</CardTitle>
          <CardDescription>
            Templates are matched based on bucket, goal, struggle, and practice time
          </CardDescription>
        </CardHeader>
        <CardContent>
          {insights.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No insights configured yet.</p>
              <Button onClick={handleNew} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Insight
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {insights
                .sort((a, b) => a.priority - b.priority)
                .map((insight) => {
                  const bucketConfig = SKILL_BUCKETS.find(
                    (b) => b.value === insight.targetBucket,
                  );
                  return (
                    <div
                      key={insight.id}
                      className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-12 text-center text-sm font-mono text-gray-500">
                        P{insight.priority}
                      </div>

                      <Badge className={bucketConfig?.color || 'bg-gray-500'}>
                        {bucketConfig?.label || insight.targetBucket}
                      </Badge>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-500">
                            {insight.coachName}
                          </span>
                        </div>
                        <p className="font-medium truncate">{insight.insightTitle}</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {insight.targetGoal && (
                            <Badge variant="outline" className="text-xs">
                              Goal: {insight.targetGoal}
                            </Badge>
                          )}
                          {insight.targetStruggle && (
                            <Badge variant="outline" className="text-xs">
                              Struggle: {insight.targetStruggle}
                            </Badge>
                          )}
                          {insight.targetPracticeTime && (
                            <Badge variant="outline" className="text-xs">
                              Practice: {insight.targetPracticeTime}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Badge variant={insight.isActive ? 'default' : 'secondary'}>
                        {insight.isActive ? 'Active' : 'Inactive'}
                      </Badge>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(insight)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(insight.id)}
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingInsight ? 'Edit Insight' : 'Add Insight'}
            </DialogTitle>
            <DialogDescription>
              Create a personalized coach message for specific user profiles
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Targeting Section */}
            <div className="p-4 bg-blue-50 rounded-lg space-y-4">
              <h3 className="font-semibold text-blue-800">Targeting Criteria</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Target Bucket (required)</Label>
                  <Select
                    value={form.targetBucket}
                    onValueChange={(value) =>
                      setForm({ ...form, targetBucket: value as SkillBucket })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SKILL_BUCKETS.map((bucket) => (
                        <SelectItem key={bucket.value} value={bucket.value}>
                          {bucket.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Target Goal (optional)</Label>
                  <Input
                    value={form.targetGoal}
                    onChange={(e) => setForm({ ...form, targetGoal: e.target.value })}
                    placeholder="play_in_band"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Target Struggle (optional)</Label>
                  <Input
                    value={form.targetStruggle}
                    onChange={(e) => setForm({ ...form, targetStruggle: e.target.value })}
                    placeholder="timing"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Target Practice Time (optional)</Label>
                  <Input
                    value={form.targetPracticeTime}
                    onChange={(e) =>
                      setForm({ ...form, targetPracticeTime: e.target.value })
                    }
                    placeholder="15_min"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* Coach Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Coach Name</Label>
                <Input
                  value={form.coachName}
                  onChange={(e) => setForm({ ...form, coachName: e.target.value })}
                  placeholder="Coach Marcus"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Coach Avatar URL (optional)</Label>
                <Input
                  value={form.coachAvatarUrl}
                  onChange={(e) => setForm({ ...form, coachAvatarUrl: e.target.value })}
                  placeholder="https://..."
                  className="mt-1"
                />
              </div>
            </div>

            {/* Content Section */}
            <div>
              <Label>Insight Title</Label>
              <Input
                value={form.insightTitle}
                onChange={(e) => setForm({ ...form, insightTitle: e.target.value })}
                placeholder="Welcome to Your Bass Journey!"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Insight Body</Label>
              <Textarea
                value={form.insightBody}
                onChange={(e) => setForm({ ...form, insightBody: e.target.value })}
                placeholder="Your personalized message to the user..."
                className="mt-1"
                rows={4}
              />
            </div>

            <div>
              <Label>Skill Check Acknowledgment (optional)</Label>
              <Textarea
                value={form.skillCheckAcknowledgment}
                onChange={(e) =>
                  setForm({ ...form, skillCheckAcknowledgment: e.target.value })
                }
                placeholder="I noticed you had some trouble with..."
                className="mt-1"
                rows={2}
              />
            </div>

            {/* 3-Day Plan */}
            <div className="p-4 bg-gray-50 rounded-lg space-y-4">
              <h3 className="font-semibold">3-Day Plan (optional)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Day 1 Title</Label>
                  <Input
                    value={form.day1Title}
                    onChange={(e) => setForm({ ...form, day1Title: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Day 1 Description</Label>
                  <Input
                    value={form.day1Description}
                    onChange={(e) =>
                      setForm({ ...form, day1Description: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Day 2 Title</Label>
                  <Input
                    value={form.day2Title}
                    onChange={(e) => setForm({ ...form, day2Title: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Day 2 Description</Label>
                  <Input
                    value={form.day2Description}
                    onChange={(e) =>
                      setForm({ ...form, day2Description: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Day 3 Title</Label>
                  <Input
                    value={form.day3Title}
                    onChange={(e) => setForm({ ...form, day3Title: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Day 3 Description</Label>
                  <Input
                    value={form.day3Description}
                    onChange={(e) =>
                      setForm({ ...form, day3Description: e.target.value })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>CTA Text</Label>
                <Input
                  value={form.ctaText}
                  onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                  placeholder="Start Your Journey"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>CTA Link (optional)</Label>
                <Input
                  value={form.ctaLink}
                  onChange={(e) => setForm({ ...form, ctaLink: e.target.value })}
                  placeholder="/dashboard"
                  className="mt-1"
                />
              </div>
            </div>

            {/* Meta */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Priority (lower = higher priority)</Label>
                <Input
                  type="number"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: parseInt(e.target.value) || 0 })
                  }
                  min={0}
                  className="mt-1"
                />
              </div>
              <div className="flex items-center gap-2 pt-6">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
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
