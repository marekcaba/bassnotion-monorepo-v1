'use client';

import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import type { Tutorial } from '@bassnotion/contracts';

interface TutorialInfoCardProps {
  tutorialData?: Tutorial;
}

export function TutorialInfoCard({ tutorialData }: TutorialInfoCardProps) {
  // Use tutorialData or fallback to default
  const title = tutorialData?.title || 'Come Together';
  const description =
    tutorialData?.description ||
    'Learn advanced modal thinking and tension/release techniques';
  const difficulty = tutorialData?.difficulty || 'advanced';

  return (
    <div className="relative">
      {/* Unified Tutorial + Core Concept Card */}
      <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl overflow-hidden">
        {/* Difficulty Tag - Top Right Corner of Card */}
        <div className="absolute top-4 right-4 z-10">
          <span className="bg-orange-500 text-white px-2 py-0.5 rounded-full text-xs font-medium shadow-lg">
            {difficulty}
          </span>
        </div>

        <CardContent className="p-6">
          {/* Tutorial Header Section */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-300 via-purple-300 to-pink-300 bg-clip-text text-transparent mb-3">
              {title}
            </h1>
            <p className="text-slate-400 text-base">{description}</p>
          </div>

          {/* Core Concept Section */}
          <div className="border-t border-slate-700/50 pt-6">
            <h3 className="text-xl font-semibold text-white mb-3">
              Core Concept
            </h3>
            <p className="text-slate-400 text-base leading-relaxed mb-4">
              Use different modes starting from the same root note (D) over a
              2-5-1 progression to create intentional tension and release
              without shifting the root.
            </p>

            {/* Core Concept Bullet Points */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-green-300">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm">
                  Modal interchange over static root notes
                </span>
              </div>
              <div className="flex items-center gap-2 text-green-300">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm">
                  Advanced tension and release techniques
                </span>
              </div>
              <div className="flex items-center gap-2 text-green-300">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span className="text-sm">II-V-I progression variations</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
