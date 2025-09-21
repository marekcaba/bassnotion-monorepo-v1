import { ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';

// Simple admin layout with basic protection
// TODO: Add proper authentication check once admin roles are implemented
export default function AdminLayout({ children }: { children: ReactNode }) {
  // Basic protection - check for admin header or localhost
  const headersList = headers();
  const host = headersList.get('host') || '';

  // Allow access from localhost for development
  const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');

  // In production, you would check for admin authentication here
  // For now, we'll allow localhost access for monitoring
  if (!isLocalhost && process.env.NODE_ENV === 'production') {
    // TODO: Check for admin authentication
    // redirect('/');
  }

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
                    className="inline-flex items-center border-b-2 border-indigo-500 px-1 pt-1 text-sm font-medium text-gray-900"
                  >
                    Monitoring
                  </a>
                  {/* Add more admin navigation items here */}
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
