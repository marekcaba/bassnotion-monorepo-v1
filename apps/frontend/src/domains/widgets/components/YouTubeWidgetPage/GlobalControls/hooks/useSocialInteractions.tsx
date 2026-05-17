'use client';

/**
 * useSocialInteractions Hook
 *
 * Manages social interaction state for exercises including:
 * - Like/unlike functionality
 * - Favorite/unfavorite functionality
 * - Sparkle animations for button feedback
 *
 * @example
 * const { isLiked, handleLikeClick, likeSparkles } = useSocialInteractions({
 *   exerciseId: 'exercise-123',
 *   isAuthenticated: true,
 *   isAuthReady: true,
 * });
 */

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useLikeStatus, useToggleLike } from '@/domains/social/hooks/useLikes';
import {
  useFavoriteStatus,
  useToggleFavorite,
} from '@/domains/social/hooks/useFavorites';
import { toast } from '@/shared/hooks/use-toast';
import { ToastAction } from '@/shared/components/ui/toast';
import type { SparkleParticle } from '../types.js';

/**
 * Options for the useSocialInteractions hook
 */
export interface UseSocialInteractionsOptions {
  /** Exercise ID for social actions */
  exerciseId: string;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether auth state has been determined */
  isAuthReady: boolean;
}

/**
 * Return type for the useSocialInteractions hook
 */
export interface UseSocialInteractionsReturn {
  // Like state
  /** Whether the current user has liked the exercise */
  isLiked: boolean;
  /** Total like count for the exercise */
  likeCount: number;
  /** Whether like mutation is pending */
  isLikePending: boolean;
  /** Active sparkle particles for like animation */
  likeSparkles: SparkleParticle[];

  // Favorite state
  /** Whether the current user has favorited the exercise */
  isFavorited: boolean;
  /** Whether favorite mutation is pending */
  isFavoritePending: boolean;
  /** Active sparkle particles for favorite animation */
  favoriteSparkles: SparkleParticle[];

  // Loop state (UI only - coming soon feature)
  /** Active sparkle particles for loop animation */
  loopSparkles: SparkleParticle[];
  /** Whether loop mode is toggled */
  isLooped: boolean;
  /** Bump state for loop button animation */
  loopBump: boolean;

  // Comment state (UI only - coming soon feature)
  /** Active sparkle particles for comment animation */
  commentSparkles: SparkleParticle[];
  /** Whether comment mode is toggled */
  isCommented: boolean;
  /** Bump state for comment button animation */
  commentBump: boolean;

  // Handlers
  /** Handler for like button click */
  handleLikeClick: () => void;
  /** Handler for favorite button click */
  handleFavoriteClick: () => void;
  /** Handler for loop button click */
  handleLoopClick: () => void;
  /** Handler for comment button click */
  handleCommentClick: () => void;
  /** Handler for loop button mouse leave */
  handleLoopMouseLeave: () => void;
  /** Handler for comment button mouse leave */
  handleCommentMouseLeave: () => void;
}

/**
 * Generates sparkle particles for button animations
 * @param rotationRange - Range of rotation in degrees
 * @returns Array of sparkle particles
 */
const generateSparkles = (rotationRange: number): SparkleParticle[] => {
  return Array.from({ length: 6 }, (_, i) => {
    // 12 o'clock = -90° (up), 3 o'clock = 0° (right) in standard coords
    // Spread 90° from -90° to 0°
    const angle =
      (-90 + (i * 90) / 5 + (Math.random() * 15 - 7.5)) * (Math.PI / 180);
    const distance = 18 + Math.random() * 12;
    return {
      id: Date.now() + i,
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance,
      scale: 0.7 + Math.random() * 0.5,
      rotation: Math.random() * rotationRange - rotationRange / 2,
    };
  });
};

/**
 * Hook for managing social interactions on exercises
 */
