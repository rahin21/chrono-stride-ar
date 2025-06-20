'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the AR scene component to avoid SSR issues
const ArScene = dynamic(() => import('@/components/ArScene'), {
  ssr: false,
});

export default function Home() {
  const [isCameraFlipped, setIsCameraFlipped] = useState(false);

  return (
    <main className="relative w-full h-screen">
      <ArScene isCameraFlipped={isCameraFlipped} />
      <button
        onClick={() => setIsCameraFlipped(!isCameraFlipped)}
        className="absolute bottom-4 right-4 bg-white/80 hover:bg-white text-black px-4 py-2 rounded-full shadow-lg z-10"
      >
        {isCameraFlipped ? 'Front Camera' : 'Back Camera'}
      </button>
    </main>
  );
}
