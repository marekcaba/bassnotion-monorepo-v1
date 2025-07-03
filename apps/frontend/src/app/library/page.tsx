'use client';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import {
  Clock,
  Star,
  User,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useTutorials } from '@/domains/widgets/hooks/useTutorials';
import type { TutorialSummary } from '@bassnotion/contracts';

// YouTube Thumbnail Component
interface YouTubeThumbnailProps {
  videoUrl: string;
  title: string;
  className?: string;
}

function YouTubeThumbnail({
  videoUrl,
  title,
  className = '',
}: YouTubeThumbnailProps) {
  // Extract YouTube video ID from URL
  const getYouTubeVideoId = (url: string): string | null => {
    const regex =
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match?.[1] ?? null;
  };

  const videoId = getYouTubeVideoId(videoUrl);

  if (!videoId) {
    // Fallback to music emoji if no valid YouTube URL
    return (
      <div
        className={`bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center ${className}`}
      >
        <span className="text-3xl">🎵</span>
      </div>
    );
  }

  // YouTube thumbnail URL - try maxresdefault first for better quality
  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  return (
    <div className={`rounded-xl overflow-hidden ${className}`}>
      <img
        src={thumbnailUrl}
        alt={`${title} thumbnail`}
        className="w-full h-full object-cover"
        onError={(e) => {
          // Fallback to hqdefault if maxres fails
          const target = e.target as HTMLImageElement;
          if (target.src.includes('maxresdefault')) {
            target.src = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
          } else if (target.src.includes('hqdefault')) {
            // Final fallback to emoji if all thumbnails fail
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML =
                '<div class="bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center w-full h-full"><span class="text-3xl">🎵</span></div>';
            }
          }
        }}
      />
    </div>
  );
}

const getDifficultyColor = (difficulty: string) => {
  const normalizedDifficulty = difficulty.toLowerCase();
  switch (normalizedDifficulty) {
    case 'beginner':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'intermediate':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'advanced':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

const capitalizeDifficulty = (difficulty: string) => {
  return difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
};

export default function LibraryPage() {
  const { navigateWithTransition } = useViewTransitionRouter();
  const { tutorials, total, isLoading, error, isError, refetch } =
    useTutorials();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-300">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateWithTransition('/')}
                  className="text-white/70 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </div>

              <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
                <CardContent className="p-8 text-center">
                  <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-4">
                    YouTube Tutorial Library
                  </h1>
                  <p className="text-white/70 text-lg">
                    Choose from our collection of interactive bass tutorials.
                    Each lesson includes advanced widgets, sheet music,
                    fretboard visualization, and personalized takeaways.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Loading State */}
            <Card className="bg-white/5 backdrop-blur-md border-white/10">
              <CardContent className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-purple-400" />
                <p className="text-white/70">Loading tutorials...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (isError || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="container mx-auto px-4 py-6 max-w-2xl">
          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 text-slate-300">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateWithTransition('/')}
                  className="text-white/70 hover:text-white"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Home
                </Button>
              </div>

              <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
                <CardContent className="p-8 text-center">
                  <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-4">
                    YouTube Tutorial Library
                  </h1>
                  <p className="text-white/70 text-lg">
                    Choose from our collection of interactive bass tutorials.
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Error State */}
            <Card className="bg-red-900/20 backdrop-blur-md border-red-500/30">
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-8 h-8 mx-auto mb-4 text-red-400" />
                <h3 className="text-lg font-semibold text-red-300 mb-2">
                  Unable to Load Tutorials
                </h3>
                <p className="text-red-200/70 mb-4">
                  {error?.message ||
                    'There was an error loading the tutorials. Please try again.'}
                </p>
                <Button
                  onClick={() => refetch()}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Try Again
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Instagram-style scrollable container - same as exerciser pages */}
      <div className="container mx-auto px-4 py-6 max-w-2xl">
        <div className="space-y-6">
          {/* Header Card */}
          <div className="space-y-4">
            {/* Back to Home Button */}
            <div className="flex items-center gap-3 text-slate-300">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigateWithTransition('/')}
                className="text-white/70 hover:text-white"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Home
              </Button>
            </div>

            {/* Title Section */}
            <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
              <CardContent className="p-8 text-center">
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent mb-4">
                  YouTube Tutorial Library
                </h1>
                <p className="text-white/70 text-lg">
                  Choose from our collection of interactive bass tutorials. Each
                  lesson includes advanced widgets, sheet music, fretboard
                  visualization, and personalized takeaways.
                </p>
                {total > 0 && (
                  <p className="text-white/50 text-sm mt-2">
                    {total} tutorial{total !== 1 ? 's' : ''} available
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Tutorial Cards - Centered and scrollable */}
          {tutorials.length === 0 ? (
            <Card className="bg-white/5 backdrop-blur-md border-white/10">
              <CardContent className="p-8 text-center">
                <p className="text-white/70">
                  No tutorials available at the moment.
                </p>
              </CardContent>
            </Card>
          ) : (
            tutorials.map((tutorial: TutorialSummary) => (
              <Card
                key={tutorial.id}
                className="bg-white/5 backdrop-blur-md border-white/10 hover:bg-white/10 transition-all duration-300 cursor-pointer group hover:scale-[1.02] hover:shadow-2xl"
                onClick={() =>
                  navigateWithTransition(`/library/${tutorial.slug}`)
                }
              >
                <CardHeader className="pb-4">
                  {/* Thumbnail and Title Section */}
                  <div className="flex items-start gap-4">
                    {/* Thumbnail */}
                    <div className="w-24 h-16 flex-shrink-0 group-hover:scale-105 transition-all duration-300">
                      <YouTubeThumbnail
                        videoUrl={tutorial.youtube_url || ''}
                        title={tutorial.title}
                        className="w-full h-full"
                      />
                    </div>

                    {/* Title and Artist */}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-white text-xl font-bold leading-tight mb-2">
                        {tutorial.title}
                      </CardTitle>
                      <div className="flex items-center gap-2 text-white/60 mb-3">
                        <User className="w-4 h-4" />
                        <span className="text-sm">{tutorial.artist}</span>
                      </div>

                      {/* Badges using simple spans */}
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getDifficultyColor(tutorial.difficulty)}`}
                        >
                          {capitalizeDifficulty(tutorial.difficulty)}
                        </span>
                        {tutorial.duration && (
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-white/10 text-white/80 border-white/20">
                            <Clock className="w-3 h-3 mr-1" />
                            {tutorial.duration}
                          </span>
                        )}
                        {tutorial.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                            <span className="text-white/80 text-sm font-medium">
                              {tutorial.rating}
                            </span>
                          </div>
                        )}
                        {tutorial.exercise_count > 0 && (
                          <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-blue-500/20 text-blue-300 border-blue-500/30">
                            {tutorial.exercise_count} exercise
                            {tutorial.exercise_count !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Description */}
                  {tutorial.description && (
                    <p className="text-white/70 text-sm leading-relaxed">
                      {tutorial.description}
                    </p>
                  )}

                  {/* Concepts */}
                  {tutorial.concepts && tutorial.concepts.length > 0 && (
                    <div className="space-y-2">
                      <span className="text-white/80 text-sm font-medium">
                        Key Concepts:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {tutorial.concepts.map((concept) => (
                          <span
                            key={concept}
                            className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold text-white/70 border-white/20 bg-white/5"
                          >
                            {concept}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Call to Action */}
                  <div className="pt-2">
                    <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-3 text-center group-hover:from-purple-500/30 group-hover:to-pink-500/30 transition-all duration-300">
                      <span className="text-white/90 text-sm font-medium">
                        Start Learning →
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
