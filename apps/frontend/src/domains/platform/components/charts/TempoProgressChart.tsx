'use client';

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '@/shared/components/ui/chart';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { tempoProgressData } from '../../data/practiceChartMockData';
import { tempoProgressConfig } from '../../data/practiceChartConfig';

export function TempoProgressChart() {
  return (
    <Card className="border-white/[0.06] bg-[#141318]">
      <CardHeader>
        <CardTitle className="text-lg font-serif text-[#E8E4DD]">
          Tempo Progress
        </CardTitle>
        <CardDescription className="text-[#8A8690]">
          Current BPM vs target across exercises
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={tempoProgressConfig}
          className="h-[220px] w-full"
        >
          <AreaChart accessibilityLayer data={tempoProgressData}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="exercise"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fill: '#8A8690', fontSize: 11 }}
              tickFormatter={(value) => value.slice(0, 6)}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#8A8690', fontSize: 11 }}
              domain={[0, 150]}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="targetBpm"
              type="monotone"
              fill="var(--color-targetBpm)"
              fillOpacity={0.1}
              stroke="var(--color-targetBpm)"
              strokeDasharray="5 5"
            />
            <Area
              dataKey="currentBpm"
              type="monotone"
              fill="var(--color-currentBpm)"
              fillOpacity={0.3}
              stroke="var(--color-currentBpm)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
