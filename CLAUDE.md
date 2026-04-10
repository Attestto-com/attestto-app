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

## Crypto

- **WebAuthn** passkey for vault unlock (`app/src/composables/useCrypto.ts`)
- **Ed25519** signing via `@noble/curves` — key in IndexedDB, gated behind WebAuthn
- **AES-256-GCM** encrypted vault (`app/src/composables/useEncryptedVault.ts`) — not yet wired to vault.ts
- **SHA-256 hash chain** in exam sessions (Web Crypto API)
- **Solana anchor** via HTTP to attestto-anchor (`app/src/composables/useAnchor.ts`)

## i18n

- `vue-i18n` with `es` (Spanish) and `en` (English) locale files
- Default locale: `es`, persisted to localStorage
- Language toggle in Settings page
- Key views wired: LockScreen, HomePage, SettingsPage, BottomNav
- Remaining views use hardcoded Spanish — see `TODO.md`

## Scripts

```bash
pnpm dev          # Start dev server (app/)
pnpm build        # Build PWA (app/)
pnpm test         # Run tests (vitest, 30 tests)
pnpm typecheck    # Typecheck all packages
```

## CI

GitHub Actions (`.github/workflows/ci.yml`): install → typecheck → test → build on push/PR to main.

## Production TODO

See `TODO.md` for hardening tasks (encrypted vault wiring, full signature verification, anchor service, i18n coverage, test expansion).

## Rules

- No Co-Authored-By in commits
- No PII in code or commits
- No strategy/internal docs in public repo
- Blue for action CTAs, green only for state/verified badges
- Spanish UI text (Attestto serves LATAM first)
