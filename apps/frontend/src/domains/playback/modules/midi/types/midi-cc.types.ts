/**
 * MIDI Control Change Configuration Types
 *
 * Type definitions for external MIDI CC mapping configuration
 */

export interface MidiCCConfig {
  name: string;
  version: string;
  description: string;
  mappings: Record<string, CCMapping>;
  categories: Record<string, CCCategory>;
  aliases: Record<string, string[]>;
}

export interface CCMapping {
  name: string;
  type: string;
  range: [number, number];
  default: number;
  category: string;
  centerValue?: number;
  isSwitch?: boolean;
  threshold?: number;
}

export interface CCCategory {
  name: string;
  description: string;
}

export enum StandardCC {
  BANK_SELECT_MSB = 0,
  MODULATION = 1,
  BREATH = 2,
  FOOT = 4,
  PORTAMENTO_TIME = 5,
  DATA_ENTRY_MSB = 6,
  VOLUME = 7,
  BALANCE = 8,
  PAN = 10,
  EXPRESSION = 11,
  EFFECT_1 = 12,
  EFFECT_2 = 13,
  GP_CONTROLLER_1 = 16,
  GP_CONTROLLER_2 = 17,
  GP_CONTROLLER_3 = 18,
  GP_CONTROLLER_4 = 19,
  BANK_SELECT_LSB = 32,
  DATA_ENTRY_LSB = 38,
  SUSTAIN = 64,
  PORTAMENTO_SWITCH = 65,
  SOSTENUTO = 66,
  SOFT_PEDAL = 67,
  LEGATO = 68,
  HOLD_2 = 69,
  SOUND_VARIATION = 70,
  TIMBRE = 71,
  RELEASE_TIME = 72,
  ATTACK_TIME = 73,
  BRIGHTNESS = 74,
  DECAY_TIME = 75,
  VIBRATO_RATE = 76,
  VIBRATO_DEPTH = 77,
  VIBRATO_DELAY = 78,
  SOUND_CONTROLLER_10 = 79,
  GP_CONTROLLER_5 = 80,
  GP_CONTROLLER_6 = 81,
  GP_CONTROLLER_7 = 82,
  GP_CONTROLLER_8 = 83,
  PORTAMENTO_CONTROL = 84,
  REVERB = 91,
  TREMOLO = 92,
  CHORUS = 93,
  CELESTE = 94,
  PHASER = 95,
  DATA_INCREMENT = 96,
  DATA_DECREMENT = 97,
  NRPN_LSB = 98,
  NRPN_MSB = 99,
  RPN_LSB = 100,
  RPN_MSB = 101,
  ALL_SOUND_OFF = 120,
  RESET_ALL = 121,
  LOCAL_CONTROL = 122,
  ALL_NOTES_OFF = 123,
  OMNI_OFF = 124,
  OMNI_ON = 125,
  MONO_ON = 126,
  POLY_ON = 127,
}

export interface CCValue {
  cc: number;
  value: number;
  normalized: number; // 0-1 range
  timestamp: number;
}

export interface CCEvent {
  channel: number;
  cc: number;
  value: number;
  type: string;
  category: string;
  time: number;
}
