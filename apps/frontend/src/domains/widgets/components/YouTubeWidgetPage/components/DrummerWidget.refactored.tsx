'use client';

/**
 * DrummerWidget - Refactored for Track-Based WAM Plugin Architecture
 * 
 * NEW ARCHITECTURE:
 * - Uses useTrack hook to create a dedicated drum track
 * - Loads WAM drummer plugin into the track
 * - No more pattern registration complexity
 * - Clean separation: Widget = UI Controller, Track = Audio Engine
 * 
 * This is how professional DAWs work:
 * - Each widget controls a track
 * - Each track can load plugins
 * - UnifiedTransport provides sample-accurate timing
 * - EventBus handles communication
 */

import React, { useEffect, useState, useCallback } from 'react';
import { VolumeKnob } from './VolumeKnob';
import { useTrack } from '@/domains/playback/hooks/useTrack';
import { useWAMPlugin } from '@/domains/playback/hooks/useWAMPlugin';

const logger = {
  log: (...args: any[]) => console.log('🥁 DrummerWidget:', ...args),
  error: (...args: any[]) => console.error('🥁 DrummerWidget Error:', ...args),
};

interface DrummerWidgetProps {
  pattern: string;
  isVisible: boolean;
  onPatternChange: (pattern: string) => void;
  onToggleVisibility: () => void;
}

// Drum pattern data structure: 3 rows (HH, SN, K) x 8 columns
const drummerPatterns = {
  hihat: Array.from({ length: 8 }, (_, i) => ({
    beat: i + 1,
    isActive: true, // Hi-hats on all eighth notes
    intensity: 'medium',
  })),
  snare: Array.from({ length: 8 }, (_, i) => ({
    beat: i + 1,
    isActive: i === 2 || i === 6, // Beats 3 and 7 (0-indexed: 2 and 6)
    intensity: 'high',
  })),
  kick: Array.from({ length: 8 }, (_, i) => ({
    beat: i + 1,
    isActive: i === 0 || i === 4, // Beats 1 and 5 (0-indexed: 0 and 4)
    intensity: 'high',
  })),
};

const availablePatterns = [
  'Jazz Swing',
  'Rock Steady',
  'Bossa Nova',
  'Funk Groove',
  'Latin',
  'Shuffle',
];

