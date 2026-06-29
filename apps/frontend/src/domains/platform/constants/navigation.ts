import {
  GraduationCap,
  Dumbbell,
  Play,
  Martini,
  HelpCircle,
  Settings,
} from 'lucide-react';
import type { ComponentType } from 'react';

export interface NavItem {
  title: string;
  /**
   * The CLEAN navigation target (no /app prefix). On the app subdomain the
   * host-rewrite middleware maps e.g. /gym → the internal /app/gym folder, so the
   * URL bar stays clean. College's clean URL is /college (it serves /app/bassment).
   * See docs/deployment/APP_SUBDOMAIN_RUNBOOK.md (Step 3).
   */
  url: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  /**
   * INTERNAL (/app/*) routes that also highlight this item — PREFIX match
   * (`pathname === p || pathname.startsWith(p + '/')`). Compared against
   * useInternalPathname(), which re-prefixes /app on the clean app-host path.
   */
  activePatterns?: string[];
  /**
   * INTERNAL routes that highlight this item by EXACT equality only (no prefix).
   * Use for root-like items (Backstage = /app) that must NOT light up on their
   * sub-rooms (/app/gym, /app/settings, …). Takes precedence over the
   * url-equality fallback.
   */
  exactPatterns?: string[];
}

/**
 * THE SPINE — not a list, an arc. The path of becoming a bassist:
 *
 *   Backstage (belong) → Gym (train) → College (learn) → Gigs (perform)
 *
 * Backstage is the landing room — it IS /app (the home page), the free locker
 * where you see where you stand and the rooms you haven't entered yet. From
 * there the arc pulls you forward: train it, learn it, deliver it. The order is
 * the journey, so a brand-new member reads where they're going at a glance.
 *
 * URLs are CLEAN (no /app) so the URL bar stays clean on the app subdomain; the
 * host-rewrite middleware maps each to its /app/* folder. activePatterns/
 * exactPatterns compare the INTERNAL path (via useInternalPathname()).
 */
export const MAIN_NAV_ITEMS: NavItem[] = [
  // Backstage — the home room (session + progress + recordings). Points DIRECTLY at /backstage,
  // not '/': clicking the nav should land there without bouncing through the '/'→'/backstage'
  // middleware redirect (that redirect is only for the bare root entry, and routing a client
  // view-transition through it triggered an https/SSL protocol error on the redirect prefetch).
  {
    title: 'Backstage',
    url: '/backstage',
    icon: Martini,
    activePatterns: ['/app/backstage'],
  },
  // Train — the daily rep engine (the recurring membership core).
  {
    title: 'Gym',
    url: '/gym',
    icon: Dumbbell,
    activePatterns: ['/app/gym'],
  },
  // Learn — the 4-week accelerator (the methodology; was "Bassment").
  // Clean URL /college serves the /app/bassment folder (label alias).
  {
    title: 'College',
    url: '/college',
    icon: GraduationCap,
    activePatterns: ['/app/bassment', '/app/tutorials'],
  },
  // Perform — deployment tested as a professional milestone.
  {
    title: 'Gigs',
    url: '/gigs',
    icon: Play,
    activePatterns: ['/app/gigs'],
  },
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { title: 'Support', url: '/support', icon: HelpCircle, disabled: true },
  {
    title: 'Settings',
    url: '/settings',
    icon: Settings,
    activePatterns: ['/app/settings'],
  },
];
