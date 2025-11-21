import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { patternApi } from '../repositories/pattern.repository';
import { useAuth } from '@/domains/user/hooks/use-auth';

export interface Pattern {
  id: string;
  type: 'drums' | 'harmony';
  name: string;
  slug: string;
  genre?: string;
  timeSignature: string;
  bars: number;
  midiData: any;
  description?: string;
  tags: string[];
}

export interface TutorialPatternConfig {
  tutorialId: string;
  defaultDrumPattern: Pattern | null;
  defaultHarmonyPattern: Pattern | null;
  allowPatternSwitching: boolean;
}

export interface UsePatternSelectorOptions {
  tutorialId: string;
  onPatternChange?: (type: 'drums' | 'harmony', pattern: Pattern) => void;
}

export function usePatternSelector({ tutorialId, onPatternChange }: UsePatternSelectorOptions) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Current selected patterns
  const [selectedDrumPattern, setSelectedDrumPattern] = useState<Pattern | null>(null);
  const [selectedHarmonyPattern, setSelectedHarmonyPattern] = useState<Pattern | null>(null);

  // Fetch tutorial pattern configuration and available patterns
  const { data, isLoading } = useQuery({
    queryKey: ['patterns', 'tutorial', tutorialId, user?.id],
    queryFn: () => patternApi.getTutorialPatterns(tutorialId),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Save user selection mutation
  const saveSelectionMutation = useMutation({
    mutationFn: (selection: { drumPatternId?: string; harmonyPatternId?: string }) =>
      patternApi.saveUserSelection(tutorialId, selection),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['patterns', 'tutorial', tutorialId],
      });
    },
  });

  // Initialize selected patterns from data
  useEffect(() => {
    if (data) {
      // Use user selection if available, otherwise use defaults
      const drumPattern = data.userSelection?.drumPattern || data.config.defaultDrumPattern;
      const harmonyPattern = data.userSelection?.harmonyPattern || data.config.defaultHarmonyPattern;

      setSelectedDrumPattern(drumPattern);
      setSelectedHarmonyPattern(harmonyPattern);
    }
  }, [data]);

  // Select drum pattern
  const selectDrumPattern = useCallback(
    async (pattern: Pattern) => {
      setSelectedDrumPattern(pattern);

      // Save to backend if user is authenticated
      if (user) {
        await saveSelectionMutation.mutateAsync({
          drumPatternId: pattern.id,
          harmonyPatternId: selectedHarmonyPattern?.id,
        });
      }

      // Notify parent component
      onPatternChange?.('drums', pattern);
    },
    [user, selectedHarmonyPattern, saveSelectionMutation, onPatternChange]
  );

  // Select harmony pattern
  const selectHarmonyPattern = useCallback(
    async (pattern: Pattern) => {
      setSelectedHarmonyPattern(pattern);

      // Save to backend if user is authenticated
      if (user) {
        await saveSelectionMutation.mutateAsync({
          drumPatternId: selectedDrumPattern?.id,
          harmonyPatternId: pattern.id,
        });
      }

      // Notify parent component
      onPatternChange?.('harmony', pattern);
    },
    [user, selectedDrumPattern, saveSelectionMutation, onPatternChange]
  );

  // Reset to defaults
  const resetToDefaults = useCallback(async () => {
    if (data) {
      setSelectedDrumPattern(data.config.defaultDrumPattern);
      setSelectedHarmonyPattern(data.config.defaultHarmonyPattern);

      if (user) {
        await saveSelectionMutation.mutateAsync({
          drumPatternId: data.config.defaultDrumPattern?.id,
          harmonyPatternId: data.config.defaultHarmonyPattern?.id,
        });
      }

      if (data.config.defaultDrumPattern) {
        onPatternChange?.('drums', data.config.defaultDrumPattern);
      }
      if (data.config.defaultHarmonyPattern) {
        onPatternChange?.('harmony', data.config.defaultHarmonyPattern);
      }
    }
  }, [data, user, saveSelectionMutation, onPatternChange]);

  return {
    // Selected patterns
    selectedDrumPattern,
    selectedHarmonyPattern,

    // Available patterns
    availableDrumPatterns: data?.availablePatterns.drums || [],
    availableHarmonyPatterns: data?.availablePatterns.harmony || [],

    // Configuration
    config: data?.config,
    allowPatternSwitching: data?.config.allowPatternSwitching ?? false,

    // Actions
    selectDrumPattern,
    selectHarmonyPattern,
    resetToDefaults,

    // State
    isLoading,
    isSaving: saveSelectionMutation.isPending,
  };
}