export function useSocialInteractions(
  options: UseSocialInteractionsOptions,
): UseSocialInteractionsReturn {
  const { exerciseId, isAuthenticated, isAuthReady } = options;
  const router = useRouter();

  // API hooks for like/favorite
  const { data: likeStatus } = useLikeStatus(exerciseId);
  const { data: favoriteStatus } = useFavoriteStatus(exerciseId);
  const toggleLikeMutation = useToggleLike(exerciseId);
  const toggleFavoriteMutation = useToggleFavorite(exerciseId);

  // Derive state from API
  const isLiked = likeStatus?.is_liked ?? false;
  const likeCount = likeStatus?.like_count ?? 0;
  const isFavorited = favoriteStatus?.is_favorited ?? false;

  // Sparkle animation states
  const [likeSparkles, setLikeSparkles] = useState<SparkleParticle[]>([]);
  const [favoriteSparkles, setFavoriteSparkles] = useState<SparkleParticle[]>(
    [],
  );
  const [loopSparkles, setLoopSparkles] = useState<SparkleParticle[]>([]);
  const [commentSparkles, setCommentSparkles] = useState<SparkleParticle[]>([]);

  // Toggle states for loop and comment (UI only - coming soon features)
  const [isLooped, setIsLooped] = useState(false);
  const [isCommented, setIsCommented] = useState(false);

  // Bump states to temporarily disable hover effect after toggling off
  const [loopBump, setLoopBump] = useState(false);
  const [commentBump, setCommentBump] = useState(false);

  // Helper to show auth required toast
  const showAuthRequiredToast = useCallback(() => {
    toast({
      title: 'Sign in required',
      description: 'You need to be signed in to use this feature.',
      action: (
        <ToastAction
          altText="Sign up"
          onClick={() => router.push('/auth/signup')}
        >
          Sign up
        </ToastAction>
      ),
    });
  }, [router]);

  // Handle like button click with sparkle animation
  const handleLikeClick = useCallback(() => {
    // Check if no exercise selected
    if (!exerciseId) {
      toast({
        title: 'No exercise selected',
        description: 'Please select an exercise first.',
        variant: 'destructive',
      });
      return;
    }

    // Check authentication
    if (isAuthReady && !isAuthenticated) {
      showAuthRequiredToast();
      return;
    }

    // Prevent double-clicks during mutation
    if (toggleLikeMutation.isPending) return;

    // Only show sparkles when activating (going from false to true)
    if (!isLiked) {
      const sparkles = generateSparkles(40);
      setLikeSparkles(sparkles);
      setTimeout(() => setLikeSparkles([]), 600);
    }

    // Call API
    toggleLikeMutation.mutate();
  }, [
    exerciseId,
    isAuthReady,
    isAuthenticated,
    showAuthRequiredToast,
    toggleLikeMutation,
    isLiked,
  ]);

  // Handle favorite button click with sparkle animation
  const handleFavoriteClick = useCallback(() => {
    // Check if no exercise selected
    if (!exerciseId) {
      toast({
        title: 'No exercise selected',
        description: 'Please select an exercise first.',
        variant: 'destructive',
      });
      return;
    }

    // Check authentication
    if (isAuthReady && !isAuthenticated) {
      showAuthRequiredToast();
      return;
    }

    // Prevent double-clicks during mutation
    if (toggleFavoriteMutation.isPending) return;

    // Only show sparkles when activating (going from false to true)
    if (!isFavorited) {
      const sparkles = generateSparkles(60);
      setFavoriteSparkles(sparkles);
      setTimeout(() => setFavoriteSparkles([]), 600);
    }

    // Call API
    toggleFavoriteMutation.mutate();
  }, [
    exerciseId,
    isAuthReady,
    isAuthenticated,
    showAuthRequiredToast,
    toggleFavoriteMutation,
    isFavorited,
  ]);

  // Handle loop button click (coming soon)
  const handleLoopClick = useCallback(() => {
    if (!isLooped) {
      const sparkles = generateSparkles(90);
      setLoopSparkles(sparkles);
      setTimeout(() => setLoopSparkles([]), 600);
    } else {
      // Toggling off - set bump to force raised state
      setLoopBump(true);
    }
    setIsLooped(!isLooped);
    toast({
      title: 'Loop mode coming soon!',
      description: "You'll be able to loop exercises for focused practice.",
    });
  }, [isLooped]);

  // Handle comment button click (coming soon)
  const handleCommentClick = useCallback(() => {
    if (!isCommented) {
      const sparkles = generateSparkles(90);
      setCommentSparkles(sparkles);
      setTimeout(() => setCommentSparkles([]), 600);
    } else {
      // Toggling off - set bump to force raised state
      setCommentBump(true);
    }
    setIsCommented(!isCommented);
    toast({
      title: 'Comments coming soon!',
      description: "You'll be able to discuss exercises with other musicians.",
    });
  }, [isCommented]);

  // Mouse leave handlers for bump reset
  const handleLoopMouseLeave = useCallback(() => {
    setLoopBump(false);
  }, []);

  const handleCommentMouseLeave = useCallback(() => {
    setCommentBump(false);
  }, []);

  return useMemo(
    () => ({
      // Like state
      isLiked,
      likeCount,
      isLikePending: toggleLikeMutation.isPending,
      likeSparkles,

      // Favorite state
      isFavorited,
      isFavoritePending: toggleFavoriteMutation.isPending,
      favoriteSparkles,

      // Loop state
      loopSparkles,
      isLooped,
      loopBump,

      // Comment state
      commentSparkles,
      isCommented,
      commentBump,

      // Handlers
      handleLikeClick,
      handleFavoriteClick,
      handleLoopClick,
      handleCommentClick,
      handleLoopMouseLeave,
      handleCommentMouseLeave,
    }),
    [
      isLiked,
      likeCount,
      toggleLikeMutation.isPending,
      likeSparkles,
      isFavorited,
      toggleFavoriteMutation.isPending,
      favoriteSparkles,
      loopSparkles,
      isLooped,
      loopBump,
      commentSparkles,
      isCommented,
      commentBump,
      handleLikeClick,
      handleFavoriteClick,
      handleLoopClick,
      handleCommentClick,
      handleLoopMouseLeave,
      handleCommentMouseLeave,
    ],
  );
}
