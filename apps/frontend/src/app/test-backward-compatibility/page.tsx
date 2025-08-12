'use client';

import React, { useState, useEffect } from 'react';
import { testBackwardCompatibility } from '@/test/backward-compatibility-test';

export default function TestBackwardCompatibilityPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  useEffect(() => {
    // Capture console logs
    const originalLog = console.log;
    const originalError = console.error;
    
    console.log = (...args) => {
      originalLog(...args);
      setLogs(prev => [...prev, args.join(' ')]);
    };
    
    console.error = (...args) => {
      originalError(...args);
      setLogs(prev => [...prev, `ERROR: ${args.join(' ')}`]);
    };
    
    return () => {
      console.log = originalLog;
      console.error = originalError;
    };
  }, []);
  
  const runTest = async () => {
    setIsRunning(true);
    setLogs([]);
    
    try {
      await testBackwardCompatibility();
    } catch (error) {
      console.error('Test failed:', error);
    }
    
    setIsRunning(false);
  };
  
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">UnifiedTransport Backward Compatibility Test</h1>
      
      <div className="mb-4">
        <button 
          onClick={runTest}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isRunning ? 'Running...' : 'Run Test'}
        </button>
      </div>
      
      <div className="bg-gray-900 text-gray-100 p-4 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Test Output:</h2>
        <pre className="whitespace-pre-wrap font-mono text-sm">
          {logs.join('\n') || 'Click "Run Test" to start...'}
        </pre>
      </div>
    </div>
  );
}