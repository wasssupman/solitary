'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { SerializedMove } from '../solver/workerProtocol';
import { getGameBridge } from '../game/bridge/GameBridge';

export function useAnimationQueue() {
  const [queue, setQueue] = useState<SerializedMove[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1000); // ms per move
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enqueueMoves = useCallback((moves: SerializedMove[], autoPlay = true) => {
    setQueue(moves);
    setCurrentIndex(0);
    if (autoPlay && moves.length > 0) setPlaying(true);
  }, []);

  const playNext = useCallback(() => {
    setCurrentIndex(prev => {
      const next = prev;
      if (next >= queue.length) {
        setPlaying(false);
        return prev;
      }
      getGameBridge().emit('simMove', queue[next]);
      return next + 1;
    });
  }, [queue]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);

  const step = useCallback(() => {
    setPlaying(false);
    playNext();
  }, [playNext]);

  const reset = useCallback(() => {
    setPlaying(false);
    setCurrentIndex(0);
    setQueue([]);
  }, []);

  // Auto-advance when playing
  useEffect(() => {
    if (!playing || currentIndex >= queue.length) {
      if (playing && currentIndex >= queue.length) setPlaying(false);
      return;
    }
    timerRef.current = setTimeout(() => {
      getGameBridge().emit('simMove', queue[currentIndex]);
      setCurrentIndex(prev => prev + 1);
    }, speed);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [playing, currentIndex, queue, speed]);

  return {
    enqueueMoves,
    play,
    pause,
    step,
    reset,
    setSpeed,
    playing,
    speed,
    currentIndex,
    totalMoves: queue.length,
    isDone: currentIndex >= queue.length && queue.length > 0,
  };
}
