'use client';

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/shared/components/ui/chart';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { exerciseCompletionData } from '../../data/practiceChartMockData';
import { exerciseCompletionConfig } from '../../data/practiceChartConfig';

export function ExerciseCompletionsChart() {
  return (
    <Card className="border-white/[0.06] bg-[#141318]">
      <CardHeader>
        <CardTitle className="text-lg font-serif text-[#E8E4DD]">
          Exercise Completions
        </CardTitle>
        <CardDescription className="text-[#8A8690]">
          Completion count per exercise (max 10)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={exerciseCompletionConfig}
          className="h-[220px] w-full"
        >
          <BarChart accessibilityLayer data={exerciseCompletionData}>
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
              domain={[0, 10]}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar
              dataKey="completions"
              fill="var(--color-completions)"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
