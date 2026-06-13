/**
 * GrooveCardControls — `dimAtCap` chevron-greying test (the /free funnel).
 *
 * On the public funnel surface the tempo + key chevrons GREY OUT once the
 * value reaches the entitlement band edge (instead of staying live to fire an
 * in-card upsell, which is the in-app behaviour). These tests pin that:
 *   - tempo chevron disables at originalBpm ± caps.tempo.limit
 *   - key chevron disables at ± transposeRange
 *   - WITHOUT dimAtCap, the band-edge chevrons stay enabled (in-app untouched)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  renderWithProviders as render,
  screen,
} from '@/test/utils/renderWithProviders';
import { GrooveCardControls } from '../GrooveCardControls';
import {
  setEntitlementMock,
  clearEntitlementMock,
  freeTierCappedResponse,
} from '@/domains/billing/hooks/useEntitlement';

// A stable countdown state (not counting in) so the controls render normally.
const idleCountdown = {
  isCountingDown: false,
  currentBeat: 0,
} as const;

// Minimal props for GrooveCardControls. Tests override the cap-relevant ones
// (currentBpm / currentSemitones / dimAtCap / transposeRange / originalBpm).
function baseProps(
  overrides: Partial<React.ComponentProps<typeof GrooveCardControls>> = {},
): React.ComponentProps<typeof GrooveCardControls> {
  return {
    isPlaying: false,
    isReady: true,
    isLoading: false,
    countdownState: idleCountdown,
    currentBpm: 109,
    currentSemitones: 0,
    pendingKeyShift: null,
    originalKey: 'E',
    isBassMuted: false,
    isSoloDrums: false,
    onPlayPause: () => undefined,
    onTempoChange: () => undefined,
    onKeyChange: () => undefined,
    onMuteBass: () => undefined,
    onSoloDrums: () => undefined,
    onDeconCapHit: () => undefined,
    pitchLever: null,
    onPitchOpenChange: () => undefined,
    pitchContent: null,
    enforceCaps: true,
    // Capped band: transpose limited to ±2 (Math.min(engine, limit)).
    transposeRange: 2,
    transposeCapped: true,
    dimAtCap: true,
    originalBpm: 109,
    ...overrides,
  };
}

const tempoDown = () => screen.getByRole('button', { name: /tempo down/i });
const tempoUp = () => screen.getByRole('button', { name: /tempo up/i });
const keyDown = () => screen.getByRole('button', { name: /key down/i });
const keyUp = () => screen.getByRole('button', { name: /key up/i });

describe('GrooveCardControls — dimAtCap chevron greying', () => {
  beforeEach(() => {
    // Free tier: tempo ±5, transpose ±2 (the default capped profile).
    setEntitlementMock(freeTierCappedResponse());
  });
  afterEach(() => clearEntitlementMock());

  it('greys the UP tempo chevron at the upper band edge (109 + 5 = 114)', () => {
    render(<GrooveCardControls {...baseProps({ currentBpm: 114 })} />);
    expect(tempoUp()).toBeDisabled();
    expect(tempoDown()).not.toBeDisabled();
  });

  it('greys the DOWN tempo chevron at the lower band edge (109 − 5 = 104)', () => {
    render(<GrooveCardControls {...baseProps({ currentBpm: 104 })} />);
    expect(tempoDown()).toBeDisabled();
    expect(tempoUp()).not.toBeDisabled();
  });

  it('leaves both tempo chevrons live INSIDE the band (110)', () => {
    render(<GrooveCardControls {...baseProps({ currentBpm: 110 })} />);
    expect(tempoUp()).not.toBeDisabled();
    expect(tempoDown()).not.toBeDisabled();
  });

  it('greys the UP key chevron at the upper transpose edge (+2)', () => {
    render(<GrooveCardControls {...baseProps({ currentSemitones: 2 })} />);
    expect(keyUp()).toBeDisabled();
    expect(keyDown()).not.toBeDisabled();
  });

  it('greys the DOWN key chevron at the lower transpose edge (−2)', () => {
    render(<GrooveCardControls {...baseProps({ currentSemitones: -2 })} />);
    expect(keyDown()).toBeDisabled();
    expect(keyUp()).not.toBeDisabled();
  });

  it('WITHOUT dimAtCap, the band-edge chevrons stay ENABLED (in-app behaviour)', () => {
    render(
      <GrooveCardControls
        {...baseProps({
          dimAtCap: false,
          currentBpm: 114,
          currentSemitones: 2,
        })}
      />,
    );
    // In-app: the cap fires the upsell on bump; the chevron is NOT pre-disabled.
    expect(tempoUp()).not.toBeDisabled();
    expect(keyUp()).not.toBeDisabled();
  });
});
