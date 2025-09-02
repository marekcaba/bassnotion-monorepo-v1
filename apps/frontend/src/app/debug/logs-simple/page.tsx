'use client';

import { useState } from 'react';

export default function SimpleLogsDebugPage() {
  const [correlationId, setCorrelationId] = useState('');
  const [logs, setLogs] = useState<any>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const searchLogs = async () => {
    if (!correlationId.trim()) return;

    setLoading(true);
    setError('');
    setLogs(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/v1/logs/trace?correlationId=${correlationId}`,
        {
          headers: {
            'Content-Type': 'application/json',
            'x-correlation-id': correlationId,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setLogs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Simple Log Viewer</h1>
      
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Enter correlation ID..."
          value={correlationId}
          onChange={(e) => setCorrelationId(e.target.value)}
          style={{
            padding: '8px',
            marginRight: '10px',
            width: '300px',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}
        />
        <button
          onClick={searchLogs}
          disabled={loading || !correlationId.trim()}
          style={{
            padding: '8px 16px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Loading...' : 'Search'}
        </button>
      </div>

      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          marginBottom: '20px',
        }}>
          Error: {error}
        </div>
      )}

      {logs && (
        <div>
          <h2>Results</h2>
          <pre style={{
            backgroundColor: '#f5f5f5',
            padding: '15px',
            borderRadius: '4px',
            overflow: 'auto',
            maxHeight: '600px',
          }}>
            {JSON.stringify(logs, null, 2)}
          </pre>
        </div>
      )}

      <div style={{ marginTop: '40px', fontSize: '14px', color: '#666' }}>
        <p>Debug Info:</p>
        <ul>
          <li>API URL: {process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}</li>
          <li>Environment: {process.env.NODE_ENV}</li>
          <li>Note: This endpoint may require authentication. Check the Network tab for 401 errors.</li>
        </ul>
      </div>
    </div>
  );
}