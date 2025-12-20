'use client';

import React, { useEffect } from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

// V107: Debug params resolution
export default function V107Page({
  params,
}: {
  params: Promise<{ tutorialId: string }>;
}) {
  logger.info('🔍 V107 - Debug params');

  // Log the raw params
  logger.info('Raw params:', params);

  // Try to resolve params
  const resolvedParams = React.use(params);
  logger.info('Resolved params:', resolvedParams);

  const tutorialSlug = resolvedParams.tutorialId;
  logger.info('Tutorial slug:', tutorialSlug);

  // Also try direct access
  useEffect(() => {
    params.then((p) => {
      logger.info('Params via .then():', p);
    });
  }, [params]);

  return (
    <div className="min-h-screen bg-gray-900 p-8 text-white">
      <h1 className="text-2xl mb-4">V107: Params Debug</h1>

      <div className="space-y-4 font-mono text-sm">
        <div className="bg-gray-800 p-4 rounded">
          <strong>Expected slug:</strong> come-together
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <strong>Resolved tutorialId:</strong> {tutorialSlug || 'UNDEFINED'}
        </div>

        <div className="bg-gray-800 p-4 rounded">
          <strong>Full resolved params:</strong>
          <pre>{JSON.stringify(resolvedParams, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
