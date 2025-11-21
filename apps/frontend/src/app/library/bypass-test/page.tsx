'use client';

import React from 'react';
import { useCorrelation } from '@/shared/hooks/useCorrelation';

interface BypassPageProps {
  params: Promise<{
    tutorialId: string;
  }>;
}

export default function BypassPage({ params }: BypassPageProps) {
  const { logger } = useCorrelation('BypassPage');
  const resolvedParams = React.use(params);
  const tutorialSlug = resolvedParams.tutorialId;

  React.useEffect(() => {
    // Simple alert to test if page loads
    alert(`Bypass page loaded! Tutorial: ${tutorialSlug}`);

    // Log to console
    logger.info('BYPASS PAGE LOADED:', { tutorialSlug });

    // Check if window is frozen
    let count = 0;
    const interval = setInterval(() => {
      count++;
      logger.info('Page is alive', { count });
      if (count >= 5) {
        clearInterval(interval);
        alert('Page is responsive! Interval completed.');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [tutorialSlug]);

  return (
    <div
      style={{
        padding: '40px',
        backgroundColor: 'white',
        color: 'black',
        minHeight: '100vh',
      }}
    >
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>
        Bypass Test Page
      </h1>
      <p>Tutorial slug: {tutorialSlug}</p>
      <div style={{ marginTop: '20px' }}>
        <button
          onClick={() => alert('Button clicked!')}
          style={{
            padding: '10px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          Test Button
        </button>
      </div>
      <div style={{ marginTop: '20px' }}>
        <input
          type="text"
          placeholder="Type here to test input"
          style={{
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            width: '300px',
          }}
        />
      </div>
    </div>
  );
}