export function DrummerWidget({
  pattern,
  isVisible,
  onPatternChange,
  onToggleVisibility,
}: DrummerWidgetProps) {
  
  // NEW: Create dedicated drum track
  const track = useTrack({
    trackId: 'drummer-track',
    name: 'Drummer',
    type: 'drums',
    debugMode: true
  });
  
  // NEW: Load WAM drummer plugin into track
  const wamPlugin = useWAMPlugin({
    track: track.track,
    pluginUrl: '/wam/drummer-plugin',
    autoLoad: true,
    debugMode: true
  });
  
  // Widget state (UI only)
  const [currentBeat, setCurrentBeat] = useState(0);
  const [patterns, setPatterns] = useState(drummerPatterns);
  const [isExpanded, setIsExpanded] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  
  // Transport state comes from track
  const { isPlaying, tempo, currentTime } = track;
  
  logger.log('DrummerWidget render:', {
    trackReady: track.isReady,
    pluginReady: wamPlugin.isReady,
    isPlaying,
    tempo
  });
  
  /**
   * Handle pattern changes - send to WAM plugin
   */
  const updateDrumPattern = useCallback(() => {
    if (!wamPlugin.isReady) return;
    
    logger.log('Updating drum pattern in WAM plugin');
    
    // Convert UI pattern to WAM plugin format
    const wamPattern = {
      hihat: patterns.hihat,
      snare: patterns.snare,
      kick: patterns.kick,
      tempo: tempo,
      timeSignature: [4, 4]
    };
    
    // Send pattern to WAM plugin
    wamPlugin.setParameter('pattern', wamPattern);
    wamPlugin.setParameter('enabled', isPlaying);
    
  }, [patterns, wamPlugin, tempo, isPlaying]);
  
  /**
   * Update pattern when UI changes
   */
  useEffect(() => {
    updateDrumPattern();
  }, [updateDrumPattern]);
  
  /**
   * Handle volume changes
   */
  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    const normalizedVolume = newVolume / 100;
    
    // Update track volume
    track.setVolume(normalizedVolume);
    
    // Update WAM plugin volume
    wamPlugin.setVolume(normalizedVolume);
    
    logger.log('Volume changed:', { volume: newVolume, normalized: normalizedVolume });
  }, [track, wamPlugin]);
  
  /**
   * Handle mute toggle
   */
  const handleMuteToggle = useCallback(() => {
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    
    // Update track mute
    track.mute(newMuted);
    
    // Update WAM plugin mute
    wamPlugin.setMute(newMuted);
    
    logger.log('Mute toggled:', { muted: newMuted });
  }, [isMuted, track, wamPlugin]);
  
  /**
   * Handle transport controls
   */
  const handlePlay = useCallback(() => {
    logger.log('Play button clicked');
    track.play();
  }, [track]);
  
  const handleStop = useCallback(() => {
    logger.log('Stop button clicked');
    track.stop();
  }, [track]);
  
  /**
   * Handle pad triggers (for manual playing)
   */
  const triggerPad = useCallback((drumType: 'kick' | 'snare' | 'hihat', velocity: number = 0.8) => {
    if (!wamPlugin.isReady) return;
    
    logger.log('Triggering pad:', { drumType, velocity });
    
    // Map drum types to MIDI notes or pad numbers
    const noteMap = {
      kick: 36,   // C1
      snare: 38,  // D1
      hihat: 42   // F#1
    };
    
    wamPlugin.trigger(noteMap[drumType], velocity);
  }, [wamPlugin]);
  
  /**
   * Toggle pattern step
   */
  const toggleStep = useCallback((drumType: keyof typeof patterns, stepIndex: number) => {
    setPatterns(prev => ({
      ...prev,
      [drumType]: prev[drumType].map((step, index) =>
        index === stepIndex ? { ...step, isActive: !step.isActive } : step
      )
    }));
  }, []);
  
  // Show loading state while track/plugin initializes
  if (!track.isReady || !wamPlugin.isReady) {
    return (
      <div className="drummer-widget loading">
        <div className="loading-spinner">
          <div>🥁</div>
          <p>Loading Drummer Track...</p>
          <div className="loading-details">
            <div>Track: {track.isReady ? '✅' : '⏳'}</div>
            <div>WAM Plugin: {wamPlugin.isReady ? '✅' : '⏳'}</div>
          </div>
        </div>
      </div>
    );
  }
  
  // Show error state
  if (track.error || wamPlugin.error) {
    return (
      <div className="drummer-widget error">
        <div className="error-message">
          <div>❌ Error Loading Drummer</div>
          <p>{track.error?.message || wamPlugin.error?.message}</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={`drummer-widget ${isVisible ? 'visible' : 'hidden'}`}>
      {/* Header */}
      <div className="widget-header">
        <div className="widget-title">
          <span className="icon">🥁</span>
          <span>Drummer Track</span>
          <span className="status">
            {isPlaying ? '▶️' : '⏸️'} {Math.round(tempo)} BPM
          </span>
        </div>
        
        <div className="widget-controls">
          <button onClick={handlePlay} disabled={isPlaying}>
            ▶️ Play
          </button>
          <button onClick={handleStop} disabled={!isPlaying}>
            ⏹️ Stop
          </button>
          <button onClick={onToggleVisibility}>
            {isVisible ? '👁️' : '👁️‍🗨️'}
          </button>
        </div>
      </div>
      
      {isVisible && (
        <>
          {/* Pattern Selection */}
          <div className="pattern-selector">
            <label>Pattern:</label>
            <select 
              value={pattern} 
              onChange={(e) => onPatternChange(e.target.value)}
            >
              {availablePatterns.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          
          {/* Drum Pads for Manual Triggering */}
          <div className="drum-pads">
            <button 
              className="pad kick"
              onMouseDown={() => triggerPad('kick')}
            >
              KICK
            </button>
            <button 
              className="pad snare"
              onMouseDown={() => triggerPad('snare')}
            >
              SNARE
            </button>
            <button 
              className="pad hihat"
              onMouseDown={() => triggerPad('hihat')}
            >
              HI-HAT
            </button>
          </div>
          
          {/* Pattern Grid */}
          <div className="pattern-grid">
            {Object.entries(patterns).map(([drumType, steps]) => (
              <div key={drumType} className="pattern-row">
                <div className="row-label">{drumType.toUpperCase()}</div>
                <div className="steps">
                  {steps.map((step, index) => (
                    <button
                      key={index}
                      className={`step ${step.isActive ? 'active' : ''} ${
                        isPlaying && index === currentBeat ? 'current' : ''
                      }`}
                      onClick={() => toggleStep(drumType as keyof typeof patterns, index)}
                    >
                      {index + 1}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          
          {/* Volume Control */}
          <div className="volume-section">
            <VolumeKnob
              volume={volume}
              onChange={handleVolumeChange}
              label="Drum Volume"
            />
            <button 
              className={`mute-button ${isMuted ? 'muted' : ''}`}
              onClick={handleMuteToggle}
            >
              {isMuted ? '🔇' : '🔊'}
            </button>
          </div>
          
          {/* Track Info */}
          <div className="track-info">
            <div>Track ID: {track.trackId}</div>
            <div>Plugin: {wamPlugin.plugin?.descriptor?.name || 'WAM Drummer'}</div>
            <div>State: {track.state}</div>
          </div>
        </>
      )}
    </div>
  );
}

/* CSS Styles */
const styles = `
.drummer-widget {
  background: #2a2a2a;
  border: 1px solid #444;
  border-radius: 8px;
  padding: 16px;
  color: white;
  font-family: monospace;
}

.drummer-widget.hidden {
  height: 60px;
  overflow: hidden;
}

.loading-spinner, .error-message {
  text-align: center;
  padding: 40px;
}

.loading-details div {
  margin: 8px 0;
  font-size: 14px;
}

.widget-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #444;
}

.widget-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
}

.widget-controls {
  display: flex;
  gap: 8px;
}

.widget-controls button {
  background: #444;
  border: none;
  color: white;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.widget-controls button:hover {
  background: #555;
}

.widget-controls button:disabled {
  background: #333;
  color: #666;
  cursor: not-allowed;
}

.pattern-selector {
  margin-bottom: 16px;
}

.pattern-selector select {
  background: #333;
  border: 1px solid #555;
  color: white;
  padding: 8px;
  border-radius: 4px;
  margin-left: 8px;
}

.drum-pads {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.pad {
  background: #444;
  border: 2px solid #666;
  color: white;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.1s;
}

.pad:hover {
  background: #555;
  border-color: #777;
}

.pad:active {
  background: #666;
  transform: scale(0.95);
}

.pattern-grid {
  margin-bottom: 16px;
}

.pattern-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.row-label {
  width: 60px;
  font-weight: bold;
  font-size: 12px;
}

.steps {
  display: flex;
  gap: 4px;
}

.step {
  width: 32px;
  height: 32px;
  background: #333;
  border: 1px solid #555;
  color: #999;
  border-radius: 4px;
  cursor: pointer;
  font-size: 10px;
}

.step.active {
  background: #0066cc;
  color: white;
  border-color: #0088ff;
}

.step.current {
  box-shadow: 0 0 8px #ffaa00;
  border-color: #ffaa00;
}

.volume-section {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.mute-button {
  background: #444;
  border: 1px solid #666;
  color: white;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
}

.mute-button.muted {
  background: #cc3333;
  border-color: #ff4444;
}

.track-info {
  font-size: 11px;
  color: #999;
  border-top: 1px solid #444;
  padding-top: 12px;
}

.track-info div {
  margin: 2px 0;
}
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleElement = document.createElement('style');
  styleElement.textContent = styles;
  document.head.appendChild(styleElement);
}
