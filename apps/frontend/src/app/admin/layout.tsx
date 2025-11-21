'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

// Simple admin layout with basic protection
export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  // Check if we're on a tutorial edit page
  const isTutorialEditPage = pathname?.includes('/admin/tutorials/') && pathname?.includes('/edit');

  // For tutorial edit pages, render without admin wrapper
  if (isTutorialEditPage) {
    return <>{children}</>;
  }

  // For other admin pages, use the standard admin layout
  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white shadow-sm border-b">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between">
              <div className="flex">
                <div className="flex flex-shrink-0 items-center">
                  <h2 className="text-xl font-semibold">BassNotion Admin</h2>
                </div>
                <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                  <a
                    href="/admin/monitoring"
                    className="inline-flex items-center border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 text-sm font-medium text-gray-900"
                  >
                    Monitoring
                  </a>
                  <a
                    href="/admin/tutorials"
                    className="inline-flex items-center border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 text-sm font-medium text-gray-900"
                  >
                    Tutorials
                  </a>
                  <a
                    href="/admin/instruments/wurlitzer"
                    className="inline-flex items-center border-b-2 border-transparent hover:border-gray-300 px-1 pt-1 text-sm font-medium text-gray-900"
                  >
                    Wurlitzer
                  </a>
                </div>
              </div>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl">{children}</main>
      </div>
    </>
  );
}
