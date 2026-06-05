/**
 * Funnel analytics — the append-only event log + anonymous-identity types.
 *
 * Every visitor gets an anonymous id (the `bn_anonymous_id` cookie) on their
 * first page load. Events carry that id (and, once accounts exist, a user id),
 * so the same browser can be followed `landing_view → waitlist_submitted →
 * account_created → purchased`. The anonymous id is the join key; the
 * `identities` table later maps it to a real `user_id` at signup.
 *
 * See: the Bassicology shorts/YouTube door flows — "carry the tag to paid,
 * a join key, not new instrumentation."
 */

import type { Attribution } from '../validation/waitlist-schemas.js';

/**
 * The funnel events we record today. Extend this union as new surfaces ship
 * (e.g. 'account_created', 'first_win', 'membership_started'). Keeping the
 * names centralized means the client emitter and any reader agree on spelling.
 */
export const funnelEventNames = [
  'landing_view',
  'waitlist_submitted',
  'founder_interest_click',
  // Drill panel (Bassicology core practice loop). Keyed by the same
  // anonymous_id, so a conquer joins back to the source video.
  'drill_started',
  'cap_hit',
  'groove_conquered',
  'first_win',
] as const;

export type FunnelEventName = (typeof funnelEventNames)[number];

/**
 * Payload the client passes to `trackEvent`. `anonymousId` is required (the
 * caller always resolves it first); `attribution` + `props` are optional
 * context. This maps 1:1 onto a `funnel_events` row (snake_cased on insert).
 */
export interface FunnelEventInput {
  anonymousId: string;
  event: FunnelEventName;
  attribution?: Attribution;
  props?: Record<string, unknown>;
}

/**
 * A persisted `funnel_events` row (as read back via the service-role
 * dashboard). `userId` is null until the visitor's id is stitched to an
 * account in the `identities` table.
 */
export interface FunnelEvent {
  id: string;
  anonymousId: string;
  userId: string | null;
  event: string;
  attribution: Attribution | null;
  props: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * A row in the `identities` table — maps one anonymous visitor id to one
 * account. Many rows can point at the same `userId` (the same person on phone
 * + laptop, each with its own anonymous id).
 */
export interface IdentityLink {
  id: string;
  anonymousId: string;
  userId: string;
  createdAt: string;
}
