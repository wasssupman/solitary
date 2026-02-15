'use client';

import { useState, useEffect, useCallback } from 'react';
import { getGameBridge, type GameDisplayState } from '../game/bridge/GameBridge';

export function useGameState(bridgeId = 'default') {
  const [state, setState] = useState<GameDisplayState | null>(null);
  const [isWin, setIsWin] = useState(false);
  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const bridge = getGameBridge(bridgeId);
    const onState = (s: unknown) => {
      const gs = s as GameDisplayState;
      setState(gs);
      if (gs.isWin) setIsWin(true);
    };
    const onWin = () => setIsWin(true);
    bridge.on('stateChanged', onState);
    bridge.on('gameWon', onWin);

    const timer = setInterval(() => {
      if (!isWin) setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => {
      bridge.off('stateChanged', onState);
      bridge.off('gameWon', onWin);
      clearInterval(timer);
    };
  }, [isWin, startTime, bridgeId]);

  const newGame = useCallback((seed?: number) => {
    setIsWin(false);
    getGameBridge(bridgeId).emit('newGame', seed);
  }, [bridgeId]);

  const undo = useCallback(() => {
    getGameBridge(bridgeId).emit('undo');
  }, [bridgeId]);

  const foundationCount = state
    ? state.foundation.reduce((sum, pile) => sum + pile.length, 0)
    : 0;

  return {
    state,
    isWin,
    moveCount: state?.moveCount ?? 0,
    foundationCount,
    elapsed,
    newGame,
    undo,
  };
}
