'use client';

import React from 'react';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Save,
  Eye,
  EyeOff,
  Upload,
  Undo,
  Redo,
  Settings,
  ArrowLeft,
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AdminToolbarProps {
  isEditMode: boolean;
  isDirty?: boolean;
  isPublished?: boolean;
  isSaving?: boolean;
  onToggleMode?: () => void;
  onSave?: () => void;
  onPublish?: () => void;
  onUnpublish?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  title?: string;
}

export function AdminToolbar({
  isEditMode,
  isDirty = false,
  isPublished = false,
  isSaving = false,
  onToggleMode,
  onSave,
  onPublish,
  onUnpublish,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  title = 'Tutorial Editor',
}: AdminToolbarProps) {
  const router = useRouter();

  return (
    <div className="admin-toolbar bg-gray-900 border-b border-gray-700 sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push('/admin/tutorials')}
              className="text-gray-300 hover:text-white hover:bg-gray-800"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>

            <h1 className="text-xl font-semibold text-white">{title}</h1>

            {isDirty && (
              <Badge variant="secondary" className="bg-yellow-600 text-white">
                Unsaved changes
              </Badge>
            )}

            {isPublished ? (
              <Badge variant="success" className="bg-green-600 text-white">
                Published
              </Badge>
            ) : (
              <Badge variant="outline" className="text-gray-300 border-gray-600">Draft</Badge>
            )}
          </div>

          <div className="flex items-center gap-2">
            {isEditMode && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onUndo}
                  disabled={!canUndo}
                  title="Undo"
                  className="text-gray-300 hover:text-white hover:bg-gray-800 disabled:text-gray-600"
                >
                  <Undo className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onRedo}
                  disabled={!canRedo}
                  title="Redo"
                  className="text-gray-300 hover:text-white hover:bg-gray-800 disabled:text-gray-600"
                >
                  <Redo className="w-4 h-4" />
                </Button>
                <div className="w-px h-6 bg-gray-700 mx-2" />
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={onToggleMode}
              className="text-gray-300 border-gray-600 hover:bg-gray-800 hover:text-white"
            >
              {isEditMode ? (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Preview
                </>
              ) : (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Edit
                </>
              )}
            </Button>

            {isEditMode && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onSave}
                  disabled={!isDirty || isSaving}
                  className="bg-blue-600 hover:bg-blue-700 text-white disabled:bg-gray-700 disabled:text-gray-400"
                >
                  {isSaving ? (
                    <>
                      <span className="animate-spin mr-2">⏳</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save
                    </>
                  )}
                </Button>

                {isPublished ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={onUnpublish}
                    className="bg-gray-600 hover:bg-gray-700 text-white"
                  >
                    Unpublish
                  </Button>
                ) : (
                  <Button
                    variant="success"
                    size="sm"
                    onClick={onPublish}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Publish
                  </Button>
                )}
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              title="Settings"
              className="text-gray-300 hover:text-white hover:bg-gray-800"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}