'use client';

import { Check, Lock } from 'lucide-react';

import type { StoreProduct } from '@/domains/billing/api/store.api';

interface StoreProductCardProps {
  product: StoreProduct;
  owned: boolean;
  /** A pack with no Stripe price yet can be shown but not bought. */
  buyable: boolean;
  isLoading?: boolean;
  onBuy: () => void;
  onOpen?: () => void;
}

/**
 * Store product card in the in-app amber voice (#E8A44A / #100E0D), matching the
 * /app instrument surfaces (UpgradePitch, welcome). Distinct from the older
 * /pricing PricingCard (#ffc700).
 */
export function StoreProductCard({
  product,
  owned,
  buyable,
  isLoading = false,
  onBuy,
  onOpen,
}: StoreProductCardProps) {
  const isMembership = product.type === 'membership';
  const interval = isMembership ? 'mo' : undefined;

  return (
    <div
      className={[
        'relative flex flex-col overflow-hidden rounded-2xl border bg-[#15110d] transition-colors',
        owned ? 'border-emerald-500/40' : 'border-white/10 hover:border-[#E8A44A]/50',
      ].join(' ')}
    >
      {/* Cover */}
      {product.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.coverImageUrl}
          alt={product.name}
          className="h-40 w-full object-cover"
        />
      ) : (
        <div className="flex h-40 w-full items-center justify-center bg-gradient-to-br from-[#2a2118] to-[#15110d]">
          <span className="font-mono text-xs uppercase tracking-widest text-[#E8A44A]/60">
            {product.type.replace('_', ' ')}
          </span>
        </div>
      )}

      {/* Badge */}
      {(product.badge || owned) && (
        <div className="absolute right-3 top-3">
          <span
            className={[
              'rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider',
              owned
                ? 'bg-emerald-500 text-black'
                : 'bg-[#E8A44A] text-black',
            ].join(' ')}
          >
            {owned ? 'Owned' : product.badge}
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-semibold text-white">{product.name}</h3>
        {product.tagline && (
          <p className="mt-1 text-sm text-white/50">{product.tagline}</p>
        )}

        {/* Price */}
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white">${product.price}</span>
          {interval ? (
            <span className="text-sm text-white/40">/{interval}</span>
          ) : (
            <span className="text-sm text-white/40">one-time</span>
          )}
        </div>

        {/* Features */}
        {product.features.length > 0 && (
          <ul className="mt-4 space-y-2">
            {product.features.slice(0, 5).map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-white/70">
                <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E8A44A]" />
                {f}
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-5">
          {owned ? (
            <button
              type="button"
              disabled
              className="w-full cursor-default rounded-lg bg-emerald-600/20 py-2.5 text-sm font-semibold text-emerald-400"
            >
              {isMembership ? 'Active member' : 'Owned'}
            </button>
          ) : !buyable ? (
            <button
              type="button"
              disabled
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 py-2.5 text-sm font-semibold text-white/40"
            >
              <Lock className="h-4 w-4" /> Coming soon
            </button>
          ) : (
            <button
              type="button"
              onClick={onBuy}
              disabled={isLoading}
              className="w-full rounded-lg bg-[#E8A44A] py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {isLoading
                ? 'Starting…'
                : isMembership
                  ? 'Become a member'
                  : 'Buy pack'}
            </button>
          )}
          {onOpen && !isMembership && (
            <button
              type="button"
              onClick={onOpen}
              className="mt-2 w-full text-center text-xs text-white/40 hover:text-white/70"
            >
              View details →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
