import React from 'react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';

export function DashboardContent() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Recent Exercises</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No exercises completed yet.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Learning Progress</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Start practicing to track your progress.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">5 tokens remaining</p>
        </CardContent>
      </Card>
    </div>
  );
}
