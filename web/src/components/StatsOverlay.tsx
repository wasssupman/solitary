'use client';

import { useGameState } from '../hooks/useGameState';

export default function StatsOverlay() {
  const { foundationCount, moveCount } = useGameState();
  return (
    <div className="absolute top-2 right-2 bg-black/60 rounded px-3 py-2 text-xs text-zinc-300 font-mono z-10">
      <div>Foundation: {foundationCount}/52</div>
      <div>Moves: {moveCount}</div>
    </div>
  );
}
