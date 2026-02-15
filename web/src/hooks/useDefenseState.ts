'use client';

import { useState, useEffect, useCallback } from 'react';
import { getGameBridge } from '../game/bridge/GameBridge';
import type { DefenseDisplayState } from '../game/defense/DefenseState';

export function useDefenseState(bridgeId = 'defense') {
  const [state, setState] = useState<DefenseDisplayState | null>(null);

  useEffect(() => {
    const bridge = getGameBridge(bridgeId);
    const onState = (s: unknown) => {
      setState(s as DefenseDisplayState);
    };
    bridge.on('defenseStateChanged', onState);
    return () => {
      bridge.off('defenseStateChanged', onState);
    };
  }, [bridgeId]);

  const newGame = useCallback((seed?: number) => {
    const bridge = getGameBridge(bridgeId);
    if (bridge.newGameCallback) bridge.newGameCallback(seed);
  }, [bridgeId]);

  const endCardPhase = useCallback(() => {
    const bridge = getGameBridge(bridgeId);
    if (bridge.endCardPhaseCallback) bridge.endCardPhaseCallback();
  }, [bridgeId]);

  const startBattle = useCallback(() => {
    const bridge = getGameBridge(bridgeId);
    if (bridge.startBattleCallback) bridge.startBattleCallback();
  }, [bridgeId]);

  const setBattleSpeed = useCallback((speed: number) => {
    const bridge = getGameBridge(bridgeId);
    if (bridge.setBattleSpeedCallback) bridge.setBattleSpeedCallback(speed);
  }, [bridgeId]);

  const undo = useCallback(() => {
    getGameBridge(bridgeId).emit('undo');
  }, [bridgeId]);

  return {
    state,
    newGame,
    endCardPhase,
    startBattle,
    setBattleSpeed,
    undo,
  };
}
