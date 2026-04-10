# attestto-app

Sovereign citizen wallet — identity, credentials, documents, money, exams.

## Architecture

**Monorepo** (pnpm workspaces):

- `app/` — Core PWA shell (Vue 3 + Quasar + Vite + PWA)
- `modules/sdk/` — Module interface contract (`@attestto/module-sdk`)
- `modules/cr-driving/` — CR driving exam module (`app-module-cr-driving`)
- `modules/cr-medical/` — CR medical attestation module (`app-module-cr-medical`)

## Stack

- Vue 3 + TypeScript
- Quasar Framework (components + dark theme)
- Vite + vite-plugin-pwa
- Pinia (state management)
- Vue Router (with module dynamic route registration)

## Module System

Modules implement `AttesttoModule` from `@attestto/module-sdk`. They:
- Declare required credentials in their manifest
- Register routes dynamically on install
- Push inbox items to the home screen
- Get scoped storage (localStorage namespaced by module ID)
- Are credential-gated: no matching VC in vault = can't install

## Design Tokens

Colors, spacing, radii defined in `app/src/styles/tokens.css`. Dark theme only.

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | #0f1923 | Background |
| `--bg-card` | #1a1f2e | Cards |
| `--primary` | #594FD3 | Action buttons |
| `--success` | #4ade80 | Valid/verified |
| `--critical` | #ef4444 | Invalid/failed |

## Scripts

```bash
pnpm dev          # Start dev server (app/)
pnpm build        # Build PWA (app/)
pnpm typecheck    # Typecheck all packages
```

## Rules

- No Co-Authored-By in commits
- No PII in code or commits
- No strategy/internal docs in public repo
- Blue for action CTAs, green only for state/verified badges
- Spanish UI text (Attestto serves LATAM first)
