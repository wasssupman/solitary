'use client';

import Link from 'next/link';

export default function HomeButton() {
  return (
    <Link
      href="/"
      className="absolute top-2 right-2 z-50 flex items-center justify-center w-8 h-8 rounded-full bg-zinc-800/80 text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors text-sm"
      title="Home"
    >
      &larr;
    </Link>
  );
}
