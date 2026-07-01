'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Check, Music, Lock } from 'lucide-react';

import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { useToast } from '@/shared/hooks/use-toast';
import { useStoreProduct } from '@/domains/billing/hooks/useStore';
import { useUserAccess } from '@/domains/billing/hooks/useBilling';
import { storeApi } from '@/domains/billing/api/store.api';

function PackDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const slug = typeof params.slug === 'string' ? params.slug : undefined;

  const { data, isLoading, error } = useStoreProduct(slug);
  const { data: access } = useUserAccess();
  const [buying, setBuying] = useState(false);

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <div className="size-8 animate-spin rounded-full border-b-2 border-[#E8A44A]" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-3xl p-6">
        <button
          onClick={() => router.push('/store')}
          className="mb-4 flex items-center gap-1 text-sm text-white/50 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" /> Back to store
        </button>
        <p className="text-sm text-red-300">This product could not be found.</p>
      </div>
    );
  }

  const { product, contents } = data;
  const isMembership = product.type === 'membership';
  const owned = isMembership
    ? (access?.hasActiveSubscription ?? false)
    : (access?.purchasedProductIds ?? []).includes(product.id);
  const buyable = product.purchasable;
  const grooveCount = contents.filter((c) => c.contentType === 'groove').length;

  const handleBuy = async () => {
    setBuying(true);
    try {
      // Clean URLs: the host-rewrite middleware maps /store → /app/store.
      const origin = window.location.origin;
      const successUrl = `${origin}/store?success=true`;
      const cancelUrl = `${origin}/store/${product.slug}?canceled=true`;
      // Membership is a subscription; packs are one-time purchases.
      const url = isMembership
        ? await storeApi.checkoutMembership(successUrl, cancelUrl)
        : await storeApi.checkoutProduct(product.id, successUrl, cancelUrl);
      window.location.href = url;
    } catch (e) {
      toast({
        title: 'Checkout failed',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
      setBuying(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl p-6 md:p-10">
      <button
        onClick={() => router.push('/store')}
        className="mb-6 flex items-center gap-1 text-sm text-white/50 hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to store
      </button>

      {/* Cover */}
      {product.coverImageUrl ? (
        <img
          src={product.coverImageUrl}
          alt={product.name}
          className="mb-6 h-56 w-full rounded-2xl object-cover"
        />
      ) : (
        <div className="mb-6 flex h-56 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-[#2a2118] to-[#15110d]">
          <Music className="h-12 w-12 text-[#E8A44A]/40" />
        </div>
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">{product.name}</h1>
          {product.tagline && (
            <p className="mt-1 text-white/50">{product.tagline}</p>
          )}
        </div>
        {owned && (
          <span className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-semibold text-black">
            Owned
          </span>
        )}
      </div>

      {product.description && (
        <p className="mt-4 text-sm leading-relaxed text-white/70">
          {product.description}
        </p>
      )}

      {/* Features */}
      {product.features.length > 0 && (
        <ul className="mt-6 space-y-2">
          {product.features.map((f, i) => (
            <li
              key={i}
              className="flex items-start gap-2 text-sm text-white/80"
            >
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#E8A44A]" />
              {f}
            </li>
          ))}
        </ul>
      )}

      {/* What's inside — packs bundle specific content; membership unlocks the
          whole library, so its value is the features list above, not a content
          manifest. Hide this section for membership. */}
      {!isMembership && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#15110d] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-white/50">
            What’s inside
          </h2>
          {contents.length === 0 ? (
            <p className="mt-3 text-sm text-white/40">
              Content for this pack is being added.
            </p>
          ) : (
            <>
              <p className="mt-2 text-sm text-white/70">
                {grooveCount} groove{grooveCount === 1 ? '' : 's'}
                {contents.length > grooveCount
                  ? ` + ${contents.length - grooveCount} more`
                  : ''}
              </p>
              <ul className="mt-3 space-y-1.5">
                {contents.map((c, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-white/60"
                  >
                    <Music className="h-3.5 w-3.5 text-[#E8A44A]/60" />
                    {c.note ||
                      `${c.contentType}${c.unlockDay ? ` · day ${c.unlockDay}` : ''}`}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {/* Buy */}
      <div className="mt-8 flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#15110d] p-5">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-white">
            ${product.price}
          </span>
          <span className="text-sm text-white/40">
            {isMembership ? '/month' : 'one-time'}
          </span>
        </div>
        {owned ? (
          <span className="rounded-lg bg-emerald-600/20 px-6 py-2.5 text-sm font-semibold text-emerald-400">
            {isMembership ? 'Active member' : 'Owned'}
          </span>
        ) : !buyable ? (
          <span className="flex items-center gap-2 rounded-lg bg-white/5 px-6 py-2.5 text-sm font-semibold text-white/40">
            <Lock className="h-4 w-4" /> Coming soon
          </span>
        ) : (
          <button
            onClick={handleBuy}
            disabled={buying}
            className="rounded-lg bg-[#E8A44A] px-6 py-2.5 text-sm font-semibold text-black transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {buying
              ? 'Starting…'
              : isMembership
                ? 'Become a member'
                : 'Buy pack'}
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The pack-detail CLIENT tree. Split out of page.tsx (now a server component that prefetches the
 * product by slug) so useStoreProduct hydrates from cache — no full-page spinner. The slug is read
 * client-side via useParams (unchanged); the server seeds the same ['store','product',slug] key.
 */
export function PackDetailPageClient() {
  return (
    <>
      <PageErrorBoundary pageName="Pack Detail">
        <PackDetailContent />
      </PageErrorBoundary>
    </>
  );
}
