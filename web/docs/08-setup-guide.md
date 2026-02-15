# Setup Guide

## Prerequisites
- Node.js 20+
- npm

## Install & Run
```bash
cd web
npm install
npm run dev       # http://localhost:3000
```

## Build & Deploy
```bash
npm run build     # Next.js production build
npm test          # Solver unit tests (npx tsx test-solver.ts)

# Vercel deploy
vercel login
vercel link --yes
vercel deploy --prod --yes
```

## Dependencies
```json
{
  "dependencies": {
    "next": "16.1.6",
    "phaser": "^3.90.0",
    "react": "19.2.3",
    "react-dom": "19.2.3"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "eslint": "^9",
    "eslint-config-next": "16.1.6",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

## Config Files
| File | 용도 |
|------|------|
| `next.config.ts` | Next.js (minimal, no special config) |
| `tsconfig.json` | TS strict mode, target ES2017, path alias `@/*` |
| `postcss.config.mjs` | Tailwind CSS plugin |
| `eslint.config.mjs` | ESLint rules |

## Routes
| Path | 설명 |
|------|------|
| `/` | Landing page (모드 선택) |
| `/play` | Manual play + Hint |
| `/simulate` | AI auto-play |

## 빈 프로젝트에서 재구성 순서
1. `npx create-next-app@latest web --ts --tailwind --app --src-dir`
2. `npm install phaser`
3. `src/solver/` 디렉토리 생성 → types, Deck, SolitaireState, Evaluator, NestedRolloutSolver, Worker
4. `src/game/` 디렉토리 생성 → GameBridge, config, TableScene, CardSprite, PileZone, CardRenderer, LayoutManager, AnimationManager
5. `src/components/` → PhaserGame (dynamic import), PhaserGameInner, PlayControls, SimControls
6. `src/hooks/` → useGameState, useSolver
7. `src/app/` → layout, page, play/page, simulate/page
8. Vercel deploy
