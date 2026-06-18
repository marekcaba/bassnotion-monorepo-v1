'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ShoppingBag } from 'lucide-react';

import { PageErrorBoundary } from '@/shared/components/ErrorBoundary';
import { useToast } from '@/shared/hooks/use-toast';
import { useStoreProducts } from '@/domains/billing/hooks/useStore';
import { useUserAccess } from '@/domains/billing/hooks/useBilling';
import { storeApi, StoreProduct } from '@/domains/billing/api/store.api';
import { StoreProductCard } from '@/domains/billing/components/StoreProductCard';

function StoreContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { data: products, isLoading, error } = useStoreProducts();
  const { data: access, refetch: refetchAccess } = useUserAccess();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Post-checkout: ?success / ?canceled (Stripe returns here).
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast({
        title: 'Purchase complete',
        description: 'Your purchase is being activated…',
        variant: 'success',
      });
      refetchAccess();
      window.history.replaceState({}, '', '/store');
    } else if (searchParams.get('canceled') === 'true') {
      toast({ title: 'Checkout canceled', variant: 'default' });
      window.history.replaceState({}, '', '/store');
    }
  }, [searchParams, toast, refetchAccess]);

  const ownedProductIds = new Set(access?.purchasedProductIds ?? []);
  const hasMembership = access?.hasActiveSubscription ?? false;

  const isOwned = (p: StoreProduct) =>
    p.type === 'membership' ? hasMembership : ownedProductIds.has(p.id);

  // `purchasable` is computed server-side (membership, or a pack with a Stripe
  // price). Packs without a price render "Coming soon".
  const isBuyable = (p: StoreProduct) => p.purchasable;

  const handleBuy = async (p: StoreProduct) => {
    setLoadingId(p.id);
    try {
      // Build URLs here (click is client-only; avoids `window` at SSR).
      // Clean URLs: the host-rewrite middleware maps /store → /app/store.
      const origin = window.location.origin;
      const successUrl = `${origin}/store?success=true`;
      const cancelUrl = `${origin}/store?canceled=true`;
      const url =
        p.type === 'membership'
          ? await storeApi.checkoutMembership(successUrl, cancelUrl)
          : await storeApi.checkoutProduct(p.id, successUrl, cancelUrl);
      window.location.href = url;
    } catch (e) {
      toast({
        title: 'Checkout failed',
        description: e instanceof Error ? e.message : 'Please try again.',
        variant: 'destructive',
      });
      setLoadingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6 md:p-10">
      <header className="mb-8 flex items-center gap-3">
        <ShoppingBag className="size-8 text-[#E8A44A]" />
        <div>
          <h1 className="text-2xl font-bold text-white">Store</h1>
          <p className="mt-1 text-sm text-white/50">
            Membership, Groove Packs, and more.
          </p>
        </div>
      </header>

      {isLoading && (
        <div className="flex justify-center py-16">
          <div className="size-8 animate-spin rounded-full border-b-2 border-[#E8A44A]" />
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-sm text-red-300">
          Couldn’t load the store. Please refresh.
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(products ?? []).map((p) => (
            <StoreProductCard
              key={p.id}
              product={p}
              owned={isOwned(p)}
              buyable={isBuyable(p)}
              isLoading={loadingId === p.id}
              onBuy={() => handleBuy(p)}
              onOpen={() => router.push(`/store/${p.slug}`)}
            />
          ))}
          {(products ?? []).length === 0 && (
            <p className="text-sm text-white/40">No products available yet.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function StorePage() {
  return (
    <>
      <PageErrorBoundary pageName="Store">
        {/* Suspense required: StoreContent uses useSearchParams() (?success/
            ?canceled), which forces CSR bailout and fails the prod prerender
            without a boundary. */}
        <Suspense
          fallback={
            <div className="flex justify-center py-16">
              <div className="size-8 animate-spin rounded-full border-b-2 border-[#E8A44A]" />
            </div>
          }
        >
          <StoreContent />
        </Suspense>
      </PageErrorBoundary>
    </>
  );
}
