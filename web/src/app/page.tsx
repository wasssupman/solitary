import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-900 to-zinc-950">
      <div className="flex flex-col items-center gap-10">
        <div className="text-center">
          <h1 className="text-5xl font-bold tracking-tight mb-2">Solitaire</h1>
          <p className="text-zinc-400 text-lg">Klondike with AI Solver</p>
        </div>

        <div className="flex flex-col gap-4 w-64">
          <Link
            href="/play"
            className="flex flex-col items-center rounded-xl bg-emerald-700 px-8 py-5 text-center transition-colors hover:bg-emerald-600"
          >
            <span className="text-2xl mb-1">Play</span>
            <span className="text-emerald-200 text-sm">Classic Klondike with hints</span>
          </Link>
          <Link
            href="/defense"
            className="flex flex-col items-center rounded-xl bg-indigo-700 px-8 py-5 text-center transition-colors hover:bg-indigo-600"
          >
            <span className="text-2xl mb-1">Defense</span>
            <span className="text-indigo-200 text-sm">Solitaire meets tower defense</span>
          </Link>
          <Link
            href="/simulate"
            className="flex flex-col items-center rounded-xl border border-zinc-600 px-8 py-5 text-center transition-colors hover:bg-zinc-800"
          >
            <span className="text-2xl mb-1">Simulate</span>
            <span className="text-zinc-400 text-sm">Watch AI solve games</span>
          </Link>
          <Link
            href="/replay"
            className="flex flex-col items-center rounded-xl border border-zinc-600 px-8 py-5 text-center transition-colors hover:bg-zinc-800"
          >
            <span className="text-2xl mb-1">Replay</span>
            <span className="text-zinc-400 text-sm">Watch recorded games</span>
          </Link>
        </div>

        <p className="text-zinc-600 text-xs">
          Nested Rollout Policy Adaptation solver
        </p>
      </div>
    </div>
  );
}
