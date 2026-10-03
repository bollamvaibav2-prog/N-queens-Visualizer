# Queen Quest

An interactive N-Queens learning game with level progression, conflict feedback, a visible backtracking solver, and local friend play.

## Run & Operate

- `pnpm --filter @workspace/queen-quest run dev` — run the web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/queen-quest/src/App.tsx` — game, level progression, friend mode, and backtracking solver
- `artifacts/queen-quest/src/index.css` — app styling and responsive layout

## Architecture decisions

- The first version is client-side only; browser local storage keeps level progress and personal solve stats.
- Friend play is pass-and-play on one device. Shared challenge links carry the level and board size; they do not sync live game state or scores across devices.

## Product

- Six unlockable N-Queens levels from 4×4 through 8×8.
- Interactive queen placement with immediate conflict marking, undo, reset, and completion feedback.
- Animated backtracking walkthrough with decisions, solution counts, attempts, backtracks, visited placements, and elapsed time.
- Two-player hot-seat mode and shareable friend challenge links.

## User preferences

-

## Gotchas

-

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
