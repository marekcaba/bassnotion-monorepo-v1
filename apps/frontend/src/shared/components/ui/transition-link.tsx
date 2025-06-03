'use client';

import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { ReactNode, MouseEvent } from 'react';

interface TransitionLinkProps {
  href: string;
  children: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
  target?: string;
  rel?: string;
}

/**
 * Enhanced Link component that uses View Transitions for smooth navigation
 * Drop-in replacement for Next.js Link with transition support
 */
export function TransitionLink({
  href,
  children,
  className,
  onClick,
  target,
  rel,
  ...props
}: TransitionLinkProps) {
  const { navigateWithTransition } = useViewTransitionRouter();

  const handleClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // Call custom onClick if provided
    if (onClick) {
      onClick(e);
    }

    // Don't prevent default for external links or if default was prevented
    if (e.defaultPrevented || target === '_blank' || href.startsWith('http')) {
      return;
    }

    // Use enhanced transitions for internal navigation
    e.preventDefault();
    navigateWithTransition(href);
  };

  return (
    <a
      href={href}
      className={className}
      onClick={handleClick}
      target={target}
      rel={rel}
      {...props}
    >
      {children}
    </a>
  );
}
