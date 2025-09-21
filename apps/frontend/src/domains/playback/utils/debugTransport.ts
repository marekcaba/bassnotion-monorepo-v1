import { logAudioEvent } from '@/shared/debug/AudioDebugger';

/**
 * Wrap UnifiedTransport methods with debug logging
 */
export function wrapTransportWithDebug(transport: any): void {
  if (process.env.NEXT_PUBLIC_DEBUG_AUDIO !== 'true') return;

  // Wrap key methods
  const originalStart = transport.start.bind(transport);
  const originalStop = transport.stop.bind(transport);
  const originalPause = transport.pause.bind(transport);
  const originalResume = transport.resume.bind(transport);
  const originalSchedule = transport.scheduleEvent.bind(transport);

  transport.start = function (...args: any[]) {
    logAudioEvent('UnifiedTransport', 'start', { args });
    return originalStart(...args);
  };

  transport.stop = function (...args: any[]) {
    logAudioEvent('UnifiedTransport', 'stop', { args });
    return originalStop(...args);
  };

  transport.pause = function (...args: any[]) {
    logAudioEvent('UnifiedTransport', 'pause', { args });
    return originalPause(...args);
  };

  transport.resume = function (...args: any[]) {
    logAudioEvent('UnifiedTransport', 'resume', { args });
    return originalResume(...args);
  };

  transport.scheduleEvent = function (event: any, ...args: any[]) {
    logAudioEvent('UnifiedTransport', 'scheduleEvent', {
      time: event.time,
      type: event.type,
      data: event.data,
    });
    return originalSchedule(event, ...args);
  };
}
