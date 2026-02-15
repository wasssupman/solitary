import random
import time
from dataclasses import dataclass, field, replace
from enum import Enum
from typing import List, Optional, Tuple, Set, Dict

# ==========================================
# Constants
# ==========================================
WIN_VALUE = float('inf')
LOSS_VALUE = float('-inf')

# ==========================================
# 1. Data Structures
# ==========================================

class Suit(Enum):
    HEARTS = 0
    DIAMONDS = 1
    CLUBS = 2
    SPADES = 3

    @property
    def color(self):
        return 'red' if self in (Suit.HEARTS, Suit.DIAMONDS) else 'black'

    @property
    def is_red(self):
        return self.value < 2

    @property
    def symbol(self):
        return {0: '♥', 1: '♦', 2: '♣', 3: '♠'}[self.value]

@dataclass(frozen=True)
class Card:
    rank: int  # 1(A) ~ 13(K)
    suit: Suit
    face_up: bool = False
    # Cached values to avoid slow Enum property access
    _sv: int = field(init=False, repr=False, compare=False, hash=False)
    _red: bool = field(init=False, repr=False, compare=False, hash=False)

    def __post_init__(self):
        object.__setattr__(self, '_sv', self.suit.value)
        object.__setattr__(self, '_red', self.suit.value < 2)

    def __repr__(self):
        r_map = {1: 'A', 11: 'J', 12: 'Q', 13: 'K'}
        r = r_map.get(self.rank, str(self.rank))
        s = self.suit.symbol
        return f"{r}{s}" if self.face_up else f"[{r}{s}]"

    def can_stack_on_tableau(self, other: 'Card') -> bool:
        return other.face_up and self.rank == other.rank - 1 and self._red != other._red

class ActionType(Enum):
    TABLEAU_TO_FOUNDATION = 1
    TABLEAU_TO_TABLEAU = 2
    WASTE_TO_FOUNDATION = 3
    WASTE_TO_TABLEAU = 4
    FOUNDATION_TO_TABLEAU = 5

@dataclass
class Move:
    action_type: ActionType
    src_idx: int
    dest_idx: int
    card: Card
    num_cards: int = 1
    stock_turns: int = 0
    priority: int = 6

    def __repr__(self):
        names = {-1: "Stock"}
        if self.action_type == ActionType.FOUNDATION_TO_TABLEAU:
            src = f"F{self.src_idx}"
        else:
            src = names.get(self.src_idx, f"T{self.src_idx}")
        if self.action_type in (ActionType.TABLEAU_TO_FOUNDATION, ActionType.WASTE_TO_FOUNDATION):
            dest = f"F{self.dest_idx}"
        else:
            dest = f"T{self.dest_idx}"
        info = f" (Turns:{self.stock_turns})" if self.stock_turns > 0 else ""
        return f"{self.card} {src}->{dest}{info}"

# ==========================================
# 2. Game State with K+ Logic
# ==========================================

