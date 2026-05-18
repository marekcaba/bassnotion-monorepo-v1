'use client';

import Image from 'next/image';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { Clock, Loader2, AlertCircle, Plus, ArrowLeft } from 'lucide-react';
import { useTutorials } from '@/domains/widgets/hooks/useTutorials';
import { useUserProfile } from '@/domains/user/hooks/use-user-profile';
import { UserIndicator } from '@/domains/user/components/UserIndicator';
import { HomeNavbar } from '../_components/HomeNavbar';
import type { TutorialSummary } from '@bassnotion/contracts';

// Tutorial Thumbnail Component - supports custom thumbnails and YouTube auto-generated
interface TutorialThumbnailProps {
  videoId?: string;
  videoUrl?: string;
  customThumbnailUrl?: string;
  title: string;
  className?: string;
}

function TutorialThumbnail({
  videoId: propVideoId,
  videoUrl,
  customThumbnailUrl,
  title,
  className = '',
}: TutorialThumbnailProps) {
  // Extract YouTube video ID from URL if needed
  const getYouTubeVideoId = (url: string): string | null => {
    const regex =
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/;
    const match = url.match(regex);
    return match?.[1] ?? null;
  };

  // Prefer direct videoId prop, otherwise extract from URL
  const videoId =
    propVideoId || (videoUrl ? getYouTubeVideoId(videoUrl) : null);

  // If custom thumbnail exists, use it (takes priority)
  if (customThumbnailUrl) {
    console.log('[TutorialThumbnail] Using custom thumbnail:', {
      title,
      customThumbnailUrl,
    });
    return (
      <div className={`overflow-hidden ${className}`}>
        <img
          src={customThumbnailUrl}
          alt={`${title} thumbnail`}
          className="w-full h-full object-cover"
          onError={(e) => {
            console.error(
              '[TutorialThumbnail] Failed to load custom thumbnail - URL:',
              customThumbnailUrl,
              '- Title:',
              title,
            );
          }}
        />
      </div>
    );
  }

  console.log('[TutorialThumbnail] No custom thumbnail:', {
    title,
    customThumbnailUrl,
    videoId,
  });

  // No custom thumbnail and no YouTube video - show placeholder
  if (!videoId) {
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
    <div className={`overflow-hidden ${className}`}>
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

const getDifficultyColor = (difficulty: any) => {
  // Handle both string and Difficulty object with value property
  const difficultyValue =
    typeof difficulty === 'object' ? difficulty?.value : difficulty;
  if (!difficultyValue) {
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
  const normalizedDifficulty = difficultyValue.toLowerCase();
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

const capitalizeDifficulty = (difficulty: any) => {
  // Handle both string and Difficulty object with value property
  const difficultyValue =
    typeof difficulty === 'object' ? difficulty?.value : difficulty;
  if (!difficultyValue) {
    return 'Unknown';
  }
  return difficultyValue.charAt(0).toUpperCase() + difficultyValue.slice(1);
};

function LibraryPageContent() {
  const { navigateWithTransition } = useViewTransitionRouter();
  const { tutorials, total, isLoading, error, isError, refetch } =
    useTutorials();
  const { profile, cachedRole } = useUserProfile();

  // Use cached role for immediate display, fall back to profile role when loaded
  // This prevents layout shift on page reload/navigation
  const isAdmin = profile?.role === 'admin' || cachedRole === 'admin';

  if (isLoading) {
    return (
      <div className="min-h-screen">
        {/* Header with Logo */}
        <header className="w-full pt-8 sm:pt-12 pb-5 flex justify-center">
          <button
            onClick={() => navigateWithTransition('/')}
            className="cursor-pointer"
          >
            <Image
              src="/BASSICOLOGY BIG.png"
              alt="Bassicology"
              width={600}
              height={150}
              className="w-[180px] sm:w-[260px] md:w-[320px] lg:w-[400px] xl:w-[480px] h-auto"
              priority
            />
          </button>
        </header>

        {/* Navbar */}
        <HomeNavbar />

        <div className="mx-auto px-4 py-6 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
          <div className="space-y-6">
            {/* User Indicator and Navigation Controls */}
            <div className="flex justify-between items-center gap-3">
              {/* Back to Home button on the left */}
              <Button
                onClick={() => navigateWithTransition('/')}
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white p-2"
                title="Back to Home"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>

              {/* User indicator on the right */}
              <div className="flex items-center gap-3">
                <UserIndicator />
              </div>
            </div>

            {/* Title Section */}
            <Card className="bg-zinc-900 border border-zinc-800">
              <CardContent className="p-8 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                  Tutorial Library
                </h1>
                <p className="text-gray-400 text-lg">
                  Choose from our collection of interactive bass tutorials. Each
                  lesson includes advanced widgets, sheet music, fretboard
                  visualization, and personalized takeaways.
                </p>
                {isAdmin && (
                  <Button
                    onClick={() =>
                      navigateWithTransition('/admin/tutorials/new')
                    }
                    className="mt-4 bg-[#ffc700] text-black hover:bg-[#e6b300]"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    New Tutorial
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Loading State */}
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[#ffc700]" />
                <p className="text-gray-400">Loading tutorials...</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (isError || error) {
    return (
      <div className="min-h-screen">
        {/* Header with Logo */}
        <header className="w-full pt-8 sm:pt-12 pb-5 flex justify-center">
          <button
            onClick={() => navigateWithTransition('/')}
            className="cursor-pointer"
          >
            <Image
              src="/BASSICOLOGY BIG.png"
              alt="Bassicology"
              width={600}
              height={150}
              className="w-[180px] sm:w-[260px] md:w-[320px] lg:w-[400px] xl:w-[480px] h-auto"
              priority
            />
          </button>
        </header>

        {/* Navbar */}
        <HomeNavbar />

        <div className="mx-auto px-4 py-6 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
          <div className="space-y-6">
            {/* User Indicator and Navigation Controls */}
            <div className="flex justify-between items-center gap-3">
              {/* Back to Home button on the left */}
              <Button
                onClick={() => navigateWithTransition('/')}
                variant="ghost"
                size="sm"
                className="text-white/70 hover:text-white p-2"
                title="Back to Home"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>

              {/* User indicator on the right */}
              <div className="flex items-center gap-3">
                <UserIndicator />
              </div>
            </div>

            {/* Title Section */}
            <Card className="bg-zinc-900 border border-zinc-800">
              <CardContent className="p-8 text-center">
                <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                  Tutorial Library
                </h1>
                <p className="text-gray-400 text-lg">
                  Choose from our collection of interactive bass tutorials.
                </p>
                {isAdmin && (
                  <Button
                    onClick={() =>
                      navigateWithTransition('/admin/tutorials/new')
                    }
                    className="mt-4 bg-[#ffc700] text-black hover:bg-[#e6b300]"
                    size="sm"
                  >
                    <Plus className="w-4 h-4 mr-1" />
                    New Tutorial
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Error State */}
            <Card className="bg-red-900/20 border-red-500/30">
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
    <div className="min-h-screen">
      {/* Header with Logo */}
      <header className="w-full pt-8 sm:pt-12 pb-5 flex justify-center">
        <button
          onClick={() => navigateWithTransition('/')}
          className="cursor-pointer"
        >
          <Image
            src="/BASSICOLOGY BIG.png"
            alt="Bassicology"
            width={600}
            height={150}
            className="w-[180px] sm:w-[260px] md:w-[320px] lg:w-[400px] xl:w-[480px] h-auto"
            priority
          />
        </button>
      </header>

      {/* Navbar */}
      <HomeNavbar />

      {/* Main content */}
      <div className="mx-auto px-4 py-6 w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
        <div className="space-y-6">
          {/* User Indicator and Navigation Controls */}
          <div className="flex justify-between items-center gap-3">
            {/* Back to Home button on the left */}
            <Button
              onClick={() => navigateWithTransition('/')}
              variant="ghost"
              size="sm"
              className="text-white/70 hover:text-white p-2"
              title="Back to Home"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            {/* User indicator on the right */}
            <div className="flex items-center gap-3">
              <UserIndicator />
            </div>
          </div>

          {/* Title Section */}
          <Card className="bg-zinc-900 border border-zinc-800">
            <CardContent className="p-8 text-center">
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
                Tutorial Library
              </h1>
              <p className="text-gray-400 text-lg">
                Choose from our collection of interactive bass tutorials. Each
                lesson includes advanced widgets, sheet music, fretboard
                visualization, and personalized takeaways.
              </p>
              {total > 0 && (
                <p className="text-gray-500 text-sm mt-2">
                  {total} tutorial{total !== 1 ? 's' : ''} available
                </p>
              )}
              {isAdmin && (
                <Button
                  onClick={() => navigateWithTransition('/admin/tutorials/new')}
                  className="mt-4 bg-[#ffc700] text-black hover:bg-[#e6b300]"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  New Tutorial
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Tutorial Cards - Centered and scrollable */}
          {tutorials.length === 0 ? (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardContent className="p-8 text-center">
                <p className="text-gray-400">
                  No tutorials available at the moment.
                </p>
              </CardContent>
            </Card>
          ) : (
            tutorials.map((tutorial: TutorialSummary) => (
              <div
                key={tutorial.id}
                className="relative overflow-hidden rounded-3xl cursor-pointer group"
                onClick={() =>
                  navigateWithTransition(`/library/${tutorial.slug}`)
                }
              >
                {/* Background */}
                <div className="absolute inset-0 bg-zinc-900" />

                {/* Glow effect on hover */}
                <div className="absolute inset-0 bg-[#ffc700]/0 group-hover:bg-[#ffc700]/5 transition-all duration-500" />

                {/* Card border */}
                <div className="absolute inset-0 rounded-3xl border border-zinc-800 group-hover:border-[#ffc700]/50 transition-all duration-500" />

                {/* Container with no padding - full bleed layout - Fixed height 157.5px */}
                {console.log('[Library] Tutorial data:', {
                  title: tutorial.title,
                  thumbnail_url: tutorial.thumbnail_url,
                  youtube_id: tutorial.youtube_id,
                })}
                <div className="relative flex items-stretch h-[157.5px]">
                  {/* Left Side: Fixed 16:9 thumbnail with no padding */}
                  <div className="relative flex-shrink-0 w-[280px] overflow-hidden rounded-l-3xl">
                    <TutorialThumbnail
                      videoId={tutorial.youtube_id}
                      videoUrl={tutorial.youtube_url}
                      customThumbnailUrl={tutorial.thumbnail_url}
                      title={tutorial.title}
                      className="w-full h-full object-cover rounded-l-3xl"
                    />
                    {/* Thumbnail overlay gradient - blends to transparent on the right edge only */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent from-70% via-zinc-900/30 via-85% to-zinc-900/90" />
                  </div>

                  {/* Right Side: Content with 18px padding */}
                  <div className="flex-1 p-[18px] flex flex-col justify-between">
                    {/* Top Content: Title, Description */}
                    <div className="space-y-2">
                      <h3 className="text-2xl font-bold text-white leading-tight group-hover:text-[#ffc700] transition-colors duration-300">
                        {tutorial.title}
                      </h3>
                      {tutorial.description && (
                        <p className="text-gray-400 text-sm leading-relaxed line-clamp-2">
                          {tutorial.description}
                        </p>
                      )}
                    </div>

                    {/* Bottom Content: Badges */}
                    <div className="flex flex-wrap gap-2">
                      {tutorial.difficulty && (
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${getDifficultyColor(tutorial.difficulty)}`}
                        >
                          {capitalizeDifficulty(tutorial.difficulty)}
                        </span>
                      )}
                      {tutorial.duration && (
                        <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold bg-zinc-800 text-gray-300 border-zinc-700">
                          <Clock className="w-3 h-3 mr-1" />
                          {tutorial.duration}
                        </span>
                      )}
                      {tutorial.exercise_count > 0 && (
                        <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold bg-[#ffc700]/20 text-[#ffc700] border-[#ffc700]/30">
                          {tutorial.exercise_count} exercise
                          {tutorial.exercise_count !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* CTA Button - Fixed to Bottom Right - Arrow Only */}
                <button className="absolute bottom-[18px] right-[18px] w-10 h-7 rounded-lg border-2 border-zinc-700 bg-zinc-800 hover:bg-[#ffc700] hover:border-[#ffc700] text-white hover:text-black font-medium transition-all duration-300 group-hover:scale-110 flex items-center justify-center">
                  →
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function LibraryPage() {
  return (
    <PageErrorBoundary pageName="Tutorial Library">
      <LibraryPageContent />
    </PageErrorBoundary>
  );
}
