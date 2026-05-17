'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/shared/components/ui/button';
import { Plus, Trash, GripVertical, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  UnderstandQuestion,
  UnderstandQuestionOption,
} from '@bassnotion/contracts';

interface UnderstandQuestionsEditorProps {
  questions: UnderstandQuestion[];
  onQuestionsChange: (questions: UnderstandQuestion[]) => void;
  onClose: () => void;
}

/**
 * Modal editor for Act 1 Understand quiz questions
 * Allows adding/editing/removing questions with multiple choice options
 */
export function UnderstandQuestionsEditor({
  questions,
  onQuestionsChange,
  onClose,
}: UnderstandQuestionsEditorProps) {
  const [localQuestions, setLocalQuestions] = useState<UnderstandQuestion[]>(
    questions.length > 0 ? questions : [],
  );

  // Generate unique ID
  const generateId = () =>
    `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const generateOptionId = () =>
    `opt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // Add new question
  const addQuestion = useCallback(() => {
    const newQuestion: UnderstandQuestion = {
      id: generateId(),
      question: '',
      options: [
        { id: generateOptionId(), text: '' },
        { id: generateOptionId(), text: '' },
      ],
      correct_option_id: '',
    };
    setLocalQuestions([...localQuestions, newQuestion]);
  }, [localQuestions]);

  // Remove question
  const removeQuestion = useCallback(
    (questionId: string) => {
      setLocalQuestions(localQuestions.filter((q) => q.id !== questionId));
    },
    [localQuestions],
  );

  // Update question text
  const updateQuestionText = useCallback(
    (questionId: string, text: string) => {
      setLocalQuestions(
        localQuestions.map((q) =>
          q.id === questionId ? { ...q, question: text } : q,
        ),
      );
    },
    [localQuestions],
  );

  // Update question timestamp
  const updateQuestionTimestamp = useCallback(
    (questionId: string, timestamp: number | undefined) => {
      setLocalQuestions(
        localQuestions.map((q) =>
          q.id === questionId ? { ...q, timestamp } : q,
        ),
      );
    },
    [localQuestions],
  );

  // Add option to question
  const addOption = useCallback(
    (questionId: string) => {
      setLocalQuestions(
        localQuestions.map((q) => {
          if (q.id === questionId && q.options.length < 4) {
            return {
              ...q,
              options: [...q.options, { id: generateOptionId(), text: '' }],
            };
          }
          return q;
        }),
      );
    },
    [localQuestions],
  );

  // Remove option from question
  const removeOption = useCallback(
    (questionId: string, optionId: string) => {
      setLocalQuestions(
        localQuestions.map((q) => {
          if (q.id === questionId && q.options.length > 2) {
            const newOptions = q.options.filter((o) => o.id !== optionId);
            // If removed option was correct, clear correct_option_id
            const newCorrectId =
              q.correct_option_id === optionId ? '' : q.correct_option_id;
            return {
              ...q,
              options: newOptions,
              correct_option_id: newCorrectId,
            };
          }
          return q;
        }),
      );
    },
    [localQuestions],
  );

  // Update option text
  const updateOptionText = useCallback(
    (questionId: string, optionId: string, text: string) => {
      setLocalQuestions(
        localQuestions.map((q) => {
          if (q.id === questionId) {
            return {
              ...q,
              options: q.options.map((o) =>
                o.id === optionId ? { ...o, text } : o,
              ),
            };
          }
          return q;
        }),
      );
    },
    [localQuestions],
  );

  // Set correct option
  const setCorrectOption = useCallback(
    (questionId: string, optionId: string) => {
      setLocalQuestions(
        localQuestions.map((q) =>
          q.id === questionId ? { ...q, correct_option_id: optionId } : q,
        ),
      );
    },
    [localQuestions],
  );

  // Validate questions
  const validateQuestions = (): boolean => {
    for (const q of localQuestions) {
      if (!q.question.trim()) return false;
      if (q.options.length < 2) return false;
      if (q.options.some((o) => !o.text.trim())) return false;
      if (!q.correct_option_id) return false;
    }
    return true;
  };

  // Save and close
  const handleSave = useCallback(() => {
    onQuestionsChange(localQuestions);
    onClose();
  }, [localQuestions, onQuestionsChange, onClose]);

  const isValid = validateQuestions();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold">Understand Quiz Questions</h3>
        <p className="text-sm text-gray-500 mt-1">
          Add questions that will appear during the video. Questions are
          auto-distributed across the video (10s from start, 10s from end)
          unless you set specific timestamps.
        </p>
      </div>

      {/* Questions list */}
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2">
        {localQuestions.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <p className="text-gray-500 mb-4">No questions yet</p>
            <Button onClick={addQuestion} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Add First Question
            </Button>
          </div>
        ) : (
          localQuestions.map((question, qIndex) => (
            <div
              key={question.id}
              className="border rounded-lg p-4 bg-gray-50 space-y-4"
            >
              {/* Question header */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <GripVertical className="w-4 h-4" />
                  <span>Question {qIndex + 1}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeQuestion(question.id)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash className="w-4 h-4" />
                </Button>
              </div>

              {/* Question text */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Question Text
                </label>
                <input
                  type="text"
                  value={question.question}
                  onChange={(e) =>
                    updateQuestionText(question.id, e.target.value)
                  }
                  placeholder="What note is on the 3rd fret of the A string?"
                  className="w-full px-3 py-2 border rounded-md"
                  maxLength={500}
                />
              </div>

              {/* Timestamp (optional) */}
              <div>
                <label className="block text-sm font-medium mb-1">
                  Timestamp (optional)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={question.timestamp ?? ''}
                    onChange={(e) => {
                      const value = e.target.value
                        ? parseInt(e.target.value, 10)
                        : undefined;
                      updateQuestionTimestamp(question.id, value);
                    }}
                    placeholder="Auto"
                    className="w-24 px-3 py-2 border rounded-md"
                    min={0}
                  />
                  <span className="text-sm text-gray-500">seconds</span>
                  {question.timestamp !== undefined && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        updateQuestionTimestamp(question.id, undefined)
                      }
                      className="text-gray-500"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  Leave empty to auto-distribute across video
                </p>
              </div>

              {/* Options */}
              <div>
                <label className="block text-sm font-medium mb-2">
                  Answer Options (click to mark correct)
                </label>
                <div className="space-y-2">
                  {question.options.map((option, oIndex) => (
                    <div key={option.id} className="flex items-center gap-2">
                      {/* Correct indicator / button */}
                      <button
                        type="button"
                        onClick={() => setCorrectOption(question.id, option.id)}
                        className={cn(
                          'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                          question.correct_option_id === option.id
                            ? 'border-green-500 bg-green-500 text-white'
                            : 'border-gray-300 hover:border-green-300',
                        )}
                        title={
                          question.correct_option_id === option.id
                            ? 'This is the correct answer'
                            : 'Click to mark as correct'
                        }
                      >
                        {question.correct_option_id === option.id && (
                          <Check className="w-4 h-4" />
                        )}
                      </button>

                      {/* Option text input */}
                      <input
                        type="text"
                        value={option.text}
                        onChange={(e) =>
                          updateOptionText(
                            question.id,
                            option.id,
                            e.target.value,
                          )
                        }
                        placeholder={`Option ${oIndex + 1}`}
                        className="flex-1 px-3 py-2 border rounded-md"
                        maxLength={200}
                      />

                      {/* Remove option button */}
                      {question.options.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(question.id, option.id)}
                          className="text-gray-400 hover:text-red-500"
                        >
                          <Trash className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add option button */}
                {question.options.length < 4 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => addOption(question.id)}
                    className="mt-2 text-gray-500"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    Add Option
                  </Button>
                )}
              </div>

              {/* Validation warning */}
              {!question.correct_option_id &&
                question.options.some((o) => o.text.trim()) && (
                  <p className="text-sm text-amber-600">
                    ⚠️ Please select a correct answer
                  </p>
                )}
            </div>
          ))
        )}
      </div>

      {/* Add question button */}
      {localQuestions.length > 0 && localQuestions.length < 10 && (
        <Button onClick={addQuestion} variant="outline" className="w-full">
          <Plus className="w-4 h-4 mr-2" />
          Add Question
        </Button>
      )}

      {/* Footer */}
      <div className="flex justify-between items-center pt-4 border-t">
        <span className="text-sm text-gray-500">
          {localQuestions.length} question
          {localQuestions.length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={localQuestions.length > 0 && !isValid}
          >
            Save Questions
          </Button>
        </div>
      </div>
    </div>
  );
}
