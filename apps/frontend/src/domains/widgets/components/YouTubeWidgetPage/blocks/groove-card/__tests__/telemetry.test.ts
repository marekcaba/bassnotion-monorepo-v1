/**
 * Groove Card telemetry — LAUNCH-02.5d unit tests.
 *
 * Verifies that the dedicated card-event helpers call the shared
 * `trackEvent(message, category, data?)` helper with the correct
 * shape. We mock `@/shared/utils/sentry` so the tests don't actually
 * push breadcrumbs to Sentry.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/utils/sentry', () => ({
  trackEvent: vi.fn(),
}));

import { trackEvent } from '@/shared/utils/sentry';
import {
  trackWaitlistKeyCapHit,
  trackPlay,
  trackPlayFirst,
  trackUnmount,
} from '../telemetry';

const trackEventMock = vi.mocked(trackEvent);

beforeEach(() => {
  trackEventMock.mockClear();
});

describe('Groove Card telemetry — LAUNCH-02.5d', () => {
  describe('trackWaitlistKeyCapHit', () => {
    it('emits the groove_card_waitlist_cap_hit event with the documented shape', () => {
      trackWaitlistKeyCapHit({ blockId: 'gc-1', valueAttempted: 7 });
      expect(trackEventMock).toHaveBeenCalledTimes(1);
      expect(trackEventMock).toHaveBeenCalledWith(
        'groove_card_waitlist_cap_hit',
        'groove-card',
        {
          blockId: 'gc-1',
          lever: 'key',
          valueAttempted: 7,
        },
      );
    });

    it('carries the user-attempted value (negative too) so cap-direction is visible', () => {
      trackWaitlistKeyCapHit({ blockId: 'gc-2', valueAttempted: -9 });
      expect(trackEventMock).toHaveBeenCalledWith(
        'groove_card_waitlist_cap_hit',
        'groove-card',
        expect.objectContaining({ valueAttempted: -9 }),
      );
    });
  });

  describe('trackPlayFirst / trackPlay', () => {
    it('trackPlayFirst sends groove_card_play_first with mode + blockId', () => {
      trackPlayFirst({ blockId: 'gc-1', mode: 'waitlist' });
      expect(trackEventMock).toHaveBeenCalledWith(
        'groove_card_play_first',
        'groove-card',
        { blockId: 'gc-1', mode: 'waitlist' },
      );
    });

    it('trackPlay sends groove_card_play with mode + blockId', () => {
      trackPlay({ blockId: 'gc-1', mode: 'block' });
      expect(trackEventMock).toHaveBeenCalledWith(
        'groove_card_play',
        'groove-card',
        { blockId: 'gc-1', mode: 'block' },
      );
    });
  });

  describe('trackUnmount', () => {
    it('includes the dwellMs duration', () => {
      trackUnmount({ blockId: 'gc-3', mode: 'block', dwellMs: 12345 });
      expect(trackEventMock).toHaveBeenCalledWith(
        'groove_card_unmount',
        'groove-card',
        { blockId: 'gc-3', mode: 'block', dwellMs: 12345 },
      );
    });
  });

  describe('category', () => {
    it('every event lands under the "groove-card" category for clean rollups', () => {
      trackPlayFirst({ blockId: 'a', mode: 'block' });
      trackPlay({ blockId: 'a', mode: 'block' });
      trackWaitlistKeyCapHit({ blockId: 'a', valueAttempted: 5 });
      trackUnmount({ blockId: 'a', mode: 'block', dwellMs: 1 });
      for (const call of trackEventMock.mock.calls) {
        expect(call[1]).toBe('groove-card');
      }
    });
  });
});
