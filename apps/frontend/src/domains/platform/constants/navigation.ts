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
  url: string;
  icon: ComponentType<{ className?: string }>;
  disabled?: boolean;
  /** Routes that should also highlight this nav item (prefix match) */
  activePatterns?: string[];
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
 */
export const MAIN_NAV_ITEMS: NavItem[] = [
  // Belong — the landing room. /app itself; the free locker / identity / Matrix.
  { title: 'Backstage', url: '/app', icon: Martini },
  // Train — the daily rep engine (the recurring membership core).
  {
    title: 'Gym',
    url: '/app/gym',
    icon: Dumbbell,
    activePatterns: ['/app/gym'],
  },
  // Learn — the 4-week accelerator (the methodology; was "Bassment").
  {
    title: 'College',
    url: '/app/bassment',
    icon: GraduationCap,
    activePatterns: ['/app/bassment', '/app/tutorials'],
  },
  // Perform — deployment tested as a professional milestone.
  {
    title: 'Gigs',
    url: '/app/gigs',
    icon: Play,
    activePatterns: ['/app/gigs'],
  },
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { title: 'Support', url: '/app/support', icon: HelpCircle, disabled: true },
  { title: 'Settings', url: '/app/settings', icon: Settings },
];