class SolitaireState:
    def __init__(self):
        self.tableau: List[List[Card]] = [[] for _ in range(7)]
        self.foundation: List[List[Card]] = [[] for _ in range(4)]
        self.stock: List[Card] = []
        self.waste: List[Card] = []

    def clone(self):
        s = SolitaireState.__new__(SolitaireState)
        s.tableau = [list(col) for col in self.tableau]
        s.foundation = [list(f) for f in self.foundation]
        s.stock = list(self.stock)
        s.waste = list(self.waste)
        return s

    def deal_thoughtful(self, seed=None):
        if seed is not None:
            random.seed(seed)
        deck = [Card(rank, suit) for suit in Suit for rank in range(1, 14)]
        random.shuffle(deck)
        for i in range(7):
            for j in range(i + 1):
                card = deck.pop()
                card = replace(card, face_up=(j == i))
                self.tableau[i].append(card)
        self.stock = deck
        self.waste = []

    def is_win(self):
        f = self.foundation
        return len(f[0]) + len(f[1]) + len(f[2]) + len(f[3]) == 52

    def state_hash(self):
        parts = []
        for col in self.tableau:
            for c in col:
                parts.append(c.rank * 8 + c._sv * 2 + c.face_up)
            parts.append(-1)
        for pile in self.foundation:
            parts.append(len(pile))
        parts.append(-2)
        for c in self.stock:
            parts.append(c.rank * 4 + c._sv)
        parts.append(-3)
        for c in self.waste:
            parts.append(c.rank * 4 + c._sv)
        return hash(tuple(parts))

    def get_reachable_talon_cards(self) -> Set[Tuple[int, int]]:
        reachable = set()
        sim_stock = list(self.stock)
        sim_waste = list(self.waste)
        seen = set()
        for _ in range(60):
            if sim_waste:
                c = sim_waste[-1]
                reachable.add((c.rank, c._sv))
            key = (tuple(c.rank * 10 + c._sv for c in sim_stock),
                   tuple(c.rank * 10 + c._sv for c in sim_waste))
            if key in seen:
                break
            seen.add(key)
            if not sim_stock:
                if not sim_waste:
                    break
                sim_stock = list(reversed(sim_waste))
                sim_waste = []
            draw = min(3, len(sim_stock))
            for _ in range(draw):
                sim_waste.append(sim_stock.pop())
        return reachable

    def is_relaxed_solvable(self) -> bool:
        """Paper Sec 4.1: Relaxed domain pruning.
        Check if the game can be solved when delete effects are removed.
        If not, the real game is also unsolvable."""
        next_rank = [len(f) + 1 for f in self.foundation]

        # Map each card identity to its tableau position
        card_col_pos: Dict[Tuple[int, int], Tuple[int, int]] = {}
        for i, col in enumerate(self.tableau):
            for j, card in enumerate(col):
                card_col_pos[(card.rank, card._sv)] = (i, j)

        # Track frontier per column: deepest accessible position
        frontier: Dict[int, int] = {}
        accessible: Set[Tuple[int, int]] = set()
        for i, col in enumerate(self.tableau):
            for j in range(len(col)):
                if col[j].face_up:
                    frontier[i] = j
                    for k in range(j, len(col)):
                        accessible.add((col[k].rank, col[k]._sv))
                    break

        # In relaxed domain, ALL stock/waste cards are accessible
        # (delete effects removed → stock never consumed → all cards reachable)
        for c in self.stock:
            accessible.add((c.rank, c._sv))
        for c in self.waste:
            accessible.add((c.rank, c._sv))

        progress = True
        while progress:
            progress = False
            for sv in range(4):
                r = next_rank[sv]
                while r <= 13 and (r, sv) in accessible:
                    next_rank[sv] = r + 1
                    progress = True
                    # Reveal card below in tableau
                    if (r, sv) in card_col_pos:
                        ci, pos = card_col_pos[(r, sv)]
                        if ci in frontier and pos == frontier[ci] and pos > 0:
                            frontier[ci] = pos - 1
                            below = self.tableau[ci][pos - 1]
                            accessible.add((below.rank, below._sv))
                    r = next_rank[sv]

        return all(n > 13 for n in next_rank)

    def can_foundation_return(self, card_rank: int) -> bool:
        """Paper Sec 4.4: Foundation card can return unless rank<=2
        or all cards of rank-2 are already in Foundation."""
        if card_rank <= 2:
            return False
        target = card_rank - 2
        for f in self.foundation:
            if len(f) < target:
                return True
        return False

    # ----------------------------------------------------------------
    # Move Generation (Paper Sec 4.4: Action Ordering & Restrictions)
    # Priority: 1=T→F(reveal), 2=any→F, 3=T→T(reveal),
    #           4=Waste→T, 5=F→T, 6=T→T(no reveal)
    # ----------------------------------------------------------------
    def get_ordered_moves(self) -> List[Move]:
        all_moves: List[Move] = []
        first_empty_for_king = self._first_empty_col()

        # --- Tableau moves ---
        for i, col in enumerate(self.tableau):
            if not col:
                continue
            top = col[-1]

            # Tableau → Foundation
            f_idx = top._sv
            f_pile = self.foundation[f_idx]
            can_f = (not f_pile and top.rank == 1) or \
                    (f_pile and f_pile[-1].rank == top.rank - 1)
            if can_f:
                reveals = len(col) > 1 and not col[-2].face_up
                all_moves.append(Move(
                    ActionType.TABLEAU_TO_FOUNDATION, i, f_idx, top,
                    priority=1 if reveals else 2))

            # Tableau → Tableau (partial and full stack moves)
            col_len = len(col)
            for j in range(col_len):
                if not col[j].face_up:
                    continue
                moving = col[j]
                m_rank = moving.rank
                m_red = moving._red
                reveals = j > 0 and not col[j - 1].face_up
                king_at_bottom = (m_rank == 13 and j == 0)
                n_cards = col_len - j
                pri = 3 if reveals else 6
                for ti in range(7):
                    if ti == i:
                        continue
                    target_col = self.tableau[ti]
                    if not target_col:
                        if m_rank == 13 and not king_at_bottom \
                                and ti == first_empty_for_king:
                            all_moves.append(Move(
                                ActionType.TABLEAU_TO_TABLEAU, i, ti, moving,
                                num_cards=n_cards, priority=pri))
                    else:
                        tt = target_col[-1]
                        if tt.face_up and m_rank == tt.rank - 1 \
                                and m_red != tt._red:
                            all_moves.append(Move(
                                ActionType.TABLEAU_TO_TABLEAU, i, ti, moving,
                                num_cards=n_cards, priority=pri))

        # --- Foundation → Tableau ---
        for f_idx, f_pile in enumerate(self.foundation):
            if not f_pile:
                continue
            top = f_pile[-1]
            if not self.can_foundation_return(top.rank):
                continue
            t_rank = top.rank
            t_red = top._red
            for ti, col in enumerate(self.tableau):
                if not col:
                    if t_rank == 13:
                        all_moves.append(Move(
                            ActionType.FOUNDATION_TO_TABLEAU, f_idx, ti,
                            top, priority=5))
                        break  # Only first empty for King
                else:
                    tt = col[-1]
                    if tt.face_up and t_rank == tt.rank - 1 \
                            and t_red != tt._red:
                        all_moves.append(Move(
                            ActionType.FOUNDATION_TO_TABLEAU, f_idx, ti,
                            top, priority=5))

        # --- K+ Waste/Stock moves ---
        sim_stock = list(self.stock)
        sim_waste = list(self.waste)
        seen_states: Set = set()
        found: Set = set()
        first_empty_for_king = self._first_empty_col()

        for turns in range(60):
            if sim_waste:
                self._gen_waste_moves(
                    sim_waste[-1], turns, all_moves, found, first_empty_for_king)
            key = (tuple(c.rank * 10 + c._sv for c in sim_stock),
                   tuple(c.rank * 10 + c._sv for c in sim_waste))
            if key in seen_states:
                break
            seen_states.add(key)
            if not sim_stock:
                if not sim_waste:
                    break
                sim_stock = list(reversed(sim_waste))
                sim_waste = []
            draw = min(3, len(sim_stock))
            for _ in range(draw):
                sim_waste.append(sim_stock.pop())

        random.shuffle(all_moves)
        all_moves.sort(key=lambda m: m.priority)
        return all_moves

    def _first_empty_col(self) -> Optional[int]:
        for i in range(7):
            if not self.tableau[i]:
                return i
        return None

    def _gen_waste_moves(self, card, turns, moves, found, first_empty):
        # Waste → Foundation
        c_rank = card.rank
        c_sv = card._sv
        f_pile = self.foundation[c_sv]
        can_f = (not f_pile and c_rank == 1) or \
                (f_pile and f_pile[-1].rank == c_rank - 1)
        if can_f:
            aid = ('WF', c_rank, c_sv)
            if aid not in found:
                moves.append(Move(ActionType.WASTE_TO_FOUNDATION, -1, c_sv,
                                  card, stock_turns=turns, priority=2))
                found.add(aid)

        # Waste → Tableau (inline can_stack_on_tableau)
        c_red = card._red
        for ti, col in enumerate(self.tableau):
            if not col:
                if c_rank == 13 and ti == first_empty:
                    aid = ('WT', c_rank, c_sv, ti)
                    if aid not in found:
                        moves.append(Move(ActionType.WASTE_TO_TABLEAU, -1, ti,
                                          card, stock_turns=turns, priority=4))
                        found.add(aid)
            else:
                tt = col[-1]
                if tt.face_up and c_rank == tt.rank - 1 and c_red != tt._red:
                    aid = ('WT', c_rank, c_sv, ti)
                    if aid not in found:
                        moves.append(Move(ActionType.WASTE_TO_TABLEAU, -1, ti,
                                          card, stock_turns=turns, priority=4))
                        found.add(aid)

    def apply_move(self, move: Move):
        # K+ macro: cycle stock
        if move.stock_turns > 0:
            for _ in range(move.stock_turns):
                if not self.stock:
                    self.stock = list(reversed(self.waste))
                    self.waste = []
                draw = min(3, len(self.stock))
                for _ in range(draw):
                    self.waste.append(self.stock.pop())

        at = move.action_type
        if at == ActionType.TABLEAU_TO_FOUNDATION:
            c = self.tableau[move.src_idx].pop()
            self.foundation[move.dest_idx].append(
                Card(c.rank, c.suit, True))
            self._flip_top(move.src_idx)
        elif at == ActionType.TABLEAU_TO_TABLEAU:
            stack = self.tableau[move.src_idx][-move.num_cards:]
            del self.tableau[move.src_idx][-move.num_cards:]
            self.tableau[move.dest_idx].extend(stack)
            self._flip_top(move.src_idx)
        elif at == ActionType.WASTE_TO_FOUNDATION:
            c = self.waste.pop()
            self.foundation[move.dest_idx].append(
                Card(c.rank, c.suit, True))
        elif at == ActionType.WASTE_TO_TABLEAU:
            c = self.waste.pop()
            self.tableau[move.dest_idx].append(
                Card(c.rank, c.suit, True))
        elif at == ActionType.FOUNDATION_TO_TABLEAU:
            c = self.foundation[move.src_idx].pop()
            self.tableau[move.dest_idx].append(
                Card(c.rank, c.suit, True))

    def _flip_top(self, col_idx):
        col = self.tableau[col_idx]
        if col and not col[-1].face_up:
            c = col[-1]
            col[-1] = Card(c.rank, c.suit, True)

    def display(self):
        print("=" * 55)
        print("Foundation:", end=" ")
        for i, f in enumerate(self.foundation):
            if f:
                print(f"[{f[-1]}]", end=" ")
            else:
                print(f"[{Suit(i).symbol}:_]", end=" ")
        fc = sum(len(f) for f in self.foundation)
        print(f"  ({fc}/52)")
        print(f"Stock: {len(self.stock)} | Waste: {len(self.waste)}", end="")
        if self.waste:
            print(f" (top: {self.waste[-1]})")
        else:
            print()
        print("Tableau:")
        max_len = max((len(c) for c in self.tableau), default=0)
        for row in range(max_len):
            for ci in range(7):
                col = self.tableau[ci]
                if row < len(col):
                    print(f"{str(col[row]):>6}", end=" ")
                else:
                    print("      ", end=" ")
            print()
        print("=" * 55)

