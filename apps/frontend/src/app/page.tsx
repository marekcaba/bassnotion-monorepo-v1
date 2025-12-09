'use client';

import Image from 'next/image';
import { ResponsiveDebug } from '@/shared/components/ui/responsive-debug';
import { HomeNavbar } from './_components/HomeNavbar';
import { useViewTransitionRouter } from '@/lib/hooks/use-view-transition-router';

export default function HomePage() {
  const { navigateWithTransition } = useViewTransitionRouter();

  return (
    <>
      <main className="min-h-screen flex flex-col bg-black">
        {/* Add debug component for responsive testing */}
        <ResponsiveDebug showAlways={true} />

        {/* Header with Logo */}
        <header className="w-full pt-8 sm:pt-12 pb-5 flex justify-center">
          <button onClick={() => navigateWithTransition('/')} className="cursor-pointer">
            <Image
              src="/BASSICOLOGY BIG.png"
              alt="Bassicology"
              width={600}
              height={150}
              className="w-[220px] sm:w-[320px] md:w-[400px] lg:w-[500px] xl:w-[600px] h-auto"
              priority
            />
          </button>
        </header>

        {/* Navbar under logo */}
        <HomeNavbar />

        {/* Main content */}
        <div className="z-10 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="flex flex-col items-center text-center">
            <p className="text-base sm:text-lg lg:text-xl text-gray-400 max-w-md sm:max-w-lg">
              Your Bass Learning Platform
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
