'use client';

import React, { useState, useEffect } from 'react';
import { profileService } from '../api/profile';
import { useUserProfile } from '../hooks/use-user-profile';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface BassSettings {
  stringCount: 4 | 5 | 6;
  maxFrets: number;
}

interface BassSettingsCardProps {
  onSettingsChange?: (settings: BassSettings) => void;
}

export function BassSettingsCard({ onSettingsChange }: BassSettingsCardProps) {
  const { correlationId, logger } = useCorrelation('BassSettingsCard');
  const { profile, isLoading: isLoadingProfile } = useUserProfile();
  const [settings, setSettings] = useState<BassSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<BassSettings | null>(
    null,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Determine if we're in initial loading state
  const isInitializing = isLoadingProfile || settings === null;

  // Load settings from user profile once it's available
  useEffect(() => {
    if (profile?.preferences?.bassConfiguration) {
      const newSettings = {
        stringCount: profile.preferences.bassConfiguration.stringCount,
        maxFrets: profile.preferences.bassConfiguration.maxFrets,
      };
      setSettings(newSettings);
      setOriginalSettings(newSettings);
      onSettingsChange?.(newSettings);
    } else if (profile && !profile.preferences?.bassConfiguration) {
      // Profile loaded but no bass config - use defaults
      const defaultSettings = {
        stringCount: 4 as const,
        maxFrets: 24,
      };
      setSettings(defaultSettings);
      setOriginalSettings(defaultSettings);
      onSettingsChange?.(defaultSettings);
    }
  }, [profile, onSettingsChange]);

  // Check if settings have changed
  useEffect(() => {
    if (settings && originalSettings) {
      const changed =
        settings.stringCount !== originalSettings.stringCount ||
        settings.maxFrets !== originalSettings.maxFrets;
      setHasChanges(changed);

      // Reset justSaved when user makes new changes
      if (changed && justSaved) {
        setJustSaved(false);
      }
    }
  }, [settings, originalSettings, justSaved]);

  const handleStringCountChange = (newCount: 4 | 5 | 6) => {
    if (!settings) return;
    const newSettings = { ...settings, stringCount: newCount };
    setSettings(newSettings);
  };

  const handleFretsChange = (newFrets: number) => {
    if (!settings) return;
    const newSettings = { ...settings, maxFrets: newFrets };
    setSettings(newSettings);
  };

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);

    try {
      await profileService.updateBassConfiguration(settings);
      setOriginalSettings(settings);
      onSettingsChange?.(settings);
      setJustSaved(true);

      // Auto-hide the "Saved" state after 2 seconds
      setTimeout(() => {
        setJustSaved(false);
      }, 2000);
    } catch (error) {
      logger.error('Failed to save bass configuration:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalSettings) {
      setSettings(originalSettings);
    }
  };

  // Skeleton component for loading state
  if (isInitializing) {
    return (
      <div className="w-full p-6 border rounded-lg bg-white">
        <div className="h-8 bg-gray-200 rounded mb-4 animate-pulse"></div>

        {/* String Count Skeleton */}
        <div className="mb-6">
          <div className="h-6 bg-gray-200 rounded mb-3 w-32 animate-pulse"></div>
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 bg-gray-200 rounded px-4 py-2 w-24 animate-pulse"
              ></div>
            ))}
          </div>
        </div>

        {/* Fret Count Skeleton */}
        <div className="mb-6">
          <div className="h-6 bg-gray-200 rounded mb-3 w-32 animate-pulse"></div>
          <div className="grid grid-cols-4 gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="h-10 bg-gray-200 rounded animate-pulse"
              ></div>
            ))}
          </div>
        </div>

        {/* Configuration Display Skeleton */}
        <div className="p-4 bg-gray-100 rounded-lg mb-4">
          <div className="h-5 bg-gray-200 rounded mb-2 w-40 animate-pulse"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
          </div>
        </div>

        {/* Buttons Skeleton */}
        <div className="flex gap-3 pt-4 border-t">
          <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse"></div>
          <div className="flex-1 h-10 bg-gray-200 rounded animate-pulse"></div>
        </div>
      </div>
    );
  }

  // Render actual component once data is loaded
  return (
    <div className="w-full p-6 border rounded-lg bg-white">
      <h2 className="text-2xl font-bold mb-4">🎸 Bass Configuration</h2>

      {/* String Count Selector */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Number of Strings</h3>
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded font-medium transition-colors ${
              settings?.stringCount === 4
                ? 'bg-blue-500 text-white'
                : 'border border-gray-300 hover:bg-gray-100'
            }`}
            onClick={() => handleStringCountChange(4)}
          >
            4 Strings
          </button>
          <button
            className={`px-4 py-2 rounded font-medium transition-colors ${
              settings?.stringCount === 5
                ? 'bg-blue-500 text-white'
                : 'border border-gray-300 hover:bg-gray-100'
            }`}
            onClick={() => handleStringCountChange(5)}
          >
            5 Strings
          </button>
          <button
            className={`px-4 py-2 rounded font-medium transition-colors ${
              settings?.stringCount === 6
                ? 'bg-blue-500 text-white'
                : 'border border-gray-300 hover:bg-gray-100'
            }`}
            onClick={() => handleStringCountChange(6)}
          >
            6 Strings
          </button>
        </div>
      </div>

      {/* Fret Count Selector */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-3">Number of Frets</h3>
        <div className="grid grid-cols-4 gap-2">
          {[19, 20, 21, 22, 23, 24, 25].map((frets) => (
            <button
              key={frets}
              className={`px-3 py-2 rounded font-medium transition-colors ${
                settings?.maxFrets === frets
                  ? 'bg-blue-500 text-white'
                  : 'border border-gray-300 hover:bg-gray-100'
              }`}
              onClick={() => handleFretsChange(frets)}
            >
              {frets}
            </button>
          ))}
        </div>
      </div>

      {/* Current Configuration Display */}
      <div className="p-4 bg-gray-100 rounded-lg">
        <h4 className="font-medium mb-2">Current Configuration</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <div>
            Strings:{' '}
            <span className="font-medium text-gray-900">
              {settings?.stringCount}
            </span>
          </div>
          <div>
            Frets:{' '}
            <span className="font-medium text-gray-900">
              {settings?.maxFrets}
            </span>
          </div>
        </div>
      </div>

      {/* Save/Cancel Buttons */}
      <div className="flex gap-3 pt-4 border-t">
        <button
          onClick={handleSave}
          disabled={(!hasChanges && !justSaved) || isSaving}
          className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
            justSaved
              ? 'bg-green-500 text-white'
              : hasChanges && !isSaving
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isSaving ? 'Saving...' : justSaved ? '✓ Saved' : 'Save'}
        </button>
        <button
          onClick={handleCancel}
          disabled={!hasChanges || isSaving}
          className={`flex-1 px-4 py-2 rounded font-medium transition-colors ${
            hasChanges && !isSaving
              ? 'border border-gray-300 hover:bg-gray-100'
              : 'bg-gray-100 text-gray-400 cursor-not-allowed'
          }`}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