# ==========================================
# 3. Heuristic Evaluator (Paper Table 1)
# ==========================================

class HeuristicType(Enum):
    H1 = 0  # Opening
    H2 = 1  # Endgame

class Evaluator:
    """Paper Table 1: Per-card feature evaluation with 6 features."""

    @staticmethod
    def evaluate(state: SolitaireState, h_type: HeuristicType) -> float:
        if state.is_win():
            return WIN_VALUE

        score = 0.0
        is_h1 = (h_type == HeuristicType.H1)

        # Feature 1: x is in a Foundation stack
        # H1: 5 - rank_value (sliding scale, A=5, K=-7)
        # H2: 5 (flat)
        for f_pile in state.foundation:
            for card in f_pile:
                rv = card.rank - 1  # 0-based rank value
                score += (5 - rv) if is_h1 else 5

        # Feature 2: x is face down in a Tableau stack
        # Both: rank_value - 13 (A: -13, K: -1)
        for col in state.tableau:
            for card in col:
                if not card.face_up:
                    score += (card.rank - 1) - 13

        # Feature 3: x is available from K+ Talon
        # H1: 0, H2: 1
        if not is_h1:
            reachable = state.get_reachable_talon_cards()
            score += len(reachable)

        # Collect face-down info for Features 4, 5, 6
        # Build per-column position maps for blocking checks
        face_down_set: Set[Tuple[int, int]] = set()  # (rank, suit_value)
        for col in state.tableau:
            for card in col:
                if not card.face_up:
                    face_down_set.add((card.rank, card._sv))

        # Feature 4: Same rank & color pair both face-down in Tableau
        # H1: -5, H2: -1
        w4 = -5 if is_h1 else -1
        for rank in range(1, 14):
            # Red pair: Hearts(0) + Diamonds(1)
            if (rank, 0) in face_down_set and (rank, 1) in face_down_set:
                score += w4
            # Black pair: Clubs(2) + Spades(3)
            if (rank, 2) in face_down_set and (rank, 3) in face_down_set:
                score += w4

        # Features 5 & 6: Blocking relationships within each column
        # Paper definition: "x can block y if x is above y in a Tableau stack
        # and x is NOT resting on a face up card."
        # Only the first face-up card (resting on face-down) and all face-down
        # cards can be blockers. Face-up cards in the movable sequence cannot.
        w5 = -5 if is_h1 else -1  # blocking suited lesser rank
        w6 = -10 if is_h1 else -5  # blocking own tableau build card
        for col in state.tableau:
            n = len(col)
            for j in range(n):
                x = col[j]
                # Blocking condition: x is NOT resting on a face-up card
                if j > 0 and col[j - 1].face_up:
                    continue  # x rests on face-up card → not a blocker
                for i in range(j):
                    y = col[i]
                    # Feature 5: x blocks suited card of lesser rank
                    if x._sv == y._sv and x.rank > y.rank:
                        score += w5
                    # Feature 6: x blocks one of its own tableau build cards
                    # Build cards: opposite color, rank = x.rank + 1
                    if x.rank < 13:
                        if y.rank == x.rank + 1 and y._red != x._red:
                            score += w6

        return score

