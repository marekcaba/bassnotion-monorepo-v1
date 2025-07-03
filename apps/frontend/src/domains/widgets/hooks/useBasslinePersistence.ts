import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AutoSaveService,
  type AutoSaveState,
  type AutoSaveCallbacks,
} from '../services/AutoSave';
import { UserBasslinesAPI } from '../api/user-basslines';
import type {
  ExerciseNote,
  BasslineMetadata,
  SavedBassline,
  AutoSaveConfig,
} from '@bassnotion/contracts';

export interface UseBasslinePersistenceConfig {
  autoSaveConfig?: Partial<AutoSaveConfig>;
  onSaveSuccess?: (basslineId: string) => void;
  onLoadSuccess?: (bassline: SavedBassline) => void;
  onError?: (error: string) => void;
}

export interface BasslinePersistenceState {
  currentBassline: ExerciseNote[];
  currentMetadata: Partial<BasslineMetadata>;
  currentBasslineId?: string;
  currentBasslineName: string;
  isDirty: boolean;
  isLoading: boolean;
  autoSaveState?: AutoSaveState;
}

export function useBasslinePersistence(
  config: UseBasslinePersistenceConfig = {},
) {
  const [state, setState] = useState<BasslinePersistenceState>({
    currentBassline: [],
    currentMetadata: {
      tempo: 120,
      timeSignature: '4/4',
      key: 'C',
      difficulty: 'beginner',
      tags: [],
    },
    currentBasslineName: 'Untitled Bassline',
    isDirty: false,
    isLoading: false,
  });

  const autoSaveServiceRef = useRef<AutoSaveService | null>(null);

  // Initialize auto-save service
  useEffect(() => {
    const callbacks: AutoSaveCallbacks = {
      onAutoSave: (basslineId: string, success: boolean) => {
        if (success) {
          setState((prev) => ({
            ...prev,
            currentBasslineId: basslineId,
            isDirty: false,
          }));
          config.onSaveSuccess?.(basslineId);
        }
      },
      onError: (error: string) => {
        config.onError?.(error);
      },
      onStateChange: (autoSaveState: AutoSaveState) => {
        setState((prev) => ({
          ...prev,
          autoSaveState,
          isDirty: autoSaveState.isDirty,
        }));
      },
    };

    const service = new AutoSaveService(config.autoSaveConfig, callbacks);
    autoSaveServiceRef.current = service;

    return () => {
      service.destroy();
      autoSaveServiceRef.current = null;
    };
  }, [config.autoSaveConfig, config.onSaveSuccess, config.onError]);

  // Update bassline
  const updateBassline = useCallback((notes: ExerciseNote[]) => {
    setState((prev) => ({
      ...prev,
      currentBassline: notes,
      isDirty: true,
    }));

    // Notify auto-save service
    autoSaveServiceRef.current?.onNoteChange();
  }, []);

  // Update metadata
  const updateMetadata = useCallback((metadata: Partial<BasslineMetadata>) => {
    setState((prev) => ({
      ...prev,
      currentMetadata: { ...prev.currentMetadata, ...metadata },
      isDirty: true,
    }));

    // Notify auto-save service
    autoSaveServiceRef.current?.onNoteChange();
  }, []);

  // Update bassline name
  const updateBasslineName = useCallback((name: string) => {
    setState((prev) => ({
      ...prev,
      currentBasslineName: name,
      isDirty: true,
    }));
  }, []);

  // Save bassline manually
  const saveBassline = useCallback(
    async (name?: string, description?: string, overwriteExisting = false) => {
      if (state.currentBassline.length === 0) {
        throw new Error('Cannot save empty bassline');
      }

      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        const response = await UserBasslinesAPI.saveBassline({
          name: name || state.currentBasslineName,
          description,
          notes: state.currentBassline,
          metadata: state.currentMetadata as BasslineMetadata,
          overwriteExisting,
        });

        setState((prev) => ({
          ...prev,
          currentBasslineId: response.bassline.id,
          currentBasslineName: response.bassline.name,
          isDirty: false,
          isLoading: false,
        }));

        // Update auto-save service
        autoSaveServiceRef.current?.initialize(
          response.bassline.id,
          response.bassline.metadata,
        );

        config.onSaveSuccess?.(response.bassline.id);
        return response.bassline;
      } catch (error: any) {
        setState((prev) => ({ ...prev, isLoading: false }));
        const errorMessage =
          error?.response?.data?.message || error?.message || 'Save failed';
        config.onError?.(errorMessage);
        throw error;
      }
    },
    [state, config.onSaveSuccess, config.onError],
  );

  // Load bassline
  const loadBassline = useCallback(
    async (basslineIdOrBassline: string | SavedBassline) => {
      setState((prev) => ({ ...prev, isLoading: true }));

      try {
        let bassline: SavedBassline;

        if (typeof basslineIdOrBassline === 'string') {
          bassline =
            await UserBasslinesAPI.getBasslineById(basslineIdOrBassline);
        } else {
          bassline = basslineIdOrBassline;
        }

        setState((prev) => ({
          ...prev,
          currentBassline: bassline.notes,
          currentMetadata: bassline.metadata,
          currentBasslineId: bassline.id,
          currentBasslineName: bassline.name,
          isDirty: false,
          isLoading: false,
        }));

        // Update auto-save service
        autoSaveServiceRef.current?.initialize(bassline.id, bassline.metadata);

        config.onLoadSuccess?.(bassline);
        return bassline;
      } catch (error: any) {
        setState((prev) => ({ ...prev, isLoading: false }));
        const errorMessage =
          error?.response?.data?.message || error?.message || 'Load failed';
        config.onError?.(errorMessage);
        throw error;
      }
    },
    [config.onLoadSuccess, config.onError],
  );

  // Force auto-save
  const forceAutoSave = useCallback(async () => {
    if (!autoSaveServiceRef.current || state.currentBassline.length === 0) {
      return null;
    }

    return autoSaveServiceRef.current.forceSave(
      state.currentBasslineName,
      state.currentBassline,
      state.currentMetadata as BasslineMetadata,
    );
  }, [state]);

  // Clear current bassline
  const clearBassline = useCallback(() => {
    setState((prev) => ({
      ...prev,
      currentBassline: [],
      currentBasslineId: undefined,
      currentBasslineName: 'Untitled Bassline',
      isDirty: false,
    }));

    // Reset auto-save service
    autoSaveServiceRef.current?.initialize();
  }, []);

  // Create new bassline with template
  const createNewBassline = useCallback(
    (
      template?: Partial<{
        notes: ExerciseNote[];
        metadata: BasslineMetadata;
        name: string;
      }>,
    ) => {
      setState((prev) => ({
        ...prev,
        currentBassline: template?.notes || [],
        currentMetadata: template?.metadata || {
          tempo: 120,
          timeSignature: '4/4',
          key: 'C',
          difficulty: 'beginner',
          tags: [],
        },
        currentBasslineName: template?.name || 'Untitled Bassline',
        currentBasslineId: undefined,
        isDirty: Boolean(template?.notes?.length),
      }));

      // Reset auto-save service
      autoSaveServiceRef.current?.initialize();
    },
    [],
  );

  return {
    // State
    ...state,

    // Actions
    updateBassline,
    updateMetadata,
    updateBasslineName,
    saveBassline,
    loadBassline,
    forceAutoSave,
    clearBassline,
    createNewBassline,

    // Auto-save service reference (for advanced usage)
    autoSaveService: autoSaveServiceRef.current,
  };
}
