'use client';

/**
 * Admin Questions Page
 *
 * CRUD for questions in the segment-based assessment.
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
import { Plus, Edit, Trash, HelpCircle, Save, Volume2 } from 'lucide-react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { apiClient } from '@/lib/api-client';
import type {
  SegmentQuestion,
  SegmentQuestionType,
  SegmentQuestionCategory,
  SegmentQuestionOption,
  SkillBucket,
} from '@bassnotion/contracts';

const QUESTION_TYPES: { value: SegmentQuestionType; label: string }[] = [
  { value: 'multiple-choice', label: 'Multiple Choice' },
  { value: 'multi-select', label: 'Multi Select' },
  { value: 'text-input', label: 'Text Input' },
  { value: 'skill-verification', label: 'Skill Verification' },
];

const CATEGORIES: {
  value: SegmentQuestionCategory;
  label: string;
  color: string;
}[] = [
  { value: 'level', label: 'Level', color: 'bg-blue-500' },
  { value: 'verification', label: 'Verification', color: 'bg-purple-500' },
  { value: 'goal', label: 'Goal', color: 'bg-green-500' },
  { value: 'struggle', label: 'Struggle', color: 'bg-orange-500' },
  { value: 'style', label: 'Style', color: 'bg-pink-500' },
  { value: 'commitment', label: 'Commitment', color: 'bg-indigo-500' },
];

const SKILL_BUCKETS: { value: SkillBucket; label: string }[] = [
  { value: 'true_beginner', label: 'True Beginner' },
  { value: 'solid_beginner', label: 'Solid Beginner' },
  { value: 'beginner_with_gaps', label: 'Beginner with Gaps' },
  { value: 'intermediate_theory_gaps', label: 'Intermediate (Theory)' },
  { value: 'solid_intermediate', label: 'Solid Intermediate' },
];

export default function AdminQuestionsPage() {
  const router = useRouter();
  const { logger } = useCorrelation('AdminQuestionsPage');
  const { isReady, isAuthenticated } = useAuth();

  const [questions, setQuestions] = useState<SegmentQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] =
    useState<SegmentQuestion | null>(null);

  const [form, setForm] = useState({
    questionKey: '',
    questionText: '',
    description: '',
    questionType: 'multiple-choice' as SegmentQuestionType,
    options: [] as SegmentQuestionOption[],
    verificationConfig: null as {
      correctAnswer: string;
      wrongAnswerFeedback: string;
      audioUrl?: string;
    } | null,
    audioUrl: '',
    category: 'level' as SegmentQuestionCategory,
    points: 0,
    sortOrder: 0,
    isActive: true,
  });

  const loadQuestions = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await apiClient.get<{ questions: SegmentQuestion[] }>(
        '/api/v1/admin/assessment/v2/questions',
      );
      setQuestions(result.questions || []);
    } catch (err) {
      logger.error('Failed to load questions', err);
      setError('Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  }, [logger]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      loadQuestions();
    } else if (isReady && !isAuthenticated) {
      router.push('/login');
    }
  }, [isReady, isAuthenticated, loadQuestions, router]);

  const handleNew = () => {
    setEditingQuestion(null);
    setForm({
      questionKey: '',
      questionText: '',
      description: '',
      questionType: 'multiple-choice',
      options: [
        { id: `opt-${Date.now()}-1`, text: '', value: '' },
        { id: `opt-${Date.now()}-2`, text: '', value: '' },
      ],
      verificationConfig: null,
      audioUrl: '',
      category: 'level',
      points: 0,
      sortOrder: questions.length,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (question: SegmentQuestion) => {
    setEditingQuestion(question);
    setForm({
      questionKey: question.questionKey,
      questionText: question.questionText,
      description: question.description || '',
      questionType: question.questionType,
      options: question.options || [],
      verificationConfig: question.verificationConfig || null,
      audioUrl: question.audioConfig?.url || '',
      category: question.category,
      points: question.points || 0,
      sortOrder: question.sortOrder,
      isActive: question.isActive,
    });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload = {
        questionKey: form.questionKey,
        questionText: form.questionText,
        description: form.description || undefined,
        questionType: form.questionType,
        options: form.options.length > 0 ? form.options : undefined,
        verificationConfig: form.verificationConfig || undefined,
        audioConfig: form.audioUrl ? { url: form.audioUrl } : undefined,
        category: form.category,
        points: form.points || undefined,
        sortOrder: form.sortOrder,
        isActive: form.isActive,
      };

      if (editingQuestion) {
        await apiClient.put(
          `/api/v1/admin/assessment/v2/questions/${editingQuestion.id}`,
          payload,
        );
      } else {
        await apiClient.post('/api/v1/admin/assessment/v2/questions', payload);
      }
      setIsDialogOpen(false);
      await loadQuestions();
    } catch (err) {
      logger.error('Failed to save question', err);
      setError('Failed to save question');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      await apiClient.delete(`/api/v1/admin/assessment/v2/questions/${id}`);
      await loadQuestions();
    } catch (err) {
      logger.error('Failed to delete question', err);
      setError('Failed to delete question');
    }
  };

  const addOption = () => {
    setForm({
      ...form,
      options: [
        ...form.options,
        { id: `opt-${Date.now()}`, text: '', value: '' },
      ],
    });
  };

  const updateOption = (
    index: number,
    field: keyof SegmentQuestionOption,
    value: string | boolean | SkillBucket | undefined,
  ) => {
    const options = [...form.options];
    options[index] = { ...options[index], [field]: value };
    setForm({ ...form, options });
  };

  const removeOption = (index: number) => {
    const options = [...form.options];
    options.splice(index, 1);
    setForm({ ...form, options });
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
          <h1 className="text-3xl font-bold">Questions</h1>
          <p className="text-gray-500 mt-1">
            Manage questions for the segment-based assessment
          </p>
        </div>
        <Button onClick={handleNew}>
          <Plus className="w-5 h-5 mr-2" />
          Add Question
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
          <CardTitle>Questions ({questions.length})</CardTitle>
          <CardDescription>
            Questions are shown at flow nodes during the assessment
          </CardDescription>
        </CardHeader>
        <CardContent>
          {questions.length === 0 ? (
            <div className="text-center py-12">
              <HelpCircle className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 mb-4">No questions configured yet.</p>
              <Button onClick={handleNew} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Add Your First Question
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {questions
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((question) => {
                  const categoryConfig = CATEGORIES.find(
                    (c) => c.value === question.category,
                  );
                  return (
                    <div
                      key={question.id}
                      className="flex items-center gap-4 p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="w-12 text-center text-sm font-mono text-gray-500">
                        #{question.sortOrder}
                      </div>

                      <Badge className={categoryConfig?.color || 'bg-gray-500'}>
                        {categoryConfig?.label || question.category}
                      </Badge>

                      <Badge variant="outline">
                        {QUESTION_TYPES.find(
                          (t) => t.value === question.questionType,
                        )?.label || question.questionType}
                      </Badge>

                      {question.audioConfig && (
                        <Volume2 className="w-4 h-4 text-blue-500" />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {question.questionText}
                        </p>
                        <p className="text-sm text-gray-500 truncate font-mono">
                          {question.questionKey}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(question)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-600"
                          onClick={() => handleDelete(question.id)}
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingQuestion ? 'Edit Question' : 'Add Question'}
            </DialogTitle>
            <DialogDescription>
              Configure a question for the assessment flow
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Question Key</Label>
                <Input
                  value={form.questionKey}
                  onChange={(e) =>
                    setForm({ ...form, questionKey: e.target.value })
                  }
                  placeholder="level_self_report"
                  className="mt-1 font-mono"
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select
                  value={form.category}
                  onValueChange={(value) =>
                    setForm({
                      ...form,
                      category: value as SegmentQuestionCategory,
                    })
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Question Type</Label>
              <Select
                value={form.questionType}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                    questionType: value as SegmentQuestionType,
                  })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Question Text</Label>
              <Textarea
                value={form.questionText}
                onChange={(e) =>
                  setForm({ ...form, questionText: e.target.value })
                }
                placeholder="How long have you been playing bass?"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Description (optional)</Label>
              <Input
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                placeholder="Additional context..."
                className="mt-1"
              />
            </div>

            {/* Options for choice questions */}
            {(form.questionType === 'multiple-choice' ||
              form.questionType === 'multi-select' ||
              form.questionType === 'skill-verification') && (
              <div>
                <Label>Options</Label>
                <div className="space-y-2 mt-2">
                  {form.options.map((option, index) => (
                    <div key={option.id} className="flex items-center gap-2">
                      <Input
                        value={option.text}
                        onChange={(e) =>
                          updateOption(index, 'text', e.target.value)
                        }
                        placeholder="Option text"
                        className="flex-1"
                      />
                      <Input
                        value={option.value}
                        onChange={(e) =>
                          updateOption(index, 'value', e.target.value)
                        }
                        placeholder="value"
                        className="w-32 font-mono"
                      />
                      {form.category === 'level' && (
                        <Select
                          value={option.nextBucket || 'none'}
                          onValueChange={(value) =>
                            updateOption(
                              index,
                              'nextBucket',
                              value === 'none'
                                ? undefined
                                : (value as SkillBucket),
                            )
                          }
                        >
                          <SelectTrigger className="w-40">
                            <SelectValue placeholder="Next bucket" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            {SKILL_BUCKETS.map((b) => (
                              <SelectItem key={b.value} value={b.value}>
                                {b.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {form.questionType === 'skill-verification' && (
                        <label className="flex items-center gap-1 text-sm">
                          <input
                            type="checkbox"
                            checked={option.isCorrect || false}
                            onChange={(e) =>
                              updateOption(index, 'isCorrect', e.target.checked)
                            }
                          />
                          Correct
                        </label>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(index)}
                        className="text-red-500"
                      >
                        <Trash className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addOption}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Option
                  </Button>
                </div>
              </div>
            )}

            {/* Skill verification config */}
            {form.questionType === 'skill-verification' && (
              <div className="p-4 bg-purple-50 rounded-lg space-y-3">
                <Label className="text-purple-700">
                  Skill Verification Config
                </Label>
                <div>
                  <Label className="text-sm">Correct Answer Value</Label>
                  <Input
                    value={form.verificationConfig?.correctAnswer || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        verificationConfig: {
                          correctAnswer: e.target.value,
                          wrongAnswerFeedback:
                            form.verificationConfig?.wrongAnswerFeedback || '',
                          audioUrl: form.verificationConfig?.audioUrl,
                        },
                      })
                    }
                    placeholder="The correct option value"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-sm">Wrong Answer Feedback</Label>
                  <Textarea
                    value={form.verificationConfig?.wrongAnswerFeedback || ''}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        verificationConfig: {
                          correctAnswer:
                            form.verificationConfig?.correctAnswer || '',
                          wrongAnswerFeedback: e.target.value,
                          audioUrl: form.verificationConfig?.audioUrl,
                        },
                      })
                    }
                    placeholder="Feedback shown when the user gets it wrong"
                    className="mt-1"
                  />
                </div>
              </div>
            )}

            {/* Audio URL */}
            <div>
              <Label>Audio URL (optional)</Label>
              <Input
                value={form.audioUrl}
                onChange={(e) => setForm({ ...form, audioUrl: e.target.value })}
                placeholder="https://cdn.example.com/audio.mp3"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Points</Label>
                <Input
                  type="number"
                  value={form.points}
                  onChange={(e) =>
                    setForm({ ...form, points: parseInt(e.target.value) || 0 })
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
