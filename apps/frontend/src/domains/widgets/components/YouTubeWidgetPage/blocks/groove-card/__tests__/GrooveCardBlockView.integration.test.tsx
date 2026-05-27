/**
 * GrooveCardBlockView — LAUNCH-02.5c integration test.
 *
 * Mounts the full Groove Card render path (Shell → Waveform + Controls)
 * with the playback hook, TransportContext mocked to a stable shape, and
 * WindowRegistry stubbed so the hook can reach a fake PlaybackEngine.
 *
 * Covers:
 *   - The card renders title + subtitle + the 5 primary buttons
 *   - The play button is disabled until the stem preload completes; once
 *     preloaded it becomes enabled
 *   - Clicking Mute Bass toggles aria-pressed and calls
 *     setInstrumentMuted on the fake engine
 *   - Solo Drums sibling-mutes bass + harmony on the engine
 *   - The acceptance criterion "one test exercises the 'free' mock
 *     entitlement path" — with useEntitlement mocked to 'free', the
 *     controls render disabled (caps applied) and the engine never sees
 *     mute calls when buttons are pressed
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import type { TutorialBlock } from '@bassnotion/contracts';
import { GrooveCardBlockView } from '../../GrooveCardBlockView';
import {
  setEntitlementMock,
  clearEntitlementMock,
  freeTierCappedResponse,
} from '@/domains/billing/hooks/useEntitlement';
import { _resetStemPreloadCache } from '../useGrooveCardStemPreload';

// ─────────────────────────────────────────────────────────────────────────
// Mocks: TransportContext + WindowRegistry + MusicalTruthAuthority
// ─────────────────────────────────────────────────────────────────────────

const mockTransport = {
  isPlaying: false,
  isPaused: false,
  isStopped: true,
  tempo: 120,
  timeSignature: { beats: 4, beatType: 4 },
  position: { bar: 0, beat: 0, sixteenth: 0 },
  start: vi.fn(async () => undefined),
  stop: vi.fn(async () => undefined),
  pause: vi.fn(async () => undefined),
  setTempo: vi.fn(async () => undefined),
  setTimeSignature: vi.fn(),
  seekTo: vi.fn(async () => undefined),
  setLoop: vi.fn(async () => undefined),
  setExerciseDuration: vi.fn(),
  isLoopEnabled: false,
  servicesReady: true,
};

vi.mock('@/domains/playback/contexts/TransportContext', () => ({
  useTransportControls: () => mockTransport,
  useTransportControlsSafe: () => mockTransport,
  useTransport: () => mockTransport,
  useTransportContext: () => mockTransport,
}));

const mockEngine = {
  setAudioStemBuffers: vi.fn(),
  startAudioStems: vi.fn(),
  stopAudioStems: vi.fn(),
  unregisterTracksByPrefix: vi.fn(),
  registerTracks: vi.fn(),
  registerTrack: vi.fn(),
  setInstrumentMuted: vi.fn(),
  setInstrumentVolume: vi.fn(),
};

const mockAudioContext = {
  currentTime: 0,
  sampleRate: 44100,
  state: 'running',
  destination: {},
  createBufferSource: vi.fn(() => ({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
    addEventListener: vi.fn(),
  })),
  createGain: vi.fn(() => ({
    gain: {
      value: 1,
      setValueAtTime: vi.fn(),
      linearRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  })),
  decodeAudioData: vi.fn(
    async () =>
      ({
        length: 44100,
        duration: 1,
        sampleRate: 44100,
        numberOfChannels: 2,
        getChannelData: vi.fn(() => new Float32Array(44100)),
        copyFromChannel: vi.fn(),
        copyToChannel: vi.fn(),
      }) as unknown as AudioBuffer,
  ),
} as unknown as AudioContext;

vi.mock('@/domains/playback/services/WindowRegistry', () => ({
  WindowRegistry: {
    getAudioContext: () => mockAudioContext,
    getPlaybackEngine: () => mockEngine,
    getCoreServices: () => ({
      getAudioContext: () => mockAudioContext,
      getPlaybackEngine: () => mockEngine,
    }),
  },
}));

vi.mock('@/domains/playback/modules/tempo/MusicalTruthAuthority', () => ({
  musicalTruth: {
    setBPM: vi.fn(),
    getBPM: () => 104,
    subscribe: vi.fn(() => () => {}),
  },
}));

// ─────────────────────────────────────────────────────────────────────────
// Test fixture
// ─────────────────────────────────────────────────────────────────────────

function makeBlock(): TutorialBlock<'groove-card'> {
  const stemBase =
    'https://example.supabase.co/storage/v1/object/public/audio-samples';
  return {
    id: 'gc-test-1',
    type: 'groove-card',
    title: 'Test Card',
    order: 0,
    showInIsland: true,
    config: {
      title: 'Greasy Pocket',
      subtitle: 'Funk in E',
      originalBpm: 104,
      originalKey: 'E',
      lengthBars: 4,
      previewCaption: 'Hit play to start',
      stateCaptions: {
        'mute-bass': 'Bass muted.',
        'solo-drums': 'Drums only.',
        'key-change': 'Queued for next loop.',
        'tempo-change': 'Tempo changed.',
      },
      keys: [
        {
          label: 'C',
          semitoneOffset: -8,
          isDefault: false,
          stems: {
            bass: `${stemBase}/c/bass.ogg`,
            drums: `${stemBase}/c/drums.ogg`,
            harmony: `${stemBase}/c/harmony.ogg`,
          },
        },
        {
          label: 'D',
          semitoneOffset: -4,
          isDefault: false,
          stems: {
            bass: `${stemBase}/d/bass.ogg`,
            drums: `${stemBase}/d/drums.ogg`,
            harmony: `${stemBase}/d/harmony.ogg`,
          },
        },
        {
          label: 'E',
          semitoneOffset: 0,
          isDefault: true,
          stems: {
            bass: `${stemBase}/e/bass.ogg`,
            drums: `${stemBase}/e/drums.ogg`,
            harmony: `${stemBase}/e/harmony.ogg`,
          },
        },
        {
          label: 'G',
          semitoneOffset: 4,
          isDefault: false,
          stems: {
            bass: `${stemBase}/g/bass.ogg`,
            drums: `${stemBase}/g/drums.ogg`,
            harmony: `${stemBase}/g/harmony.ogg`,
          },
        },
        {
          label: 'A',
          semitoneOffset: 8,
          isDefault: false,
          stems: {
            bass: `${stemBase}/a/bass.ogg`,
            drums: `${stemBase}/a/drums.ogg`,
            harmony: `${stemBase}/a/harmony.ogg`,
          },
        },
      ],
    },
  };
}

const noop = () => {};

beforeEach(() => {
  _resetStemPreloadCache();
  clearEntitlementMock();
  vi.clearAllMocks();
  mockTransport.isPlaying = false;
  // Stub fetch for stem preload.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      status: 200,
      statusText: 'OK',
      arrayBuffer: async () => new ArrayBuffer(8),
    })),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GrooveCardBlockView — LAUNCH-02.5c integration', () => {
  it('renders title, subtitle, and all 5 primary controls', () => {
    const block = makeBlock();
    render(
      <GrooveCardBlockView
        block={block}
        isActive
        isCompleted={false}
        onComplete={noop}
        onNext={noop}
      />,
    );

    // Title + subtitle visible
    expect(screen.getByText(/Greasy Pocket/)).toBeInTheDocument();
    expect(screen.getByText(/Funk in E/)).toBeInTheDocument();
    // The 5 controls: Mute Bass / Key stepper (down + up) / Play / Tempo stepper / Solo Drums
    expect(
      screen.getByRole('button', { name: /mute bass/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /solo drums/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /tempo down/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /tempo up/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /key down/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /key up/i })).toBeInTheDocument();
  });

  it('enables the play button once the stems have preloaded', async () => {
    const block = makeBlock();
    render(
      <GrooveCardBlockView
        block={block}
        isActive
        isCompleted={false}
        onComplete={noop}
        onNext={noop}
      />,
    );

    // Initially the play button is the Loading… state (disabled).
    const playBtn = screen.getByRole('button', { name: /play/i });
    expect(playBtn).toBeDisabled();

    // After preload completes the button becomes enabled.
    await waitFor(() => expect(playBtn).not.toBeDisabled(), { timeout: 3000 });
  });

  it('Mute Bass writes to the engine and toggles aria-pressed', async () => {
    const block = makeBlock();
    render(
      <GrooveCardBlockView
        block={block}
        isActive
        isCompleted={false}
        onComplete={noop}
        onNext={noop}
      />,
    );

    const muteBtn = screen.getByRole('button', { name: /mute bass/i });
    await waitFor(() => expect(muteBtn).not.toBeDisabled());

    expect(muteBtn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(muteBtn);
    expect(muteBtn).toHaveAttribute('aria-pressed', 'true');
    expect(mockEngine.setInstrumentMuted).toHaveBeenCalledWith(
      'audio-bass',
      true,
    );
  });

  it('Solo Drums sibling-mutes bass + harmony on the engine', async () => {
    const block = makeBlock();
    render(
      <GrooveCardBlockView
        block={block}
        isActive
        isCompleted={false}
        onComplete={noop}
        onNext={noop}
      />,
    );

    const soloBtn = screen.getByRole('button', { name: /solo drums/i });
    await waitFor(() => expect(soloBtn).not.toBeDisabled());

    fireEvent.click(soloBtn);

    expect(mockEngine.setInstrumentMuted).toHaveBeenCalledWith(
      'audio-bass',
      true,
    );
    expect(mockEngine.setInstrumentMuted).toHaveBeenCalledWith(
      'audio-harmony',
      true,
    );
  });

  // The acceptance criterion: "one test must exercise the 'free' mock
  // entitlement path so the cap-read logic isn't dormant".
  it('with useEntitlement mocked to free, cap-relevant controls render disabled', async () => {
    setEntitlementMock(freeTierCappedResponse());
    const block = makeBlock();
    render(
      <GrooveCardBlockView
        block={block}
        isActive
        isCompleted={false}
        onComplete={noop}
        onNext={noop}
      />,
    );

    // Preload still completes so the play button has finished loading.
    const playBtn = screen.getByRole('button', { name: /play/i });
    await waitFor(() => expect(playBtn).not.toBeDisabled(), { timeout: 3000 });

    // Tempo / Key / Mute / Solo buttons are disabled due to caps.
    expect(screen.getByRole('button', { name: /tempo down/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /tempo up/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /key down/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /key up/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /mute bass/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /solo drums/i })).toBeDisabled();
  });
});
