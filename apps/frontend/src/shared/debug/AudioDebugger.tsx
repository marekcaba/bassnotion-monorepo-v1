'use client';

import React, { useEffect, useState } from 'react';
import { createStructuredLogger } from '@bassnotion/contracts';

interface AudioEvent {
  timestamp: string;
  service: string;
  action: string;
  data?: any;
  correlationId?: string;
}

// Global audio event buffer
const audioEvents: AudioEvent[] = [];
const MAX_EVENTS = 100;

// Export function to log audio events
export function logAudioEvent(service: string, action: string, data?: any, correlationId?: string) {
  if (process.env.NEXT_PUBLIC_DEBUG_AUDIO !== 'true') return;
  
  const event: AudioEvent = {
    timestamp: new Date().toISOString(),
    service,
    action,
    data,
    correlationId,
  };
  
  audioEvents.unshift(event);
  if (audioEvents.length > MAX_EVENTS) {
    audioEvents.length = MAX_EVENTS;
  }
  
  // Also log to console with structured logger
  const logger = createStructuredLogger(`audio:${service}`);
  logger.debug(action, { ...data, correlationId });
  
  // Emit custom event for React component
  window.dispatchEvent(new CustomEvent('audio-debug-event', { detail: event }));
}

export function AudioDebugPanel() {
  const [events, setEvents] = useState<AudioEvent[]>([]);
  const [isMinimized, setIsMinimized] = useState(true);
  const [filter, setFilter] = useState('');
  
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_DEBUG_AUDIO !== 'true') return;
    
    // Initialize with existing events
    setEvents([...audioEvents]);
    
    // Listen for new events
    const handleEvent = (e: Event) => {
      const customEvent = e as CustomEvent;
      setEvents(prev => [customEvent.detail, ...prev].slice(0, MAX_EVENTS));
    };
    
    window.addEventListener('audio-debug-event', handleEvent);
    return () => window.removeEventListener('audio-debug-event', handleEvent);
  }, []);
  
  if (process.env.NEXT_PUBLIC_DEBUG_AUDIO !== 'true') {
    return null;
  }
  
  const filteredEvents = filter
    ? events.filter(e => 
        e.service.includes(filter) || 
        e.action.includes(filter) ||
        JSON.stringify(e.data).includes(filter)
      )
    : events;
  
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: isMinimized ? 200 : 600,
        maxHeight: isMinimized ? 60 : 400,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        color: '#00ff00',
        fontFamily: 'monospace',
        fontSize: '12px',
        borderRadius: '8px',
        overflow: 'hidden',
        zIndex: 9999,
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div
        style={{
          padding: '10px',
          backgroundColor: 'rgba(0, 255, 0, 0.1)',
          cursor: 'pointer',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
        onClick={() => setIsMinimized(!isMinimized)}
      >
        <span>🎵 Audio Debug ({events.length})</span>
        <span>{isMinimized ? '▲' : '▼'}</span>
      </div>
      
      {!isMinimized && (
        <>
          <div style={{ padding: '10px' }}>
            <input
              type="text"
              placeholder="Filter events..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '5px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid #00ff00',
                borderRadius: '4px',
                color: '#00ff00',
              }}
            />
          </div>
          
          <div
            style={{
              maxHeight: '300px',
              overflowY: 'auto',
              padding: '10px',
            }}
          >
            {filteredEvents.map((event, index) => (
              <div
                key={index}
                style={{
                  marginBottom: '10px',
                  padding: '5px',
                  backgroundColor: 'rgba(0, 255, 0, 0.05)',
                  borderRadius: '4px',
                }}
              >
                <div style={{ color: '#00ff00' }}>
                  [{event.timestamp.split('T')[1].split('.')[0]}] {event.service} → {event.action}
                </div>
                {event.correlationId && (
                  <div style={{ color: '#888', fontSize: '10px' }}>
                    ID: {event.correlationId.substring(0, 8)}...
                  </div>
                )}
                {event.data && (
                  <div style={{ color: '#0088ff', fontSize: '11px', marginTop: '2px' }}>
                    {JSON.stringify(event.data, null, 2)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Helper hook to use in components
export function useAudioDebug(componentName: string) {
  return {
    log: (action: string, data?: any, correlationId?: string) => {
      logAudioEvent(componentName, action, data, correlationId);
    },
  };
}