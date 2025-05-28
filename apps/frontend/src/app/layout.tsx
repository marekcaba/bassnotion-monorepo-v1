import '@/shared/styles/globals.css';
import { ReactNode } from 'react';
import { ReactQueryProvider } from '@/lib/react-query';
import { AuthProvider } from '@/domains/user/components/auth';
import { Toaster } from '@/shared/components/ui/toaster';

import { inter } from './layout.constants';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ReactQueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </ReactQueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
