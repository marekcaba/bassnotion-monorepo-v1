'use client';

import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';
import { Clock, Star, User, ArrowLeft } from 'lucide-react';

interface Tutorial {
  id: string;
  title: string;
  artist: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  thumbnail: string;
  description: string;
  rating: number;
  concepts: string[];
}

const mockTutorials: Tutorial[] = [
  {
    id: 'never-gonna-give-you-up',
    title: 'Never Gonna Give You Up',
    artist: 'Rick Astley',
    difficulty: 'Intermediate',
    duration: '15 min',
    thumbnail: '🎵',
    description:
      'Learn modal interchange and tension & release concepts through this classic 80s hit.',
    rating: 4.8,
    concepts: ['Modal Interchange', 'Tension & Release', 'II-V-I Variations'],
  },
  {
    id: 'billie-jean',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    difficulty: 'Beginner',
    duration: '12 min',
    thumbnail: '🕺',
    description:
      'Master the iconic bassline with focus on rhythm and groove fundamentals.',
    rating: 4.9,
    concepts: ['Rhythm Fundamentals', 'Groove Patterns', 'Syncopation'],
  },
  {
    id: 'come-together',
    title: 'Come Together',
    artist: 'The Beatles',
    difficulty: 'Advanced',
    duration: '20 min',
    thumbnail: '🎸',
    description:
      'Explore complex rhythmic patterns and advanced bass techniques.',
    rating: 4.7,
    concepts: ['Complex Rhythms', 'Chromatic Runs', 'Advanced Techniques'],
  },
  {
    id: 'another-one-bites-dust',
    title: 'Another One Bites the Dust',
    artist: 'Queen',
    difficulty: 'Intermediate',
    duration: '18 min',
    thumbnail: '👑',
    description:
      'Learn the legendary bassline focusing on precision and timing.',
    rating: 4.8,
    concepts: ['Precision Playing', 'Timing', 'Rock Fundamentals'],
  },
];

const getDifficultyColor = (difficulty: string) => {
  switch (difficulty) {
    case 'Beginner':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'Intermediate':
      return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'Advanced':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  }
};

export default function LibraryPage() {
  const { navigateWithTransition } = useViewTransitionRouter();

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
              </CardContent>
            </Card>
          </div>

          {/* Tutorial Cards - Centered and scrollable */}
          {mockTutorials.map((tutorial) => (
            <Card
              key={tutorial.id}
              className="bg-white/5 backdrop-blur-md border-white/10 hover:bg-white/10 transition-all duration-300 cursor-pointer group hover:scale-[1.02] hover:shadow-2xl"
              onClick={() => navigateWithTransition(`/library/${tutorial.id}`)}
            >
              <CardHeader className="pb-4">
                {/* Thumbnail and Title Section */}
                <div className="flex items-start gap-4">
                  {/* Thumbnail */}
                  <div className="w-20 h-20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl flex items-center justify-center group-hover:from-purple-500/30 group-hover:to-pink-500/30 transition-all duration-300 flex-shrink-0">
                    <span className="text-3xl">{tutorial.thumbnail}</span>
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
                        {tutorial.difficulty}
                      </span>
                      <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold bg-white/10 text-white/80 border-white/20">
                        <Clock className="w-3 h-3 mr-1" />
                        {tutorial.duration}
                      </span>
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                        <span className="text-white/80 text-sm font-medium">
                          {tutorial.rating}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Description */}
                <p className="text-white/70 text-sm leading-relaxed">
                  {tutorial.description}
                </p>

                {/* Concepts */}
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

                {/* Call to Action */}
                <div className="pt-2">
                  <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-3 text-center group-hover:from-purple-500/30 group-hover:to-pink-500/30 transition-all duration-300">
                    <span className="text-white/90 text-sm font-medium">
                      Tap to start learning →
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Footer Card */}
          <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl">
            <CardContent className="p-6 text-center">
              <p className="text-white/50 text-sm">
                // TODO: Review non-null assertion - consider null safety More
                tutorials coming soon! Each lesson is crafted with advanced
                interactive features.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
