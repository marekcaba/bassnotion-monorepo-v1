'use client';

import { useState, useCallback } from 'react';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { authService } from '@/domains/user/api/auth';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

const NAV_LINKS = [
  { label: 'Practice', href: '/library' },
  { label: 'College', href: '#' },
  { label: 'Blog', href: '#' },
];

export function HomeNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const { navigateWithTransition } = useViewTransitionRouter();

  const handleNavClick = useCallback(
    (href: string) => {
      setIsMobileMenuOpen(false);
      if (href !== '#') {
        navigateWithTransition(href);
      }
    },
    [navigateWithTransition],
  );

  const handleAuthButtonClick = useCallback(() => {
    setIsMobileMenuOpen(false);
    const target = isAuthenticated ? '/dashboard' : '/login';
    navigateWithTransition(target);
  }, [isAuthenticated, navigateWithTransition]);

  const handleLogout = useCallback(async () => {
    setIsMobileMenuOpen(false);
    await authService.signOut();
    navigateWithTransition('/');
  }, [navigateWithTransition]);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  return (
    <>
      {/* Navbar - 3 buttons center, Login/Dashboard far right */}
      <nav className="w-full bg-black py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Spacer for left side to balance layout */}
          <div className="hidden md:block w-24" />

          {/* Desktop Navigation - Center */}
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <button
                key={link.label}
                onClick={() => handleNavClick(link.href)}
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
              >
                {link.label}
              </button>
            ))}
          </div>

          {/* Desktop Auth Button - Right */}
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={handleAuthButtonClick}
              className="border border-[#ffc700] text-[#ffc700] hover:bg-[#ffc700] hover:text-black px-5 py-1.5 rounded transition-colors text-sm font-medium"
            >
              {isAuthenticated ? 'Dashboard' : 'Login'}
            </button>
            {isAuthenticated && (
              <button
                type="button"
                onClick={handleLogout}
                className="border border-[#ffc700] text-[#ffc700] hover:bg-[#ffc700] hover:text-black w-8 h-8 rounded transition-colors flex items-center justify-center"
                aria-label="Log out"
                title="Log out"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </button>
            )}
          </div>

          {/* Mobile Hamburger Button */}
          <button
            className="md:hidden p-2 text-white"
            onClick={toggleMobileMenu}
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/80"
            onClick={() => setIsMobileMenuOpen(false)}
          />

          {/* Slide-in Menu */}
          <div className="fixed top-0 right-0 h-full w-72 xs:w-80 bg-zinc-900 shadow-xl">
            {/* Close Button */}
            <div className="flex justify-end p-4 pt-safe">
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 text-white"
                aria-label="Close menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Mobile Nav Links */}
            <div className="flex flex-col px-6 space-y-4">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.label}
                  onClick={() => handleNavClick(link.href)}
                  className="text-gray-300 hover:text-white transition-colors text-left py-2 text-lg"
                >
                  {link.label}
                </button>
              ))}

              {/* Mobile Auth Button */}
              <button
                type="button"
                onClick={handleAuthButtonClick}
                className="mt-4 border border-[#ffc700] text-[#ffc700] hover:bg-[#ffc700] hover:text-black px-4 py-2 rounded transition-colors text-center"
              >
                {isAuthenticated ? 'Dashboard' : 'Login'}
              </button>

              {/* Mobile Logout Button */}
              {isAuthenticated && (
                <button
                  type="button"
                  onClick={handleLogout}
                  className="mt-2 border border-gray-500 text-gray-400 hover:border-red-500 hover:text-red-500 px-4 py-2 rounded transition-colors text-center flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                    />
                  </svg>
                  Log out
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
