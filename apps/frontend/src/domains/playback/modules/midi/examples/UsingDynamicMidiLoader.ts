/**
 * Example: Using Dynamic MIDI Configuration Loader
 *
 * This example demonstrates how to use the refactored MIDI system
 * with external configuration files.
 */

import { MidiConfigLoader } from '../loaders/MidiConfigLoader.js';
import { MidiParserProcessor } from '../MidiParserProcessor.js';
import { createStructuredLogger } from '../../shared/index.js';

const logger = createStructuredLogger('MidiExample');

/**
 * Example 1: Load all MIDI configurations
 */
async function loadAllMidiConfigs() {
  const loader = MidiConfigLoader.getInstance();

  // Load all configs at once
  const configs = await loader.loadAllConfigs();

  logger.info('Loaded MIDI configurations', {
    ccMappings: Object.keys(configs.cc?.mappings || {}).length,
    instruments: configs.instruments?.instruments.length,
    metaEvents: Object.keys(configs.metaEvents?.events || {}).length,
    notes: Object.keys(configs.notes?.notes || {}).length,
  });

  return configs;
}

/**
 * Example 2: Use CC configuration in MIDI parser
 */
async function setupMidiParserWithConfig() {
  // Create parser with custom CC config path
  const parser = new MidiParserProcessor('/data/midi/bass-cc-mappings.json');

  // Wait for initialization
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Get the loaded CC config
  const ccConfig = parser.getCCConfig();
  if (ccConfig) {
    logger.info('Bass-specific CC mappings loaded', {
      name: ccConfig.name,
      mappingCount: Object.keys(ccConfig.mappings).length,
    });
  }

  // Find CC by alias
  const sustainCC = parser.findCCByAlias('sustain');
  if (sustainCC) {
    const [ccNumber, mapping] = sustainCC;
    logger.info('Found sustain pedal', {
      cc: ccNumber,
      name: mapping.name,
      type: mapping.type,
    });
  }

  return parser;
}

/**
 * Example 3: Look up instrument information
 */
async function lookupInstrumentInfo() {
  const loader = MidiConfigLoader.getInstance();
  const instruments = await loader.loadInstrumentsConfig();

  // Look up Electric Bass (finger)
  const electricBass = loader.getInstrument(instruments, 33);
  if (electricBass) {
    logger.info('Found instrument', {
      program: electricBass.program,
      name: electricBass.name,
      category: electricBass.category,
      family: electricBass.family,
    });

    // Get category info
    const categoryInfo = instruments.categories[electricBass.category];
    logger.info('Category info', {
      name: categoryInfo.name,
      defaultRange: categoryInfo.defaultRange,
      typicalVelocity: categoryInfo.typicalVelocity,
    });
  }

  // Get all bass instruments
  const bassInstruments = loader.getInstrumentsByCategory(instruments, 'bass');
  logger.info('All bass instruments', {
    count: bassInstruments.length,
    names: bassInstruments.map((inst) => inst.name),
  });
}

/**
 * Example 4: Work with note mappings
 */
async function workWithNoteMappings() {
  const loader = MidiConfigLoader.getInstance();
  const notes = await loader.loadNotesConfig();

  // Get middle C info
  const middleC = loader.getNote(notes, 60);
  if (middleC) {
    logger.info('Middle C', {
      name: middleC.name,
      frequency: middleC.frequency,
    });
  }

  // Get note name for any MIDI number
  const noteNumber = 69; // A4
  const noteName = loader.getNoteName(noteNumber);
  const frequency = loader.getNoteFrequency(noteNumber);

  logger.info('Note info', {
    number: noteNumber,
    name: noteName,
    frequency: frequency,
    expectedFrequency: 440, // A4 = 440 Hz
  });

  // Get special notes
  logger.info('Special notes', notes.specialNotes);
}

/**
 * Example 5: Handle meta events
 */
async function handleMetaEvents() {
  const loader = MidiConfigLoader.getInstance();
  const metaEvents = await loader.loadMetaEventsConfig();

  // Look up tempo event
  const tempoEvent = loader.getMetaEvent(metaEvents, '0x51');
  if (tempoEvent) {
    logger.info('Tempo meta event', {
      name: tempoEvent.name,
      type: tempoEvent.type,
      category: tempoEvent.category,
      dataLength: tempoEvent.dataFormat.length,
    });
  }

  // Get key signature
  const keyName = loader.getKeySignature(metaEvents, -1, 'major'); // 1 flat, major
  logger.info('Key signature', {
    sharpsFlats: -1,
    mode: 'major',
    key: keyName, // Should be F major
  });

  // Get tempo marking
  const tempoMarking = loader.getTempoMarking(metaEvents, 120);
  logger.info('Tempo marking', {
    bpm: 120,
    marking: tempoMarking, // Should be 'moderato'
  });
}

/**
 * Example 6: Load extended configuration
 */
async function loadExtendedConfig() {
  const loader = MidiConfigLoader.getInstance();

  // Load bass-specific CC mappings
  const bassConfig = await loader.loadExtendedConfig(
    '/data/midi/bass-cc-mappings.json',
  );

  logger.info('Extended bass config', {
    name: bassConfig.name,
    extends: bassConfig.extends,
    hasArticulations: !!bassConfig.bassArticulations,
    hasPresets: !!bassConfig.presets,
  });

  // Access bass-specific articulations
  if (bassConfig.bassArticulations) {
    Object.entries(bassConfig.bassArticulations).forEach(
      ([name, articulation]: [string, any]) => {
        logger.info(`Articulation: ${name}`, {
          description: articulation.description,
          ccValues: articulation.ccValues,
        });
      },
    );
  }
}

/**
 * Example 7: Dynamic CC mapping in real-time
 */
async function dynamicCCMapping() {
  const parser = new MidiParserProcessor();

  // Wait for initialization
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Get performance controllers
  const perfControllers = parser.getPerformanceControllers();
  if (perfControllers) {
    logger.info('Performance controllers', {
      count: perfControllers.size,
      controllers: Array.from(perfControllers.entries()).map(
        ([cc, mapping]) => ({
          cc,
          name: mapping.name,
          type: mapping.type,
        }),
      ),
    });
  }

  // Reload with different config
  await parser.reloadCCConfig('/data/midi/bass-cc-mappings.json');

  // Now we have bass-specific mappings
  const bassCC = parser.findCCByAlias('slap_intensity');
  if (bassCC) {
    logger.info('Found bass-specific CC', bassCC);
  }
}

// Export all examples
export {
  loadAllMidiConfigs,
  setupMidiParserWithConfig,
  lookupInstrumentInfo,
  workWithNoteMappings,
  handleMetaEvents,
  loadExtendedConfig,
  dynamicCCMapping,
};

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  (async () => {
    try {
      await loadAllMidiConfigs();
      await setupMidiParserWithConfig();
      await lookupInstrumentInfo();
      await workWithNoteMappings();
      await handleMetaEvents();
      await loadExtendedConfig();
      await dynamicCCMapping();
    } catch (error) {
      logger.error('Example failed', { error });
    }
  })();
}