# ==========================================
# 4. Multistage Nested Rollout Solver
#    (Paper Figure 9)
# ==========================================

class MultistageNestedRolloutSolver:
    def __init__(self, root_state: SolitaireState,
                 max_time: int = 60, n0: int = 1, n1: int = 1):
        self.root = root_state
        self.max_time = max_time
        self.n_levels = [n0, n1]
        self.start_time = 0.0
        self.h_types = [HeuristicType.H1, HeuristicType.H2]
        # Cache: set of (state_hash, h_idx, n) — up to 5000 per heuristic
        self.caches: List[Set] = [set(), set()]
        self.cache_limit = 5000
        self.final_state: Optional[SolitaireState] = None
        self.nodes_searched = 0

    @staticmethod
    def _move_sig(m: Move) -> tuple:
        """Comparable signature for a move."""
        return (m.action_type, m.src_idx, m.dest_idx,
                m.card.rank, m.card._sv, m.num_cards)

    @staticmethod
    def _get_reverse_sig(move: Move, state: SolitaireState):
        """Compute signature of the reverse move, or None if not reversible.
        Must be called BEFORE apply_move (needs pre-move state)."""
        at = move.action_type

        if at == ActionType.TABLEAU_TO_TABLEAU:
            src_col = state.tableau[move.src_idx]
            remaining = len(src_col) - move.num_cards
            # If removing cards reveals a face-down card, flip changes state
            if remaining > 0 and not src_col[remaining - 1].face_up:
                return None  # flip => not reversible
            return (ActionType.TABLEAU_TO_TABLEAU, move.dest_idx, move.src_idx,
                    move.card.rank, move.card._sv, move.num_cards)

        if at == ActionType.TABLEAU_TO_FOUNDATION:
            src_col = state.tableau[move.src_idx]
            if len(src_col) > 1 and not src_col[-2].face_up:
                return None  # flip => not reversible
            return (ActionType.FOUNDATION_TO_TABLEAU, move.dest_idx, move.src_idx,
                    move.card.rank, move.card._sv, 1)

        if at == ActionType.FOUNDATION_TO_TABLEAU:
            return (ActionType.TABLEAU_TO_FOUNDATION, move.dest_idx, move.src_idx,
                    move.card.rank, move.card._sv, 1)

        # Waste moves are not reversible (can't put cards back in waste)
        return None

    def solve(self) -> List[Move]:
        self.start_time = time.time()
        self.caches = [set(), set()]
        self.nodes_searched = 0
        state = self.root.clone()
        val, moves = self._search(state, h_idx=0,
                                  n_override=self.n_levels[0],
                                  path=frozenset(),
                                  top_level=True)
        self.final_state = state
        return moves

    def _search(self, state: SolitaireState, h_idx: int,
                n_override: int, path: frozenset,
                top_level: bool = False,
                last_move_reverse=None) -> Tuple[float, List[Move]]:
        """
        Paper Figure 9: multistage-nested-rollout
        Modifies `state` in place (advances through the game).
        Returns (value, list_of_moves_applied_to_state).

        top_level: when True, don't return immediately on WIN from children.
        Instead, continue the while loop to build the full solution path.
        last_move_reverse: signature of the reverse of the move that created
        this state (for local loop prevention, Paper Sec 4.4).
        """
        h_type = self.h_types[h_idx]
        n = n_override
        z = len(self.h_types) - 1 - h_idx  # remaining heuristic switches
        solution: List[Move] = []
        self.nodes_searched += 1

        # === Lines 1-3: One-time entry checks ===
        if state.is_win():
            return (WIN_VALUE, solution)

        sh = state.state_hash()
        if sh in path:
            return (LOSS_VALUE, solution)

        if time.time() - self.start_time > self.max_time:
            return (Evaluator.evaluate(state, h_type), solution)

        legal = state.get_ordered_moves()
        # Local loop prevention: filter reverse of last move (Paper Sec 4.4)
        if last_move_reverse is not None:
            filtered = [m for m in legal if self._move_sig(m) != last_move_reverse]
            if filtered:
                legal = filtered
        if not legal:
            return (Evaluator.evaluate(state, h_type), solution)

        if n == -1:
            return (Evaluator.evaluate(state, h_type), solution)

        # === Lines 4-6: Cache check (ONCE on entry) ===
        cache_key = (sh, n)
        if cache_key in self.caches[h_idx]:
            if z == 0:
                return (Evaluator.evaluate(state, h_type), solution)
            else:
                # Pass path WITHOUT current state; new call starts at this state
                val, sub = self._search(
                    state, h_idx + 1, self.n_levels[h_idx + 1],
                    path, top_level=top_level)
                solution.extend(sub)
                return (val, solution)

        # Cache this node (only n > 0)
        if n > 0 and len(self.caches[h_idx]) < self.cache_limit:
            self.caches[h_idx].add(cache_key)

        # === Lines 7-14: Main while loop ===
        current_path = path | {sh}

        while True:
            # Track current state hash for heuristic switch
            loop_sh = state.state_hash()

            # Line 8-9: Evaluate children
            best_val = LOSS_VALUE
            best_move = None
            best_sub = []

            for a in legal:
                # Time check inside loop
                if time.time() - self.start_time > self.max_time:
                    if best_move is None:
                        best_move = a
                        best_val = Evaluator.evaluate(state, h_type)
                    break

                child = state.clone()
                child_reverse = self._get_reverse_sig(a, state)
                child.apply_move(a)
                val, sub = self._search(child, h_idx, n - 1, current_path,
                                        last_move_reverse=child_reverse)

                if val > best_val:
                    best_val = val
                    best_move = a
                    best_sub = sub

                # WIN shortcut: stop evaluating other children
                if val == WIN_VALUE:
                    break

            # Line 10: WIN propagation — apply full sub-path at once
            if best_val == WIN_VALUE:
                state.apply_move(best_move)
                solution.append(best_move)
                for m in best_sub:
                    state.apply_move(m)
                    solution.append(m)
                if state.is_win():
                    return (WIN_VALUE, solution)
                # Sub-path didn't fully complete; continue searching
                sh_new = state.state_hash()
                current_path = current_path | {sh_new}
                legal = state.get_ordered_moves()
                if not legal:
                    return (WIN_VALUE, solution)
                continue

            # Line 11-13: Local max / LOSS detection
            current_val = Evaluator.evaluate(state, h_type)
            if best_val == LOSS_VALUE or (z > 0 and best_val < current_val):
                if z == 0:
                    return (current_val, solution)
                else:
                    # Switch to next heuristic; exclude current state from path
                    # so the new call can start at this state without loop detection
                    switch_path = current_path - frozenset({loop_sh})
                    val, sub = self._search(
                        state, h_idx + 1, self.n_levels[h_idx + 1],
                        switch_path, top_level=top_level)
                    solution.extend(sub)
                    return (val, solution)

            # Line 14: Advance
            reverse_sig = self._get_reverse_sig(best_move, state)
            state.apply_move(best_move)
            solution.append(best_move)
            sh_new = state.state_hash()

            # Loop detection for new state
            if sh_new in current_path:
                return (Evaluator.evaluate(state, h_type), solution)

            current_path = current_path | {sh_new}
            self.nodes_searched += 1

            # Check termination conditions for new state
            if state.is_win():
                return (WIN_VALUE, solution)

            if time.time() - self.start_time > self.max_time:
                return (Evaluator.evaluate(state, h_type), solution)

            legal = state.get_ordered_moves()
            # Local loop prevention for next iteration
            if reverse_sig is not None:
                filtered = [m for m in legal
                            if self._move_sig(m) != reverse_sig]
                if filtered:
                    legal = filtered
            if not legal:
                return (Evaluator.evaluate(state, h_type), solution)

