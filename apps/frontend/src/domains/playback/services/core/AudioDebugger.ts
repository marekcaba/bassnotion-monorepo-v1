/**
 * Audio Debugger - Temporary debugging utility for audio event flow
 *
 * This helps trace the complete audio chain to identify where events are getting lost
 */

export class AudioDebugger {
  private static instance: AudioDebugger;
  private events: any[] = [];
  private enabled = true;

  static getInstance(): AudioDebugger {
    if (!AudioDebugger.instance) {
      AudioDebugger.instance = new AudioDebugger();
      // Expose to window for console access
      if (typeof window !== 'undefined') {
        (window as any).__audioDebugger = AudioDebugger.instance;
      }
    }
    return AudioDebugger.instance;
  }

  log(source: string, event: string, data?: any): void {
    if (!this.enabled) return;

    const entry = {
      timestamp: Date.now(),
      time: new Date().toISOString(),
      source,
      event,
      data,
    };

    this.events.push(entry);

    // Also log to console with color coding
    const color = this.getColor(source);
    console.log(
      `%c[${source}] ${event}`,
      `color: ${color}; font-weight: bold`,
      data || ''
    );

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  private getColor(source: string): string {
    const colors: Record<string, string> = {
      'RegionProcessor': '#4CAF50',
      'EventBus': '#2196F3',
      'AudioEventRouter': '#FF9800',
      'InstrumentRegistry': '#9C27B0',
      'MetronomeWidget': '#00BCD4',
      'DrummerWidget': '#CDDC39',
      'CoreServices': '#FF5722',
      'Transport': '#795548',
    };
    return colors[source] || '#666';
  }

  getEvents(): any[] {
    return this.events;
  }

  getEventsBySource(source: string): any[] {
    return this.events.filter(e => e.source === source);
  }

  getRecentEvents(count = 50): any[] {
    return this.events.slice(-count);
  }

  clear(): void {
    this.events = [];
    console.log('%c[AudioDebugger] Events cleared', 'color: red; font-weight: bold');
  }

  enable(): void {
    this.enabled = true;
    console.log('%c[AudioDebugger] Enabled', 'color: green; font-weight: bold');
  }

  disable(): void {
    this.enabled = false;
    console.log('%c[AudioDebugger] Disabled', 'color: red; font-weight: bold');
  }

  summary(): void {
    const sources = new Set(this.events.map(e => e.source));
    console.log('%c=== Audio Event Flow Summary ===', 'color: blue; font-weight: bold');

    sources.forEach(source => {
      const sourceEvents = this.events.filter(e => e.source === source);
      const eventTypes = new Set(sourceEvents.map(e => e.event));
      console.log(`%c${source}: ${sourceEvents.length} events`, `color: ${this.getColor(source)}`, Array.from(eventTypes));
    });

    // Check for common issues
    this.diagnose();
  }

  diagnose(): void {
    console.log('%c=== Diagnostics ===', 'color: red; font-weight: bold');

    // Check if RegionProcessor is scheduling
    const regionEvents = this.getEventsBySource('RegionProcessor');
    if (regionEvents.length === 0) {
      console.warn('⚠️ No RegionProcessor events - patterns may not be registered');
    }

    // Check if EventBus is emitting
    const eventBusEvents = this.events.filter(e =>
      e.source === 'EventBus' &&
      (e.event.includes('trigger') || e.event.includes('instrument'))
    );
    if (eventBusEvents.length === 0) {
      console.warn('⚠️ No EventBus trigger events - RegionProcessor may not be emitting');
    }

    // Check if AudioEventRouter is receiving
    const routerEvents = this.getEventsBySource('AudioEventRouter');
    if (routerEvents.length === 0) {
      console.warn('⚠️ No AudioEventRouter events - may not be initialized or started');
    }

    // Check if instruments are registered
    const registryEvents = this.getEventsBySource('InstrumentRegistry');
    if (registryEvents.length === 0) {
      console.warn('⚠️ No InstrumentRegistry events - instruments may not be registered');
    }

    // Check the chain
    const hasPatterns = regionEvents.some(e => e.event.includes('pattern'));
    const hasTriggers = eventBusEvents.some(e => e.event.includes('trigger'));
    const hasRouting = routerEvents.some(e => e.event.includes('trigger'));

    if (hasPatterns && !hasTriggers) {
      console.error('❌ Break in chain: Patterns registered but no triggers emitted');
    }
    if (hasTriggers && !hasRouting) {
      console.error('❌ Break in chain: Triggers emitted but not routed');
    }
  }
}

// Auto-initialize
AudioDebugger.getInstance();