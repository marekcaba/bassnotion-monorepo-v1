'use client';

import { Check } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { cn } from '@/lib/utils';

interface PricingCardProps {
  name: string;
  description: string;
  price: number;
  currency?: string;
  interval?: string;
  features: string[];
  isPopular?: boolean;
  isPurchased?: boolean;
  isLoading?: boolean;
  buttonText?: string;
  onPurchase: () => void;
}

export function PricingCard({
  name,
  description,
  price,
  currency = 'usd',
  interval,
  features,
  isPopular = false,
  isPurchased = false,
  isLoading = false,
  buttonText = 'Get Started',
  onPurchase,
}: PricingCardProps) {
  const currencySymbol = currency === 'usd' ? '$' : currency.toUpperCase();

  return (
    <div
      className={cn(
        'relative rounded-xl border p-6 flex flex-col',
        isPopular
          ? 'border-[#ffc700] bg-zinc-900/80 shadow-lg shadow-[#ffc700]/10'
          : 'border-zinc-700 bg-zinc-900/50',
        isPurchased && 'border-green-500/50',
      )}
    >
      {/* Popular Badge */}
      {isPopular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-[#ffc700] text-black text-xs font-semibold px-3 py-1 rounded-full">
            Most Popular
          </span>
        </div>
      )}

      {/* Purchased Badge */}
      {isPurchased && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-green-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
            Purchased
          </span>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <h3 className="text-xl font-bold text-white">{name}</h3>
        <p className="text-sm text-gray-400 mt-1">{description}</p>
      </div>

      {/* Price */}
      <div className="mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-4xl font-bold text-white">
            {currencySymbol}
            {price}
          </span>
          {interval && (
            <span className="text-gray-400 text-sm">/{interval}</span>
          )}
        </div>
        {!interval && (
          <span className="text-gray-400 text-sm">one-time payment</span>
        )}
      </div>

      {/* Features */}
      <ul className="space-y-3 mb-6 flex-grow">
        {features.map((feature, index) => (
          <li key={index} className="flex items-start gap-2">
            <Check className="h-5 w-5 text-[#ffc700] flex-shrink-0 mt-0.5" />
            <span className="text-sm text-gray-300">{feature}</span>
          </li>
        ))}
      </ul>

      {/* CTA Button */}
      <Button
        onClick={onPurchase}
        disabled={isPurchased || isLoading}
        className={cn(
          'w-full',
          isPopular
            ? 'bg-[#ffc700] text-black hover:bg-[#e6b300]'
            : 'bg-zinc-700 text-white hover:bg-zinc-600',
          isPurchased && 'bg-green-600 hover:bg-green-600 cursor-default',
        )}
      >
        {isLoading ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-current"></span>
            Processing...
          </span>
        ) : isPurchased ? (
          'Already Purchased'
        ) : (
          buttonText
        )}
      </Button>
    </div>
  );
}
