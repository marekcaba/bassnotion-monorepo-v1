'use client';

/**
 * My Favorites Card
 *
 * Dashboard card displaying user's favorited exercises with navigation.
 */

import { Star, Loader2, Music, ArrowRight, Heart } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { useUserFavorites } from '@/domains/social/hooks/useFavorites';
import { useAuth } from '@/domains/user/hooks/use-auth';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

interface FavoriteItemProps {
  title: string;
  exerciseId: string;
  difficulty?: number;
  likeCount?: number;
  tutorialSlug?: string;
  onNavigate: (path: string) => void;
}

function FavoriteItem({
  title,
  exerciseId,
  difficulty,
  likeCount,
  tutorialSlug,
  onNavigate,
}: FavoriteItemProps) {
  const getDifficultyLabel = (level?: number) => {
    if (!level) return null;
    if (level <= 3) return { label: 'Beginner', color: 'text-green-400' };
    if (level <= 6) return { label: 'Intermediate', color: 'text-orange-400' };
    return { label: 'Advanced', color: 'text-red-400' };
  };

  const difficultyInfo = getDifficultyLabel(difficulty);
  // Include exerciseId as query param so the tutorial page pre-selects the exercise
  const targetPath = tutorialSlug
    ? `/library/${tutorialSlug}?exerciseId=${exerciseId}`
    : '/library';

  return (
    <button
      onClick={() => onNavigate(targetPath)}
      className="w-full flex items-center gap-3 p-3 rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 transition-colors text-left group"
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
        <Music className="w-5 h-5 text-amber-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate group-hover:text-amber-400 transition-colors">
          {title}
        </p>
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          {difficultyInfo && (
            <span className={difficultyInfo.color}>{difficultyInfo.label}</span>
          )}
          {likeCount !== undefined && likeCount > 0 && (
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {likeCount}
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-amber-400 transition-colors flex-shrink-0" />
    </button>
  );
}

export function MyFavoritesCard() {
  const { isAuthenticated } = useAuth();
  const { navigateWithTransition } = useViewTransitionRouter();
  const { data, isLoading, isError } = useUserFavorites(1, 5);

  if (!isAuthenticated) {
    return (
      <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            My Favorites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Sign in to save and access your favorite exercises.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigateWithTransition('/login')}
          >
            Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            My Favorites
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
        </CardContent>
      </Card>
    );
  }

  if (isError) {
    return (
      <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            My Favorites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Unable to load favorites. Please try again later.
          </p>
        </CardContent>
      </Card>
    );
  }

  const favorites = data?.favorites || [];
  const total = data?.total || 0;

  if (favorites.length === 0) {
    return (
      <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            My Favorites
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            You haven&apos;t saved any favorites yet. Browse the library and
            click the star on exercises you want to practice later.
          </p>
          <Button
            size="sm"
            onClick={() => navigateWithTransition('/library')}
            className="bg-amber-500 hover:bg-amber-600 text-black"
          >
            Browse Library
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            My Favorites
          </CardTitle>
          {total > 5 && (
            <span className="text-xs text-muted-foreground">{total} total</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {favorites.map((favorite) => (
          <FavoriteItem
            key={favorite.id}
            exerciseId={favorite.exercise_id}
            title={favorite.exercise?.title || 'Untitled Exercise'}
            difficulty={favorite.exercise?.difficulty}
            likeCount={favorite.exercise?.like_count}
            tutorialSlug={favorite.exercise?.tutorial_slug}
            onNavigate={navigateWithTransition}
          />
        ))}

        {total > 5 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 text-amber-600 hover:text-amber-700 hover:bg-amber-100/50"
            onClick={() => navigateWithTransition('/library')}
          >
            View All Favorites
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
