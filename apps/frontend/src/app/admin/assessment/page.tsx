'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import {
  Plus,
  Edit,
  Trash,
  GripVertical,
  Save,
  Video,
  Settings,
} from 'lucide-react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { apiClient } from '@/lib/api-client';
import type { AssessmentQuestion, AssessmentConfig } from '@bassnotion/contracts';


// Question type labels
const QUESTION_TYPE_LABELS: Record<string, string> = {
  'multiple-choice': 'Multiple Choice',
  'multi-select': 'Multi Select',
  'text-input': 'Text Input',
  'drag-drop': 'Drag & Drop',
};

// Category labels and colors
const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string }
> = {
  knowledge: { label: 'Knowledge', color: 'bg-purple-500' },
  goal: { label: 'Goal', color: 'bg-green-500' },
  preference: { label: 'Preference', color: 'bg-orange-500' },
};

export default function AdminAssessmentPage() {
  const router = useRouter();
  const { correlationId, logger } = useCorrelation('AdminAssessmentPage');
  const { isReady, isAuthenticated } = useAuth();

  // State
  const [config, setConfig] = useState<AssessmentConfig | null>(null);
  const [questions, setQuestions] = useState<AssessmentQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Dialog states
  const [isVideoDialogOpen, setIsVideoDialogOpen] = useState(false);
  const [isQuestionDialogOpen, setIsQuestionDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<AssessmentQuestion | null>(null);

  // Form states for Bunny Stream
  const [videoLibraryId, setVideoLibraryId] = useState('');
  const [videoId, setVideoId] = useState('');
  const [questionForm, setQuestionForm] = useState<Partial<AssessmentQuestion>>({
    type: 'multiple-choice',
    category: 'knowledge',
    timestamp: 0,
    question: '',
    description: '',
    options: [],
    points: 10,
    difficulty: 'beginner',
  });

  // Load config
  const loadConfig = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      logger.info('Loading assessment config');

      const result = await apiClient.get<{ config: AssessmentConfig | null }>(
        '/api/v1/admin/assessment/config',
      );

      if (result.config) {
        setConfig(result.config);
        setQuestions(result.config.questions || []);
        setVideoLibraryId(result.config.videoLibraryId || '');
        setVideoId(result.config.videoId || '');
        logger.info('Config loaded', {
          questionCount: result.config.questions?.length || 0,
        });
      }
    } catch (err) {
      logger.error('Failed to load config', err);
      setError('Failed to load assessment configuration');
    } finally {
      setIsLoading(false);
    }
  }, [logger]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      loadConfig();
    } else if (isReady && !isAuthenticated) {
      router.push('/login');
    }
  }, [isReady, isAuthenticated, loadConfig, router]);

  // Parse Bunny Stream URL to extract library ID and video ID
  const parseBunnyUrl = (url: string): { libraryId: string; videoId: string } => {
    // Handle various Bunny Stream URL formats:
    // https://iframe.mediadelivery.net/play/583585/032167b4-e074-4c76-ba39-f3ee9d16966d
    // https://iframe.mediadelivery.net/embed/583585/032167b4-e074-4c76-ba39-f3ee9d16966d
    // https://video.bunnycdn.com/play/583585/032167b4-e074-4c76-ba39-f3ee9d16966d
    // 583585/032167b4-e074-4c76-ba39-f3ee9d16966d (just the IDs)

    const trimmed = url.trim();

    // Check if it's a UUID-like video ID only
    if (/^[a-f0-9-]{36}$/i.test(trimmed)) {
      return { libraryId: '', videoId: trimmed };
    }

    // Check if it's just libraryId/videoId format
    const simpleMatch = trimmed.match(/^(\d+)\/([a-f0-9-]{36})$/i);
    if (simpleMatch) {
      return { libraryId: simpleMatch[1], videoId: simpleMatch[2] };
    }

    try {
      const urlObj = new URL(trimmed);
      const pathname = urlObj.pathname;

      // Extract from pathname: /play/583585/032167b4-... or /embed/583585/032167b4-...
      const pathParts = pathname.split('/').filter(Boolean);

      // Find library ID (numeric) and video ID (UUID-like)
      let libraryId = '';
      let videoId = '';

      for (const part of pathParts) {
        if (/^\d+$/.test(part) && !libraryId) {
          libraryId = part;
        } else if (/^[a-f0-9-]{36}$/i.test(part)) {
          videoId = part;
        }
      }

      return { libraryId, videoId };
    } catch {
      // If URL parsing fails, try to extract patterns
      const libraryMatch = trimmed.match(/\/(\d{4,})\//);
      const videoMatch = trimmed.match(/([a-f0-9-]{36})/i);
      return {
        libraryId: libraryMatch?.[1] || '',
        videoId: videoMatch?.[1] || '',
      };
    }
  };

  // Handle Bunny URL input change - auto-parse
  const handleBunnyUrlChange = (url: string) => {
    const parsed = parseBunnyUrl(url);
    if (parsed.libraryId) setVideoLibraryId(parsed.libraryId);
    if (parsed.videoId) setVideoId(parsed.videoId);
  };

  // Save video configuration
  const handleSaveVideoConfig = async () => {
    try {
      setIsSaving(true);
      logger.info('Saving video config', { videoLibraryId, videoId });

      await apiClient.put('/api/v1/admin/assessment/config', {
        videoPlatform: 'bunny',
        videoLibraryId,
        videoId,
      });

      setIsVideoDialogOpen(false);
      await loadConfig();
    } catch (err) {
      logger.error('Failed to save video config', err);
      setError('Failed to save video configuration');
    } finally {
      setIsSaving(false);
    }
  };

  // Open question dialog for editing
  const handleEditQuestion = (question: AssessmentQuestion) => {
    setEditingQuestion(question);
    setQuestionForm({
      ...question,
      options: question.options || [],
    });
    setIsQuestionDialogOpen(true);
  };

  // Open question dialog for creating
  const handleNewQuestion = () => {
    setEditingQuestion(null);
    setQuestionForm({
      id: `q-${Date.now()}`,
      type: 'multiple-choice',
      category: 'knowledge',
      timestamp: 0,
      question: '',
      description: '',
      options: [
        { id: `opt-${Date.now()}-1`, text: '', isCorrect: false },
        { id: `opt-${Date.now()}-2`, text: '', isCorrect: false },
      ],
      points: 10,
      difficulty: 'beginner',
    });
    setIsQuestionDialogOpen(true);
  };

  // Save question
  const handleSaveQuestion = async () => {
    try {
      setIsSaving(true);
      const question = questionForm as AssessmentQuestion;

      if (editingQuestion) {
        logger.info('Updating question', { questionId: question.id });
        await apiClient.put(`/api/v1/admin/assessment/questions/${question.id}`, {
          question,
        });
      } else {
        logger.info('Adding question', { questionId: question.id });
        await apiClient.post('/api/v1/admin/assessment/questions', {
          question,
        });
      }

      setIsQuestionDialogOpen(false);
      await loadConfig();
    } catch (err) {
      logger.error('Failed to save question', err);
      setError('Failed to save question');
    } finally {
      setIsSaving(false);
    }
  };

  // Delete question
  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) {
      return;
    }

    try {
      setIsSaving(true);
      logger.info('Deleting question', { questionId });

      await apiClient.delete(`/api/v1/admin/assessment/questions/${questionId}`);
      await loadConfig();
    } catch (err) {
      logger.error('Failed to delete question', err);
      setError('Failed to delete question');
    } finally {
      setIsSaving(false);
    }
  };

  // Add option to question form
  const handleAddOption = () => {
    const options = questionForm.options || [];
    setQuestionForm({
      ...questionForm,
      options: [
        ...options,
        { id: `opt-${Date.now()}`, text: '', isCorrect: false },
      ],
    });
  };

  // Update option
  const handleUpdateOption = (index: number, field: string, value: string | boolean) => {
    const options = [...(questionForm.options || [])];
    options[index] = { ...options[index], [field]: value };
    setQuestionForm({ ...questionForm, options });
  };

  // Remove option
  const handleRemoveOption = (index: number) => {
    const options = [...(questionForm.options || [])];
    options.splice(index, 1);
    setQuestionForm({ ...questionForm, options });
  };

  // Format timestamp as MM:SS
  const formatTimestamp = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auth checking state
  if (!isReady) {
    return (
      <div className="p-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
            <p className="text-gray-500">Loading assessment configuration...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Assessment Quiz</h1>
          <p className="text-gray-500 mt-1">
            Configure the entrance assessment video and questions
          </p>
        </div>
        <Button onClick={handleNewQuestion} size="lg">
          <Plus className="w-5 h-5 mr-2" />
          Add Question
        </Button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button
            className="ml-2 underline"
            onClick={() => setError(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Video Configuration Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Video className="w-5 h-5" />
            Video Configuration
          </CardTitle>
          <CardDescription>
            Configure the Bunny Stream video for the assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-3">
              <Badge variant="default">Bunny Stream</Badge>

              {config?.videoId && config?.videoLibraryId ? (
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="text-gray-500">Library ID:</span>
                      <span className="ml-2 font-mono font-medium">{config.videoLibraryId}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Video ID:</span>
                      <span className="ml-2 font-mono font-medium text-xs">{config.videoId}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 pt-1">
                    <a
                      href={`https://iframe.mediadelivery.net/play/${config.videoLibraryId}/${config.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:underline"
                    >
                      Play video →
                    </a>
                    <a
                      href={`https://iframe.mediadelivery.net/embed/${config.videoLibraryId}/${config.videoId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-blue-500 hover:underline"
                    >
                      Embed preview →
                    </a>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    No video configured. Click "Configure" to add your assessment video.
                  </p>
                </div>
              )}
            </div>
            <Button variant="outline" onClick={() => setIsVideoDialogOpen(true)}>
              <Settings className="w-4 h-4 mr-2" />
              Configure
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Questions List */}
      <Card>
        <CardHeader>
          <CardTitle>Questions ({questions.length})</CardTitle>
          <CardDescription>
            Questions are displayed in timestamp order during the assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No questions configured yet.</p>
              <Button onClick={handleNewQuestion} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Question
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {questions
                .sort((a, b) => a.timestamp - b.timestamp)
                .map((question, index) => (
                  <div
                    key={question.id}
                    className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-gray-400 cursor-grab">
                      <GripVertical className="w-5 h-5" />
                    </div>

                    <div className="w-16 text-center">
                      <span className="text-sm font-mono text-gray-500">
                        {formatTimestamp(question.timestamp)}
                      </span>
                    </div>

                    <Badge
                      className={
                        CATEGORY_CONFIG[question.category]?.color || 'bg-gray-500'
                      }
                    >
                      {CATEGORY_CONFIG[question.category]?.label || question.category}
                    </Badge>

                    <Badge variant="outline">
                      {QUESTION_TYPE_LABELS[question.type] || question.type}
                    </Badge>

                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{question.question}</p>
                      {question.description && (
                        <p className="text-sm text-gray-500 truncate">
                          {question.description}
                        </p>
                      )}
                    </div>

                    {question.points && (
                      <span className="text-sm text-gray-500">
                        {question.points} pts
                      </span>
                    )}

                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEditQuestion(question)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600"
                        onClick={() => handleDeleteQuestion(question.id)}
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

      {/* Video Configuration Dialog */}
      <Dialog open={isVideoDialogOpen} onOpenChange={setIsVideoDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configure Bunny Stream Video</DialogTitle>
            <DialogDescription>
              Enter your Bunny Stream video details for the assessment
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="bunnyUrl">Paste Bunny Stream URL</Label>
              <Input
                id="bunnyUrl"
                onChange={(e) => handleBunnyUrlChange(e.target.value)}
                placeholder="https://iframe.mediadelivery.net/play/583585/032167b4-e074-4c76-ba39-f3ee9d16966d"
                className="mt-2"
              />
              <p className="text-sm text-gray-500 mt-1">
                Paste the embed or play URL from Bunny Stream to auto-fill the fields below
              </p>
            </div>

            <div className="border-t pt-4">
              <p className="text-xs text-gray-400 mb-3 uppercase tracking-wide">Or enter manually:</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="libraryId">Library ID</Label>
                  <Input
                    id="libraryId"
                    value={videoLibraryId}
                    onChange={(e) => setVideoLibraryId(e.target.value)}
                    placeholder="e.g., 583585"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="bunnyVideoId">Video ID (GUID)</Label>
                  <Input
                    id="bunnyVideoId"
                    value={videoId}
                    onChange={(e) => setVideoId(e.target.value)}
                    placeholder="e.g., 032167b4-e074-..."
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            {videoLibraryId && videoId && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 space-y-2">
                <p className="text-sm font-medium text-green-700 dark:text-green-400">Configuration detected:</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Library ID:</span>
                    <span className="ml-2 font-mono text-green-700 dark:text-green-400">{videoLibraryId}</span>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400">Video ID:</span>
                    <span className="ml-2 font-mono text-green-700 dark:text-green-400 text-xs">{videoId}</span>
                  </div>
                </div>
                <a
                  href={`https://iframe.mediadelivery.net/play/${videoLibraryId}/${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-sm text-blue-600 hover:underline"
                >
                  Preview video in new tab →
                </a>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVideoDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveVideoConfig}
              disabled={isSaving || !videoId || !videoLibraryId}
            >
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Question Editor Dialog */}
      <Dialog open={isQuestionDialogOpen} onOpenChange={setIsQuestionDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? 'Edit Question' : 'Add Question'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Question Type</Label>
                <Select
                  value={questionForm.type}
                  onValueChange={(value) =>
                    setQuestionForm({ ...questionForm, type: value as AssessmentQuestion['type'] })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                    <SelectItem value="multi-select">Multi Select</SelectItem>
                    <SelectItem value="text-input">Text Input</SelectItem>
                    <SelectItem value="drag-drop">Drag & Drop</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Category</Label>
                <Select
                  value={questionForm.category}
                  onValueChange={(value) =>
                    setQuestionForm({ ...questionForm, category: value as AssessmentQuestion['category'] })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="knowledge">Knowledge (scored)</SelectItem>
                    <SelectItem value="goal">Goal</SelectItem>
                    <SelectItem value="preference">Preference</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Timestamp */}
            <div>
              <Label>Timestamp (seconds)</Label>
              <Input
                type="number"
                value={questionForm.timestamp || 0}
                onChange={(e) =>
                  setQuestionForm({
                    ...questionForm,
                    timestamp: parseInt(e.target.value) || 0,
                  })
                }
                min={0}
                className="mt-1"
              />
              <p className="text-sm text-gray-500 mt-1">
                Video will pause at {formatTimestamp(questionForm.timestamp || 0)} to show this question
              </p>
            </div>

            {/* Question Text */}
            <div>
              <Label>Question</Label>
              <Textarea
                value={questionForm.question || ''}
                onChange={(e) =>
                  setQuestionForm({ ...questionForm, question: e.target.value })
                }
                placeholder="Enter your question..."
                className="mt-1"
              />
            </div>

            {/* Description */}
            <div>
              <Label>Description (optional)</Label>
              <Input
                value={questionForm.description || ''}
                onChange={(e) =>
                  setQuestionForm({ ...questionForm, description: e.target.value })
                }
                placeholder="Additional context for the question"
                className="mt-1"
              />
            </div>

            {/* Options (for multiple-choice and multi-select) */}
            {(questionForm.type === 'multiple-choice' ||
              questionForm.type === 'multi-select') && (
              <div>
                <Label>Options</Label>
                <div className="space-y-2 mt-2">
                  {(questionForm.options || []).map((option, index) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <Input
                        value={option.text}
                        onChange={(e) =>
                          handleUpdateOption(index, 'text', e.target.value)
                        }
                        placeholder={`Option ${index + 1}`}
                        className="flex-1"
                      />
                      {questionForm.category === 'knowledge' && (
                        <label className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={option.isCorrect || false}
                            onChange={(e) =>
                              handleUpdateOption(index, 'isCorrect', e.target.checked)
                            }
                          />
                          Correct
                        </label>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveOption(index)}
                        className="text-red-500"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleAddOption}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Option
                  </Button>
                </div>
              </div>
            )}

            {/* Points (for knowledge questions) */}
            {questionForm.category === 'knowledge' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Points</Label>
                  <Input
                    type="number"
                    value={questionForm.points || 10}
                    onChange={(e) =>
                      setQuestionForm({
                        ...questionForm,
                        points: parseInt(e.target.value) || 0,
                      })
                    }
                    min={0}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Difficulty</Label>
                  <Select
                    value={questionForm.difficulty || 'beginner'}
                    onValueChange={(value) =>
                      setQuestionForm({
                        ...questionForm,
                        difficulty: value as 'beginner' | 'intermediate' | 'advanced',
                      })
                    }
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsQuestionDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveQuestion} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save Question'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
