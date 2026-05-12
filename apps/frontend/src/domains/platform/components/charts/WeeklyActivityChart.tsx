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
import { weeklyActivityData } from '../../data/practiceChartMockData';
import { weeklyActivityConfig } from '../../data/practiceChartConfig';

export function WeeklyActivityChart() {
  return (
    <Card className="border-white/[0.06] bg-[#141318]">
      <CardHeader>
        <CardTitle className="text-lg font-serif text-[#E8E4DD]">
          Weekly Activity
        </CardTitle>
        <CardDescription className="text-[#8A8690]">
          Practice time and exercises over the last 7 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={weeklyActivityConfig}
          className="h-[220px] w-full"
        >
          <AreaChart accessibilityLayer data={weeklyActivityData}>
            <CartesianGrid
              vertical={false}
              stroke="rgba(255,255,255,0.06)"
            />
            <XAxis
              dataKey="day"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tick={{ fill: '#8A8690', fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fill: '#8A8690', fontSize: 11 }}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Area
              dataKey="minutes"
              type="monotone"
              fill="var(--color-minutes)"
              fillOpacity={0.3}
              stroke="var(--color-minutes)"
            />
            <Area
              dataKey="exercises"
              type="monotone"
              fill="var(--color-exercises)"
              fillOpacity={0.3}
              stroke="var(--color-exercises)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
