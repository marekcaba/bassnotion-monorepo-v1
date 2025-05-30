import '@/shared/styles/globals.css';
import { ReactNode } from 'react';
import { ReactQueryProvider } from '@/lib/react-query';
import { AuthProvider } from '@/domains/user/components/auth';
import { Toaster } from '@/shared/components/ui/toaster';

import { inter, metadata } from './layout.constants';

export const generateMetadata = () => metadata;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className={inter.className}>
        <ReactQueryProvider>
          <AuthProvider>{children}</AuthProvider>
        </ReactQueryProvider>
        <Toaster />
      </body>
    </html>
  );
}
