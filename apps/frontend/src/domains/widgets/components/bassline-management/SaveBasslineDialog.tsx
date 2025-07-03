'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { useToast } from '@/shared/hooks/use-toast';
import { UserBasslinesAPI } from '../../api/user-basslines';
import type {
  ExerciseNote,
  BasslineMetadata,
  SaveBasslineRequest,
  ExerciseDifficulty,
} from '@bassnotion/contracts';

interface SaveBasslineDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bassline: ExerciseNote[];
  defaultMetadata?: Partial<BasslineMetadata>;
  onSave?: (basslineId: string) => void;
}

export function SaveBasslineDialog({
  isOpen,
  onClose,
  bassline,
  defaultMetadata,
  onSave,
}: SaveBasslineDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tempo, setTempo] = useState(defaultMetadata?.tempo || 120);
  const [timeSignature, setTimeSignature] = useState(
    defaultMetadata?.timeSignature || '4/4',
  );
  const [key, setKey] = useState(defaultMetadata?.key || 'C');
  const [difficulty, setDifficulty] = useState<ExerciseDifficulty>(
    defaultMetadata?.difficulty || 'beginner',
  );
  const [tags, setTags] = useState<string[]>(defaultMetadata?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const { toast } = useToast();

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a name for your bassline',
        variant: 'destructive',
      });
      return;
    }

    if (bassline.length === 0) {
      toast({
        title: 'Error',
        description: 'Cannot save an empty bassline',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const saveRequest: SaveBasslineRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        notes: bassline,
        metadata: {
          tempo,
          timeSignature,
          key,
          difficulty,
          tags,
        },
        overwriteExisting,
      };

      const response = await UserBasslinesAPI.saveBassline(saveRequest);

      toast({
        title: 'Success',
        description: response.message,
        variant: 'default',
      });

      onSave?.(response.bassline.id);
      handleClose();
    } catch (error: any) {
      console.error('Error saving bassline:', error);

      let errorMessage = 'Failed to save bassline';
      if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });

      // If it's a conflict error, suggest overwriting
      if (error?.response?.status === 409) {
        setOverwriteExisting(true);
        toast({
          title: 'Name Conflict',
          description:
            'A bassline with this name already exists. Enable "Overwrite Existing" to replace it.',
          variant: 'default',
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setTempo(defaultMetadata?.tempo || 120);
    setTimeSignature(defaultMetadata?.timeSignature || '4/4');
    setKey(defaultMetadata?.key || 'C');
    setDifficulty(defaultMetadata?.difficulty || 'beginner');
    setTags(defaultMetadata?.tags || []);
    setTagInput('');
    setOverwriteExisting(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save Bassline</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Basic Information */}
          <div className="space-y-2">
            <Label htmlFor="bassline-name">Name *</Label>
            <Input
              id="bassline-name"
              placeholder="Enter bassline name..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="bassline-description">Description</Label>
            <textarea
              id="bassline-description"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={3}
              placeholder="Optional description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Metadata */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="tempo">Tempo (BPM)</Label>
                  <Input
                    id="tempo"
                    type="number"
                    min="40"
                    max="300"
                    value={tempo}
                    onChange={(e) => setTempo(parseInt(e.target.value) || 120)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time-signature">Time Signature</Label>
                  <Input
                    id="time-signature"
                    placeholder="4/4"
                    value={timeSignature}
                    onChange={(e) => setTimeSignature(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="key">Key</Label>
                  <Input
                    id="key"
                    placeholder="C"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="difficulty">Difficulty</Label>
                  <select
                    id="difficulty"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(e.target.value as ExerciseDifficulty)
                    }
                    disabled={isLoading}
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label htmlFor="tags">Tags</Label>
                <div className="flex gap-2">
                  <Input
                    id="tags"
                    placeholder="Add tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={isLoading}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddTag}
                    disabled={!tagInput.trim() || isLoading}
                  >
                    Add
                  </Button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tags.map((tag) => (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="cursor-pointer"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        {tag} ×
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Options */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="overwrite"
              checked={overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
              disabled={isLoading}
            />
            <Label htmlFor="overwrite" className="text-sm">
              Overwrite existing bassline with same name
            </Label>
          </div>

          {/* Preview */}
          <div className="text-sm text-gray-600">
            <span className="font-medium">{bassline.length}</span> notes will be
            saved
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !name.trim()}>
            {isLoading ? 'Saving...' : 'Save Bassline'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
