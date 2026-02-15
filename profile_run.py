import cProfile
import pstats
from main import SolitaireState, MultistageNestedRolloutSolver

game = SolitaireState()
game.deal_thoughtful(seed=0)
solver = MultistageNestedRolloutSolver(game, max_time=10, n0=1, n1=1)

cProfile.run('solver.solve()', '/tmp/solitaire_profile')

stats = pstats.Stats('/tmp/solitaire_profile')
stats.sort_stats('cumulative')
stats.print_stats(20)
print()
stats.sort_stats('tottime')
stats.print_stats(20)
