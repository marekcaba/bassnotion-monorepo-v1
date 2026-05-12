'use client';

import {
  ExerciseCompletionsChart,
  TempoProgressChart,
  JourneyProgressChart,
  WeeklyActivityChart,
} from './charts/index';

export function PracticeChartDashboard() {
  return (
    <div className="w-full space-y-6 p-4 md:p-6 lg:p-8">
      <div>
        <h1 className="font-serif text-[22px] text-[#E8E4DD]">
          Practice Overview
        </h1>
        <p className="mt-1 text-sm text-[#8A8690]">
          Your practice stats at a glance
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6">
        <ExerciseCompletionsChart />
        <TempoProgressChart />
        <JourneyProgressChart />
        <WeeklyActivityChart />
      </div>
    </div>
  );
}
