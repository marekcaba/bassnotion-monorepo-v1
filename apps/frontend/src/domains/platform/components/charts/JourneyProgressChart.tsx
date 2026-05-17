'use client';

import { RadialBar, RadialBarChart, PolarAngleAxis } from 'recharts';
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
import { journeyProgressData } from '../../data/practiceChartMockData';
import { journeyProgressConfig } from '../../data/practiceChartConfig';

export function JourneyProgressChart() {
  return (
    <Card className="border-white/[0.06] bg-[#141318]">
      <CardHeader>
        <CardTitle className="text-lg font-serif text-[#E8E4DD]">
          Journey Progress
        </CardTitle>
        <CardDescription className="text-[#8A8690]">
          Overall completion across your learning path
        </CardDescription>
      </CardHeader>
      <CardContent className="flex items-center justify-center">
        <ChartContainer
          config={journeyProgressConfig}
          className="h-[220px] w-[220px]"
        >
          <RadialBarChart
            data={journeyProgressData}
            innerRadius={30}
            outerRadius={100}
            startAngle={180}
            endAngle={0}
          >
            <PolarAngleAxis
              type="number"
              domain={[0, 100]}
              angleAxisId={0}
              tick={false}
            />
            <RadialBar dataKey="value" background cornerRadius={6} />
            <ChartTooltip content={<ChartTooltipContent nameKey="label" />} />
          </RadialBarChart>
        </ChartContainer>
      </CardContent>
      <div className="flex justify-center gap-6 px-6 pb-4">
        {journeyProgressData.map((item) => (
          <div key={item.label} className="text-center">
            <div className="text-lg font-bold text-[#E8E4DD]">
              {item.value}%
            </div>
            <div className="text-[10px] uppercase tracking-wide text-[#8A8690]">
              {item.label}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
