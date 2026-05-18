import {
  Home,
  GraduationCap,
  Headphones,
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

export const MAIN_NAV_ITEMS: NavItem[] = [
  { title: 'Home', url: '/app', icon: Home },
  {
    title: 'Bassment',
    url: '/app/bassment',
    icon: GraduationCap,
    activePatterns: ['/app/bassment', '/app/tutorials'],
  },
  // The 3 items below are MVP placeholders (the underlying pages
  // just render "coming soon"). Marked disabled until they're
  // built so users don't navigate to dead routes pre-launch.
  { title: 'Studio', url: '/app/studio', icon: Headphones, disabled: true },
  { title: 'Gigs', url: '/app/gigs', icon: Play, disabled: true },
  { title: 'Backstage', url: '/app/backstage', icon: Martini, disabled: true },
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { title: 'Support', url: '/app/support', icon: HelpCircle, disabled: true },
  { title: 'Settings', url: '/app/settings', icon: Settings },
];
