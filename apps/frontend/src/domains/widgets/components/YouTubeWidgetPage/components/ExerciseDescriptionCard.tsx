'use client';

import React, { useMemo } from 'react';
import { Clock, Zap } from 'lucide-react';
import { safeString } from '../utils';

const difficultyColors: Record<string, { text: string }> = {
  beginner: { text: 'text-emerald-400' },
  easy: { text: 'text-emerald-400' },
  intermediate: { text: 'text-amber-400' },
  medium: { text: 'text-amber-400' },
  advanced: { text: 'text-red-400' },
  hard: { text: 'text-red-400' },
  expert: { text: 'text-red-400' },
};

interface ExerciseDescriptionCardProps {
  selectedExercise?: any;
}

export const ExerciseDescriptionCard = React.memo(function ExerciseDescriptionCard({
  selectedExercise,
}: ExerciseDescriptionCardProps) {
  const details = useMemo(() => {
    if (!selectedExercise) return null;
    const difficulty = safeString(selectedExercise.difficulty).toLowerCase() || 'beginner';
    const colors = difficultyColors[difficulty] || difficultyColors.beginner;
    return {
      title: safeString(selectedExercise.title) || 'Untitled',
      description: safeString(selectedExercise.description) || 'No description available.',
      difficulty: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
      colors,
      bpm: selectedExercise.bpm || '\u2014',
      bars: selectedExercise.total_bars || '\u2014',
      key: safeString(selectedExercise.key) || '\u2014',
    };
  }, [selectedExercise]);

  if (!details) {
    return (
      <div className="relative bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black/20 p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10 pointer-events-none" />
        <p className="relative text-slate-500/80 text-sm text-center py-3 italic">
          Select an exercise to see details
        </p>
      </div>
    );
  }

  return (
    <div className="relative bg-gradient-to-br from-slate-800/80 via-slate-800/60 to-slate-900/80 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl shadow-black/20 p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-black/10 pointer-events-none" />

      <div className="relative">
        {/* Title & Difficulty */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <h4 className="text-base font-semibold text-white/90">{details.title}</h4>
          <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${details.colors.text} bg-white/5 border border-current/20`}>
            {details.difficulty}
          </span>
        </div>

        {/* Description - max 3 lines with fixed height */}
        <p className="text-slate-400/90 text-sm leading-relaxed mb-4 line-clamp-3 h-[4.5rem]">{details.description}</p>

        {/* Meta */}
        <div className="flex items-center gap-5 text-xs pt-3 border-t border-white/10">
          <div className="flex items-center gap-1.5 text-slate-400 hover:text-slate-300 transition-colors">
            <Clock className="w-3.5 h-3.5 text-violet-400/70" />
            <span>{details.bars} bars</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 hover:text-slate-300 transition-colors">
            <Zap className="w-3.5 h-3.5 text-amber-400/70" />
            <span>{details.bpm} BPM</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-400 hover:text-slate-300 transition-colors">
            <span className="text-emerald-400/70">{'\u266A'}</span>
            <span>Key: {details.key}</span>
          </div>
        </div>
      </div>
    </div>
  );
});
