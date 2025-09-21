/**
 * Re-export TrackMixingEngine from the new modular location
 *
 * @deprecated Use import from '@/domains/playback/modules/tracks' instead
 */

export { Mixer as TrackMixingEngine } from '../../modules/tracks/mixing/Mixer.js';
export type {
  TrackChannel,
  MixBus,
  Send,
  MixingSnapshot,
} from '../../modules/tracks/mixing/Mixer.js';
