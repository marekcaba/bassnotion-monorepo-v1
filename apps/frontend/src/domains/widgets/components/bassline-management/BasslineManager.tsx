'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { Badge } from '@/shared/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/shared/components/ui/tabs';
import { useToast } from '@/shared/hooks/use-toast';
import { SaveBasslineDialog } from './SaveBasslineDialog.js';
import { BasslineList } from './BasslineList.js';
import {
  AutoSaveService,
  type AutoSaveState,
  type AutoSaveCallbacks,
} from '../../services/AutoSave.js';
import type {
  ExerciseNote,
  BasslineMetadata,
  SavedBassline,
  AutoSaveConfig,
} from '@bassnotion/contracts';

interface BasslineManagerProps {
  currentBassline: ExerciseNote[];
  currentMetadata?: Partial<BasslineMetadata>;
  onLoadBassline?: (bassline: SavedBassline) => void;
  onSaveBassline?: (basslineId: string) => void;
  autoSaveConfig?: Partial<AutoSaveConfig>;
  className?: string;
}

export function BasslineManager({
  currentBassline,
  currentMetadata,
  onLoadBassline,
  onSaveBassline,
  autoSaveConfig,
  className = '',
}: BasslineManagerProps) {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [autoSaveService, setAutoSaveService] =
    useState<AutoSaveService | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<AutoSaveState | null>(
    null,
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentBasslineName, setCurrentBasslineName] =
    useState('Untitled Bassline');

  const { toast } = useToast();

  // Initialize auto-save service
  useEffect(() => {
    const callbacks: AutoSaveCallbacks = {
      onAutoSave: (basslineId: string, success: boolean) => {
        if (success) {
          toast({
            title: 'Auto-saved',
            description: 'Your bassline has been automatically saved',
            variant: 'default',
          });
          onSaveBassline?.(basslineId);
          setRefreshTrigger((prev) => prev + 1);
        } else {
          // Trigger auto-save with current data
          if (autoSaveService && currentBassline.length > 0) {
            const metadata: BasslineMetadata = {
              tempo: currentMetadata?.tempo || 120,
              timeSignature: currentMetadata?.timeSignature || '4/4',
              key: currentMetadata?.key || 'C',
              difficulty: currentMetadata?.difficulty || 'beginner',
              tags: currentMetadata?.tags || [],
            };

            autoSaveService.forceSave(
              currentBasslineName,
              currentBassline,
              metadata,
            );
          }
        }
      },
      onError: (error: string) => {
        toast({
          title: 'Auto-save Error',
          description: error,
          variant: 'destructive',
        });
      },
      onStateChange: (state: AutoSaveState) => {
        setAutoSaveState(state);
      },
    };

    const service = new AutoSaveService(autoSaveConfig, callbacks);
    setAutoSaveService(service);

    return () => {
      service.destroy();
    };
  }, [autoSaveConfig, onSaveBassline, currentBasslineName, currentMetadata]);

  // Notify auto-save of changes
  useEffect(() => {
    if (autoSaveService) {
      autoSaveService.onNoteChange();
    }
  }, [currentBassline, autoSaveService]);

  const handleSaveBassline = useCallback(
    (basslineId: string) => {
      onSaveBassline?.(basslineId);
      setRefreshTrigger((prev) => prev + 1);
      setIsSaveDialogOpen(false);

      // Update auto-save state
      if (autoSaveService) {
        autoSaveService.initialize(
          basslineId,
          currentMetadata as BasslineMetadata,
        );
      }
    },
    [onSaveBassline, autoSaveService, currentMetadata],
  );

  const handleLoadBassline = useCallback(
    (bassline: SavedBassline) => {
      onLoadBassline?.(bassline);
      setCurrentBasslineName(bassline.name);

      // Update auto-save state with loaded bassline
      if (autoSaveService) {
        autoSaveService.initialize(bassline.id, bassline.metadata);
      }

      toast({
        title: 'Bassline Loaded',
        description: `"${bassline.name}" has been loaded successfully`,
        variant: 'default',
      });
    },
    [onLoadBassline, autoSaveService],
  );

  const handleEditBassline = useCallback(
    (bassline: SavedBassline) => {
      // For editing, we load the bassline and open the save dialog
      handleLoadBassline(bassline);
      setIsSaveDialogOpen(true);
    },
    [handleLoadBassline],
  );

  const handleManualSave = useCallback(async () => {
    if (!currentBassline.length) {
      toast({
        title: 'Cannot Save',
        description: 'Cannot save an empty bassline',
        variant: 'destructive',
      });
      return;
    }

    if (autoSaveService && autoSaveState?.currentBasslineId) {
      // Quick save to existing bassline
      const metadata: BasslineMetadata = {
        tempo: currentMetadata?.tempo || 120,
        timeSignature: currentMetadata?.timeSignature || '4/4',
        key: currentMetadata?.key || 'C',
        difficulty: currentMetadata?.difficulty || 'beginner',
        tags: currentMetadata?.tags || [],
      };

      const basslineId = await autoSaveService.forceSave(
        currentBasslineName,
        currentBassline,
        metadata,
      );

      if (basslineId) {
        toast({
          title: 'Saved',
          description: `"${currentBasslineName}" has been saved`,
          variant: 'default',
        });
        onSaveBassline?.(basslineId);
        setRefreshTrigger((prev) => prev + 1);
      }
    } else {
      // Open save dialog for new bassline
      setIsSaveDialogOpen(true);
    }
  }, [
    currentBassline,
    currentBasslineName,
    currentMetadata,
    autoSaveService,
    autoSaveState,
    onSaveBassline,
  ]);

  const getAutoSaveStatus = () => {
    if (!autoSaveState) return null;

    if (autoSaveState.isAutoSaving) {
      return (
        <Badge variant="outline" className="bg-blue-50 text-blue-700">
          Auto-saving...
        </Badge>
      );
    }

    if (autoSaveState.isDirty) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700">
          {autoSaveState.changeCount} unsaved changes
        </Badge>
      );
    }

    if (autoSaveState.lastError) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700">
          Auto-save error
        </Badge>
      );
    }

    if (autoSaveState.currentBasslineId) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700">
          Saved
        </Badge>
      );
    }

    return null;
  };

  const canSave = currentBassline.length > 0;
  const hasChanges = autoSaveState?.isDirty || false;

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Bassline Manager</CardTitle>
            <div className="flex items-center gap-2">
              {getAutoSaveStatus()}
              <Button
                onClick={handleManualSave}
                disabled={!canSave}
                variant={hasChanges ? 'default' : 'outline'}
              >
                {autoSaveState?.currentBasslineId ? 'Save' : 'Save As...'}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="library" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="library">My Basslines</TabsTrigger>
              <TabsTrigger value="current">Current Session</TabsTrigger>
            </TabsList>

            <TabsContent value="library" className="mt-4">
              <BasslineList
                onLoadBassline={handleLoadBassline}
                onEditBassline={handleEditBassline}
                refreshTrigger={refreshTrigger}
              />
            </TabsContent>

            <TabsContent value="current" className="mt-4 space-y-4">
              <div className="p-4 border rounded-lg bg-gray-50">
                <h3 className="font-medium mb-2">Current Bassline</h3>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Name:</span>
                    <span className="font-medium">{currentBasslineName}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Notes:</span>
                    <Badge variant="outline">{currentBassline.length}</Badge>
                  </div>
                  {currentMetadata && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Tempo:</span>
                        <span>{currentMetadata.tempo || 120} BPM</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Key:</span>
                        <span>{currentMetadata.key || 'C'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">
                          Difficulty:
                        </span>
                        <Badge variant="outline">
                          {currentMetadata.difficulty || 'beginner'}
                        </Badge>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {autoSaveState && (
                <div className="p-4 border rounded-lg">
                  <h3 className="font-medium mb-2">Auto-save Status</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Status:</span>
                      {getAutoSaveStatus()}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Changes:</span>
                      <span>{autoSaveState.changeCount}</span>
                    </div>
                    {autoSaveState.lastSaveTime > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Last saved:</span>
                        <span>
                          {new Date(
                            autoSaveState.lastSaveTime,
                          ).toLocaleTimeString()}
                        </span>
                      </div>
                    )}
                    {autoSaveState.lastError && (
                      <div className="text-red-600 text-xs">
                        Error: {autoSaveState.lastError}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={() => setIsSaveDialogOpen(true)}
                  disabled={!canSave}
                  variant="outline"
                  className="flex-1"
                >
                  Save As New...
                </Button>
                <Button
                  onClick={handleManualSave}
                  disabled={!canSave}
                  className="flex-1"
                >
                  {autoSaveState?.currentBasslineId ? 'Update' : 'Save'}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <SaveBasslineDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        bassline={currentBassline}
        defaultMetadata={currentMetadata}
        onSave={handleSaveBassline}
      />
    </div>
  );
}
