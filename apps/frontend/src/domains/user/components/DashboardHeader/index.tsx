import React from 'react';
import { useAuth } from '../../hooks/use-auth';

export function DashboardHeader() {
  const { user } = useAuth();

  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user?.email}</p>
      </div>
    </div>
  );
}
