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
  { title: 'Studio', url: '/app/studio', icon: Headphones },
  { title: 'Gigs', url: '/app/gigs', icon: Play },
  { title: 'Backstage', url: '/app/backstage', icon: Martini },
];

export const BOTTOM_NAV_ITEMS: NavItem[] = [
  { title: 'Support', url: '/app/support', icon: HelpCircle, disabled: true },
  { title: 'Settings', url: '/app/settings', icon: Settings },
];
