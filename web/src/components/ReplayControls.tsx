'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { getGameBridge } from '../game/bridge/GameBridge';
import { RecordingStorage } from '../game/recording/RecordingStorage';
import type { GameRecording } from '../game/recording/types';

function delay(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export default function ReplayControls({ bridgeId = 'replay' }: { bridgeId?: string }) {
  const [recordings, setRecordings] = useState<GameRecording[]>(() => RecordingStorage.list());
  const [selectedId, setSelectedId] = useState<string>('');
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(500);
  const [current, setCurrent] = useState(0);
  const [total, setTotal] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [info, setInfo] = useState<{ seed: number; sourceMode: string; result: string } | null>(null);
  const cancelRef = useRef(false);
  const playingRef = useRef(false);

  // Subscribe to bridge events
  useEffect(() => {
    const bridge = getGameBridge(bridgeId);

    const onProgress = (data: unknown) => {
      const d = data as { current: number; total: number };
      setCurrent(d.current);
    };

    bridge.on('replayProgress', onProgress);

    return () => {
      bridge.off('replayProgress', onProgress);
    };
  }, [bridgeId]);

  const loadRecording = useCallback((id: string) => {
    setSelectedId(id);
    if (!id) {
      setLoaded(false);
      setInfo(null);
      setCurrent(0);
      setTotal(0);
      return;
    }

    const recording = RecordingStorage.load(id);
    if (!recording) return;

    // Set UI state directly — don't depend on scene echoing it back
    setTotal(recording.actions.length);
    setCurrent(0);
    setLoaded(true);
    setInfo({ seed: recording.seed, sourceMode: recording.sourceMode, result: recording.result });

    // Tell scene to load the recording (for visuals)
    const bridge = getGameBridge(bridgeId);
    const fn = bridge.loadRecordingCallback;
    if (fn) fn(recording);
  }, [bridgeId]);

  const step = useCallback(() => {
    if (!loaded || current >= total) return;
    const bridge = getGameBridge(bridgeId);
    const fn = bridge.replayStepCallback;
    if (fn) fn();
  }, [bridgeId, loaded, current, total]);

  const play = useCallback(async () => {
    if (playingRef.current || !loaded) return;
    playingRef.current = true;
    cancelRef.current = false;
    setPlaying(true);

    const bridge = getGameBridge(bridgeId);

    while (!cancelRef.current) {
      // Read current progress from bridge event (via state)
      const fn = bridge.replayStepCallback;
      if (!fn) break;
      fn();

      await delay(speed);

      // Check if we've reached the end — we'll get updated via onProgress,
      // but we need a sync check here too
      // Use a small trick: after step, if no more actions, replayStepCallback is a no-op
      // We check by looking at the component state indirectly — we'll break on cancelRef
    }

    playingRef.current = false;
    setPlaying(false);
  }, [bridgeId, loaded, speed]);

  // Stop when current reaches total
  useEffect(() => {
    if (current >= total && total > 0 && playingRef.current) {
      cancelRef.current = true;
    }
  }, [current, total]);

  const pause = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const deleteRecording = useCallback((id: string) => {
    RecordingStorage.delete(id);
    setRecordings(RecordingStorage.list());
    if (selectedId === id) {
      setSelectedId('');
      setLoaded(false);
      setInfo(null);
      setCurrent(0);
      setTotal(0);
    }
  }, [selectedId]);

  const resultColor = info?.result === 'win' ? 'text-green-400' : info?.result === 'loss' ? 'text-red-400' : 'text-zinc-400';

  return (
    <div className="h-auto min-h-12 flex flex-wrap items-center justify-between px-4 py-2 bg-zinc-800 border-b border-zinc-700 text-sm gap-2">
      <div className="flex items-center gap-3">
        <label className="text-zinc-400">Recording:</label>
        <select
          value={selectedId}
          onChange={e => loadRecording(e.target.value)}
          className="px-2 py-1 rounded bg-zinc-700 text-white border border-zinc-600 max-w-56"
          disabled={playing}
        >
          <option value="">Select...</option>
          {recordings.map(r => (
            <option key={r.id} value={r.id}>
              #{r.seed} ({r.sourceMode}) — {r.result} ({r.totalMoves} moves)
            </option>
          ))}
        </select>

        {loaded && (
          <>
            <button
              onClick={step}
              disabled={playing || current >= total}
              className="px-3 py-1 rounded bg-zinc-600 hover:bg-zinc-500 text-white transition-colors disabled:opacity-40"
            >
              Step
            </button>
            <button
              onClick={playing ? pause : play}
              disabled={!playing && current >= total}
              className={`px-3 py-1 rounded transition-colors text-white ${
                playing
                  ? 'bg-red-700 hover:bg-red-600'
                  : 'bg-emerald-700 hover:bg-emerald-600'
              } disabled:opacity-40`}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            <div className="flex items-center gap-1 text-zinc-400">
              <label>Speed:</label>
              <input
                type="range"
                min="100"
                max="3000"
                step="100"
                value={speed}
                onChange={e => setSpeed(Number(e.target.value))}
                className="w-24"
              />
              <span className="w-14 text-right">{speed}ms</span>
            </div>
          </>
        )}
      </div>

      <div className="flex items-center gap-4 text-zinc-400">
        {loaded && (
          <>
            <span>Step: {current}/{total}</span>
            {info && (
              <>
                <span>Seed: {info.seed}</span>
                <span className={resultColor + ' font-bold'}>{info.result.toUpperCase()}</span>
              </>
            )}
            {selectedId && (
              <button
                onClick={() => deleteRecording(selectedId)}
                disabled={playing}
                className="px-2 py-1 rounded bg-zinc-700 hover:bg-red-700 text-zinc-400 hover:text-white transition-colors disabled:opacity-40"
              >
                Delete
              </button>
            )}
          </>
        )}
        {!loaded && recordings.length === 0 && (
          <span className="text-zinc-500">No recordings yet. Play or simulate a game first.</span>
        )}
      </div>
    </div>
  );
}