# ==========================================
# Main
# ==========================================
if __name__ == "__main__":
    seed_val = 42
    n0, n1 = 1, 1
    time_limit = 60

    print("Thoughtful Solitaire Solver")
    print(f"  Algorithm: Multistage Nested Rollout (Paper Figure 9)")
    print(f"  Heuristics: H1(n={n0}) + H2(n={n1})")
    print(f"  Time limit: {time_limit}s | Seed: {seed_val}")
    print()

    game = SolitaireState()
    game.deal_thoughtful(seed=seed_val)
    print("Initial State:")
    game.display()

    print("Solving...")
    solver = MultistageNestedRolloutSolver(game, max_time=time_limit, n0=n0, n1=n1)
    solution = solver.solve()
    elapsed = time.time() - solver.start_time

    final = solver.final_state
    fc = sum(len(f) for f in final.foundation)

    print()
    if final.is_win():
        print(f"Result: WIN in {len(solution)} moves! ({elapsed:.1f}s)")
    else:
        print(f"Result: NOT SOLVED ({fc}/52 in foundation, "
              f"{len(solution)} moves, {elapsed:.1f}s)")

    print(f"Nodes searched: {solver.nodes_searched}")
    print()
    print("Final State:")
    final.display()

    print()
    print(f"Solution ({len(solution)} moves):")
    for i, m in enumerate(solution):
        print(f"  {i + 1:3d}. {m}")
