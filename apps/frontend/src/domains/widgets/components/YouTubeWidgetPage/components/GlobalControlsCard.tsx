'use client';

import React from 'react';
import {
  Card,
  CardContent,
} from '@/shared/components/ui/card';
import { GlobalControls } from './GlobalControls';
import { SyncedWidget } from '../../base';
import type { SyncedWidgetRenderProps } from '../../base';
import { useWidgetPageState } from '@/domains/widgets/hooks/useWidgetPageState';

export function GlobalControlsCard() {
  return (
    <SyncedWidget
      widgetId="global-controls"
      widgetName="Global Playback Controls"
      syncOptions={{
        subscribeTo: [
          'PLAYBACK_STATE',
          'TIMELINE_UPDATE',
          'EXERCISE_CHANGE',
          'TEMPO_CHANGE',
        ],
        debugMode: false,
      }}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <GlobalControlsCardContent syncProps={syncProps} />
      )}
    </SyncedWidget>
  );
}

function GlobalControlsCardContent({ syncProps }: { syncProps: SyncedWidgetRenderProps }) {
  const widgetState = useWidgetPageState();

  // Handle tempo changes from global controls
  const handleTempoChange = (newTempo: number) => {
    widgetState.setTempo(newTempo);
    syncProps.sync.actions.emitEvent(
      'TEMPO_CHANGE',
      { tempo: newTempo },
      'high'
    );
  };

  // Handle current time changes
  const handleCurrentTimeChange = (time: number) => {
    syncProps.sync.actions.emitEvent(
      'TIMELINE_UPDATE',
      { currentTime: time },
      'high'
    );
  };

  // Handle volume changes
  const handleVolumeChange = (volume: number) => {
    widgetState.setVolume('master', Math.round(volume * 100));
  };

  // Handle loop region changes
  const handleLoopRegionChange = (region: any) => {
    widgetState.setLoopRegion(region);
  };

  // Handle toggle loop
  const handleToggleLoop = () => {
    widgetState.toggleLoopEnabled();
  };

  return (
    <Card className="bg-transparent border-transparent shadow-none overflow-visible">
      <CardContent className="p-0 overflow-visible">
        <GlobalControls
          isPlaying={widgetState.isPlaying}
          currentTime={syncProps.currentTime || 0}
          tempo={widgetState.tempo}
          masterVolume={widgetState.state.volume.master / 100}
          syncEnabled={widgetState.syncEnabled}
          selectedExercise={syncProps.selectedExercise || undefined}
          duration={syncProps.duration || 0}
          isLoopEnabled={widgetState.isLoopEnabled}
          loopRegion={widgetState.loopRegion}
          onTogglePlayback={widgetState.togglePlayback}
          onCurrentTimeChange={handleCurrentTimeChange}
          onTempoChange={handleTempoChange}
          onVolumeChange={handleVolumeChange}
          onLoopRegionChange={handleLoopRegionChange}
          onToggleLoop={handleToggleLoop}
        />
      </CardContent>
    </Card>
  );
}