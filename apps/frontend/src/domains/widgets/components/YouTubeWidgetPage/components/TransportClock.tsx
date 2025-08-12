'use client';

import React, { useEffect, useState } from 'react';
import { useTransport } from '@/domains/playback/hooks/useTransport';
import { Clock, Activity } from 'lucide-react';

export function TransportClock() {
  const { 
    position, 
    tempo, 
    timeSignature, 
    isPlaying, 
    isPaused, 
    isStopped 
  } = useTransport();
  
  const [audioContextState, setAudioContextState] = useState<string>('unknown');
  const [updateCount, setUpdateCount] = useState(0);
  
  // Monitor AudioContext state
  useEffect(() => {
    const checkAudioContext = () => {
      const coreServices = (window as any).__globalCoreServices;
      if (coreServices?.getAudioEngine) {
        try {
          const audioEngine = coreServices.getAudioEngine();
          const context = audioEngine.getContext();
          if (context) {
            setAudioContextState(context.state);
          }
        } catch (e) {
          setAudioContextState('not initialized');
        }
      }
    };
    
    // Check immediately and then every 500ms
    checkAudioContext();
    const interval = setInterval(checkAudioContext, 500);
    
    return () => clearInterval(interval);
  }, []);
  
  // Count position updates to see if transport is running
  useEffect(() => {
    setUpdateCount(prev => prev + 1);
  }, [position]);
  
  // Format position for display
  const formatPosition = () => {
    if (!position) return '1:1:0';
    
    // Display as bars:beats:sixteenths (1-based for musician-friendly display)
    const bar = position.bars + 1;
    const beat = position.beats + 1;
    const sixteenth = position.sixteenths;
    
    return `${bar}:${beat}:${sixteenth.toString().padStart(2, '0')}`;
  };
  
  // Format seconds
  const formatSeconds = () => {
    if (!position?.seconds) return '0.000s';
    return `${position.seconds.toFixed(3)}s`;
  };
  
  // Get transport state string
  const getTransportState = () => {
    if (isPlaying && !isPaused) return 'PLAYING';
    if (isPaused) return 'PAUSED';
    if (isStopped) return 'STOPPED';
    return 'UNKNOWN';
  };
  
  // Get state color
  const getStateColor = () => {
    if (audioContextState !== 'running') return 'text-yellow-500';
    if (isPlaying && !isPaused) return 'text-green-500';
    if (isPaused) return 'text-yellow-500';
    return 'text-gray-500';
  };
  
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Transport Clock</h3>
        </div>
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-gray-400">Updates: {updateCount}</span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Position */}
        <div className="bg-black/50 rounded p-3 border border-gray-800">
          <div className="text-xs text-gray-400 mb-1">Position</div>
          <div className="text-2xl font-mono font-bold text-white">
            {formatPosition()}
          </div>
          <div className="text-xs text-gray-500 mt-1">{formatSeconds()}</div>
        </div>
        
        {/* State */}
        <div className="bg-black/50 rounded p-3 border border-gray-800">
          <div className="text-xs text-gray-400 mb-1">State</div>
          <div className={`text-lg font-bold ${getStateColor()}`}>
            {getTransportState()}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Audio: {audioContextState}
          </div>
        </div>
        
        {/* Tempo */}
        <div className="bg-black/50 rounded p-3 border border-gray-800">
          <div className="text-xs text-gray-400 mb-1">Tempo</div>
          <div className="text-2xl font-mono font-bold text-white">
            {tempo}
          </div>
          <div className="text-xs text-gray-500 mt-1">BPM</div>
        </div>
        
        {/* Time Signature */}
        <div className="bg-black/50 rounded p-3 border border-gray-800">
          <div className="text-xs text-gray-400 mb-1">Time Sig</div>
          <div className="text-2xl font-mono font-bold text-white">
            {timeSignature.numerator}/{timeSignature.denominator}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Ticks: {position?.ticks || 0}
          </div>
        </div>
      </div>
      
      {/* Debug info */}
      <div className="mt-3 text-xs text-gray-500 font-mono">
        <div>Raw position: bars:{position?.bars || 0} beats:{position?.beats || 0} 16ths:{position?.sixteenths || 0}</div>
        <div>Transport ready: {position ? 'YES' : 'NO'}</div>
      </div>
    </div>
  );
}