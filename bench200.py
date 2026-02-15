import sys, time, random
from main import SolitaireState, MultistageNestedRolloutSolver

wins = 0
total = 200
times = []
win_times = []
loss_times = []
for seed in range(total):
    game = SolitaireState()
    game.deal_thoughtful(seed=seed)
    solver = MultistageNestedRolloutSolver(game, max_time=60, n0=1, n1=1)
    solution = solver.solve()
    elapsed = time.time() - solver.start_time
    times.append(elapsed)
    won = solver.final_state.is_win()
    if won:
        wins += 1
        win_times.append(elapsed)
    else:
        loss_times.append(elapsed)
    status = 'WIN' if won else 'LOSS'
    fc = sum(len(f) for f in solver.final_state.foundation)
    print(f'Seed {seed:3d}: {status} {elapsed:5.1f}s  fc={fc:2d}  nodes={solver.nodes_searched}', flush=True)

print(f'\nResult: {wins}/{total} = {wins/total*100:.1f}%', flush=True)
print(f'Avg time: {sum(times)/len(times):.1f}s', flush=True)
if win_times:
    print(f'Avg win time: {sum(win_times)/len(win_times):.1f}s', flush=True)
if loss_times:
    print(f'Avg loss time: {sum(loss_times)/len(loss_times):.1f}s', flush=True)
