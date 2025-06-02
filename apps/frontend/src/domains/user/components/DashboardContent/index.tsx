'use client';

import { useState } from 'react';
import { useAutoAnimate } from '@formkit/auto-animate/react';
import { Plus, X } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';

interface DashboardCard {
  id: string;
  title: string;
  content: string;
  color: string;
  buttonText?: string;
  disabled?: boolean;
}

const initialCards: DashboardCard[] = [
  {
    id: '1',
    title: 'Bass Exercises',
    content: 'Practice with interactive bass exercises',
    color: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900',
    buttonText: 'Coming Soon',
    disabled: true,
  },
  {
    id: '2',
    title: 'Learning Progress',
    content: 'Track your bass learning journey',
    color: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900',
    buttonText: 'Coming Soon',
    disabled: true,
  },
  {
    id: '3',
    title: 'Community',
    content: 'Connect with other bass players',
    color: 'bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900',
    buttonText: 'Coming Soon',
    disabled: true,
  },
];

const extraCards: DashboardCard[] = [
  {
    id: '4',
    title: 'Practice Streak',
    content: '3 days in a row! Keep it up!',
    color: 'bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-900',
  },
  {
    id: '5',
    title: 'Weekly Goal',
    content: '2/5 sessions completed this week',
    color: 'bg-pink-50 border-pink-200 dark:bg-pink-950/30 dark:border-pink-900',
  },
  {
    id: '6',
    title: 'Achievements',
    content: '🎸 First Song Completed!',
    color: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-900',
  },
];

export function DashboardContent() {
  const [cards, setCards] = useState<DashboardCard[]>(initialCards);
  const [gridRef] = useAutoAnimate();

  const addRandomCard = () => {
    const availableCards = extraCards.filter(
      extraCard => !cards.find(card => card.id === extraCard.id)
    );
    
    if (availableCards.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableCards.length);
      const randomCard = availableCards[randomIndex];
      if (randomCard) {
        setCards(prev => [...prev, randomCard]);
      }
    }
  };

  const removeCard = (id: string) => {
    setCards(prev => prev.filter(card => card.id !== id));
  };

  const shuffleCards = () => {
    setCards(prev => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const temp = shuffled[i]!;
        shuffled[i] = shuffled[j]!;
        shuffled[j] = temp;
      }
      return shuffled;
    });
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={addRandomCard}
          variant="outline"
          size="sm"
          disabled={cards.length >= initialCards.length + extraCards.length}
          className="text-green-600 border-green-300 hover:bg-green-50"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Card
        </Button>
        <Button
          onClick={shuffleCards}
          variant="outline"
          size="sm"
          disabled={cards.length <= 1}
          className="text-blue-600 border-blue-300 hover:bg-blue-50"
        >
          🔀 Shuffle
        </Button>
        <p className="text-sm text-muted-foreground self-center">
          Try adding/removing cards to see AutoAnimate in action!
        </p>
      </div>

      {/* Animated Grid */}
      <div 
        ref={gridRef}
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-3"
      >
        {cards.map((card) => (
          <Card key={card.id} className={`relative ${card.color} transition-all duration-200 hover:shadow-lg`}>
            <CardHeader className="relative">
              <CardTitle className="pr-8">{card.title}</CardTitle>
              {cards.length > 3 && (
                <Button
                  onClick={() => removeCard(card.id)}
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 h-6 w-6 p-0 text-gray-500 hover:text-red-500 hover:bg-red-50"
                >
                  <X className="h-3 w-3" />
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">{card.content}</p>
              {card.buttonText && (
                <Button 
                  size="sm" 
                  disabled={card.disabled} 
                  className="w-full sm:w-auto"
                >
                  {card.buttonText}
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {cards.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <p>No cards available. Add some cards to see AutoAnimate in action!</p>
        </div>
      )}
    </div>
  );
}
