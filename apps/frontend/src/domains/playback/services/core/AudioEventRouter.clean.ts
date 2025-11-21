  /**
   * Subscribe to EventBus trigger events
   */
  private subscribeToEvents(): void {
    if (!this.eventBus) return;

    // Listen for instrument registrations from the registry
    const instrumentRegisteredHandler = (data: any) => {
      if (!data.type || !data.instrument) return;

      this.logger.info(`Instrument registered: ${data.type}`);

      // Update our references when instruments are registered
      switch (data.type) {
        case 'drums':
          this.drums = data.instrument;
          this.legacyDrums = data.instrument; // Backward compatibility
          this.activeInstruments.add('drums');
          this.logger.info('Updated drums instrument from registry');
          break;
        case 'harmony':
          this.harmony = data.instrument;
          this.activeInstruments.add('harmony');
          this.logger.info('Updated harmony instrument from registry');
          break;
        case 'bass':
          this.bass = data.instrument;
          this.legacyBass = data.instrument; // Backward compatibility
          this.activeInstruments.add('bass');
          this.logger.info('Updated bass instrument from registry');
          break;
        case 'metronome':
          this.metronome = data.instrument;
          this.legacyMetronome = data.instrument; // Backward compatibility
          this.activeInstruments.add('metronome');
          this.logger.info('Updated metronome instrument from registry');
          break;
      }
    };
    const instrumentRegisteredUnsubscribe = this.eventBus.on(
      'instrument:registered',
      instrumentRegisteredHandler
    );
    this.eventHandlers.set('instrument:registered', instrumentRegisteredHandler);
    this.unsubscribeFunctions.set('instrument:registered', instrumentRegisteredUnsubscribe);

    // Drum trigger handler
    const drumHandler = (data: DrumTriggerEvent) => {
      this.handleDrumTrigger(data);
    };
    const drumUnsubscribe = this.eventBus.on('drum-trigger', drumHandler);
    this.eventHandlers.set('drum-trigger', drumHandler);
    this.unsubscribeFunctions.set('drum-trigger', drumUnsubscribe);

    // Metronome trigger handler
    const metronomeHandler = (data: MetronomeTriggerEvent) => {
      this.handleMetronomeTrigger(data);
    };
    const metronomeUnsubscribe = this.eventBus.on(
      'metronome-trigger',
      metronomeHandler,
    );
    this.eventHandlers.set('metronome-trigger', metronomeHandler);
    this.unsubscribeFunctions.set('metronome-trigger', metronomeUnsubscribe);

    // Chord trigger handler
    const chordHandler = (data: ChordTriggerEvent) => {
      this.handleChordTrigger(data);
    };
    const chordUnsubscribe = this.eventBus.on('chord-trigger', chordHandler);
    this.eventHandlers.set('chord-trigger', chordHandler);
    this.unsubscribeFunctions.set('chord-trigger', chordUnsubscribe);

    // Bass trigger handler
    const bassHandler = (data: BassTriggerEvent) => {
      this.handleBassTrigger(data);
    };
    const bassUnsubscribe = this.eventBus.on('bass-trigger', bassHandler);
    this.eventHandlers.set('bass-trigger', bassHandler);
    this.unsubscribeFunctions.set('bass-trigger', bassUnsubscribe);

    // MIDI event handler
    const midiHandler = (data: MidiEvent) => {
      this.handleMidiEvent(data);
    };
    const midiUnsubscribe = this.eventBus.on('midi-event', midiHandler);
    this.eventHandlers.set('midi-event', midiHandler);
    this.unsubscribeFunctions.set('midi-event', midiUnsubscribe);

    this.logger.info('Subscribed to EventBus trigger events');
  }