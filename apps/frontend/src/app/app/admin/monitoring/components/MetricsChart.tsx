'use client';

import { useEffect, useRef } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';

interface DataPoint {
  timestamp: number;
  value: number;
}

interface MetricsChartProps {
  title: string;
  data: DataPoint[];
  color?: string;
  unit?: string;
  height?: number;
  maxPoints?: number;
}

export function MetricsChart({
  title,
  data,
  color = '#3b82f6',
  unit = '',
  height = 200,
  maxPoints = 50,
}: MetricsChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio;
    canvas.height = rect.height * window.devicePixelRatio;
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

    // Clear canvas
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (data.length === 0) return;

    // Keep only last maxPoints
    const chartData = data.slice(-maxPoints);

    // Calculate min/max values
    const values = chartData.map((d) => d.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const valueRange = maxValue - minValue || 1;

    // Draw grid lines
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    // Horizontal grid lines
    for (let i = 0; i <= 4; i++) {
      const y = (rect.height / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(rect.width, y);
      ctx.stroke();
    }

    // Draw data line
    ctx.setLineDash([]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();

    chartData.forEach((point, index) => {
      const x = (index / (chartData.length - 1)) * rect.width;
      const y =
        rect.height - ((point.value - minValue) / valueRange) * rect.height;

      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });

    ctx.stroke();

    // Draw area fill
    ctx.fillStyle = color + '20';
    ctx.beginPath();
    ctx.moveTo(0, rect.height);

    chartData.forEach((point, index) => {
      const x = (index / (chartData.length - 1)) * rect.width;
      const y =
        rect.height - ((point.value - minValue) / valueRange) * rect.height;
      ctx.lineTo(x, y);
    });

    ctx.lineTo(rect.width, rect.height);
    ctx.closePath();
    ctx.fill();

    // Draw value labels
    ctx.fillStyle = '#6b7280';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${maxValue.toFixed(1)}${unit}`, rect.width - 5, 15);
    ctx.fillText(
      `${minValue.toFixed(1)}${unit}`,
      rect.width - 5,
      rect.height - 5,
    );
  }, [data, color, unit, height, maxPoints]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pb-2">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ height: `${height}px` }}
        />
        {data.length > 0 && (
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>
              Current: {data[data.length - 1]?.value.toFixed(1)}
              {unit}
            </span>
            <span>
              {new Date(data[data.length - 1]?.timestamp).toLocaleTimeString()}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
