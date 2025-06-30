'use client';

import React, { useEffect } from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { CheckCircle, Lightbulb, Target, TrendingUp } from 'lucide-react';
import { SyncedWidget } from '../base/SyncedWidget.js';
import type { SyncedWidgetRenderProps } from '../base/SyncedWidget.js';

interface Concept {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  difficulty: 'fundamental' | 'intermediate' | 'advanced';
}

interface TutorialData {
  id: string;
  title: string;
  artist: string;
  difficulty: string;
  duration: string;
  videoUrl: string;
  concepts: string[];
}

interface TeachingTakeawayCardProps {
  tutorialData?: TutorialData;
}

const keyConcepts: Concept[] = [
  {
    id: 1,
    title: 'Modal Interchange',
    description:
      'Using different modes from the same root note to create tension',
    icon: <Target className="w-5 h-5" />,
    difficulty: 'advanced',
  },
  {
    id: 2,
    title: 'Tension & Release',
    description: 'Strategic use of dissonance to enhance musical expression',
    icon: <TrendingUp className="w-5 h-5" />,
    difficulty: 'intermediate',
  },
  {
    id: 3,
    title: 'II-V-I Variations',
    description: 'Creative approaches to the most common jazz progression',
    icon: <Lightbulb className="w-5 h-5" />,
    difficulty: 'fundamental',
  },
];

const difficultyColors = {
  fundamental: 'text-green-400 bg-green-500/10 border-green-500/20',
  intermediate: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
  advanced: 'text-red-400 bg-red-500/10 border-red-500/20',
};

export function TeachingTakeawayCard({
  tutorialData: _tutorialData,
}: TeachingTakeawayCardProps) {
  return (
    <SyncedWidget
      widgetId="teaching-takeaway"
      widgetName="Teaching Takeaway"
      debugMode={process.env.NODE_ENV === 'development'}
    >
      {(syncProps: SyncedWidgetRenderProps) => (
        <TeachingTakeawayCardContent
          tutorialData={_tutorialData}
          syncProps={syncProps}
        />
      )}
    </SyncedWidget>
  );
}

interface TeachingTakeawayCardContentProps {
  tutorialData?: TutorialData;
  syncProps: SyncedWidgetRenderProps;
}

function TeachingTakeawayCardContent({
  tutorialData: _tutorialData,
  syncProps,
}: TeachingTakeawayCardContentProps) {
  // Sync with selected exercise to update teaching content
  useEffect(() => {
    const selectedExercise = syncProps.selectedExercise;
    if (selectedExercise) {
      console.log(
        `💡 TeachingTakeaway: Updated for exercise: ${selectedExercise.title || selectedExercise.id}`,
      );
      // Here you could update the teaching content based on the selected exercise
      // For now, we just log the sync event
    }
  }, [syncProps.selectedExercise]);

  return (
    <Card className="bg-emerald-900/20 backdrop-blur-xl border border-emerald-700/30 shadow-2xl">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-emerald-300 to-green-300 bg-clip-text text-transparent">
              💡 Teaching Takeaway
            </h2>
            <p className="text-emerald-200/80">
              Key learning points and practice tips
            </p>
          </div>
        </div>

        {/* Main Lesson Summary */}
        <div className="bg-emerald-800/20 rounded-xl p-6 mb-6 border border-emerald-600/20">
          <h3 className="text-lg font-semibold text-white mb-3">
            Core Learning
          </h3>
          <p className="text-emerald-100 leading-relaxed mb-4">
            This lesson encourages interval thinking, melodic phrasing, and
            rhythmic creativity — all through a familiar tool: the pentatonic
            scale. Great for breaking out of "box scale" habits.
          </p>

          {/* Learning Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-emerald-700/20 rounded-lg">
              <div className="text-2xl font-bold text-emerald-300">3</div>
              <div className="text-xs text-emerald-200">Key Concepts</div>
            </div>
            <div className="text-center p-3 bg-emerald-700/20 rounded-lg">
              <div className="text-2xl font-bold text-emerald-300">15</div>
              <div className="text-xs text-emerald-200">Minutes</div>
            </div>
            <div className="text-center p-3 bg-emerald-700/20 rounded-lg">
              <div className="text-2xl font-bold text-emerald-300">Int</div>
              <div className="text-xs text-emerald-200">Level</div>
            </div>
          </div>
        </div>

        {/* Key Concepts */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">
            What You'll Master
          </h3>

          {keyConcepts.map((concept, index) => (
            <div
              key={concept.id}
              className="flex items-start gap-4 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30 hover:bg-slate-700/30 transition-all duration-200"
            >
              {/* Concept Number */}
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                {index + 1}
              </div>

              {/* Concept Content */}
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="text-emerald-400">{concept.icon}</div>
                  <h4 className="font-semibold text-white">{concept.title}</h4>
                  <div
                    className={`px-2 py-1 rounded-full text-xs font-medium border ${difficultyColors[concept.difficulty]}`}
                  >
                    {concept.difficulty}
                  </div>
                </div>
                <p className="text-slate-300 text-sm leading-relaxed">
                  {concept.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Practice Recommendation */}
        <div className="mt-6 p-4 bg-gradient-to-r from-emerald-800/20 to-green-800/20 rounded-xl border border-emerald-600/20">
          <div className="flex items-center gap-3 mb-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            <h4 className="font-semibold text-white">Practice Tip</h4>
          </div>
          <p className="text-emerald-100/90 text-sm">
            Start slowly with each modal concept. Practice the exercises at
            60-80 BPM before increasing tempo. Focus on hearing the tension and
            release rather than just playing the notes.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
