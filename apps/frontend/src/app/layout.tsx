import '@/shared/styles/globals.css';
import { ReactNode } from 'react';
import { ReactQueryProvider } from '@/lib/react-query';

import { inter } from './layout.constants';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ReactQueryProvider>{children}</ReactQueryProvider>
      </body>
    </html>
  );
}
