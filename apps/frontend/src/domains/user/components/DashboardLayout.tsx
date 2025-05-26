import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col gap-6">{children}</div>
    </div>
  );
}
