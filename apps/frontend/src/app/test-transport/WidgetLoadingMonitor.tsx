'use client';

import React, { useEffect, useState } from 'react';

interface LoadingStatus {
  widget: string;
  status: 'loading' | 'loaded' | 'error';
  startTime: number;
  endTime?: number;
  duration?: number;
  message?: string;
}

export function WidgetLoadingMonitor() {
  const [loadingStatuses, setLoadingStatuses] = useState<Record<string, LoadingStatus>>({});

  useEffect(() => {
    // Listen for widget loading events
    const handleWidgetLoadStart = (event: CustomEvent) => {
      const { widget } = event.detail;
      setLoadingStatuses(prev => ({
        ...prev,
        [widget]: {
          widget,
          status: 'loading',
          startTime: Date.now(),
        }
      }));
    };

    const handleWidgetLoadComplete = (event: CustomEvent) => {
      const { widget, message } = event.detail;
      const endTime = Date.now();
      setLoadingStatuses(prev => {
        const start = prev[widget]?.startTime || endTime;
        return {
          ...prev,
          [widget]: {
            widget,
            status: 'loaded',
            startTime: start,
            endTime,
            duration: endTime - start,
            message,
          }
        };
      });
    };

    const handleWidgetLoadError = (event: CustomEvent) => {
      const { widget, error } = event.detail;
      const endTime = Date.now();
      setLoadingStatuses(prev => {
        const start = prev[widget]?.startTime || endTime;
        return {
          ...prev,
          [widget]: {
            widget,
            status: 'error',
            startTime: start,
            endTime,
            duration: endTime - start,
            message: error?.message || 'Unknown error',
          }
        };
      });
    };

    window.addEventListener('widgetLoadStart', handleWidgetLoadStart as EventListener);
    window.addEventListener('widgetLoadComplete', handleWidgetLoadComplete as EventListener);
    window.addEventListener('widgetLoadError', handleWidgetLoadError as EventListener);

    return () => {
      window.removeEventListener('widgetLoadStart', handleWidgetLoadStart as EventListener);
      window.removeEventListener('widgetLoadComplete', handleWidgetLoadComplete as EventListener);
      window.removeEventListener('widgetLoadError', handleWidgetLoadError as EventListener);
    };
  }, []);

  const widgets = Object.values(loadingStatuses).sort((a, b) => a.startTime - b.startTime);

  return (
    <div className="mb-6">
      <h2 className="text-xl mb-2">Widget Loading Monitor</h2>
      <div className="bg-gray-800 p-4 rounded">
        {widgets.length === 0 ? (
          <p className="text-gray-400">No widgets loading yet...</p>
        ) : (
          <div className="space-y-2">
            {widgets.map(status => (
              <div key={status.widget} className="flex items-center gap-4">
                <span className="w-32 font-mono">{status.widget}</span>
                <span className={`w-20 text-sm ${
                  status.status === 'loading' ? 'text-yellow-400' : 
                  status.status === 'loaded' ? 'text-green-400' : 
                  'text-red-400'
                }`}>
                  {status.status}
                </span>
                {status.duration !== undefined && (
                  <span className="text-sm text-gray-400">
                    {status.duration}ms
                  </span>
                )}
                {status.message && (
                  <span className="text-sm text-gray-500">
                    {status.message}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        
        {/* Parallel loading indicator */}
        {widgets.length > 1 && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <p className="text-sm text-gray-400">
              Parallel Loading: {
                widgets.filter(w => w.status === 'loading').length > 1 
                  ? '✅ Multiple widgets loading simultaneously' 
                  : '⚠️ Widgets may be loading sequentially'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}