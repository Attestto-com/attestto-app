# Production TODO

Hardening tasks required before production deployment. Composables and infrastructure are scaffolded — these items wire them together and close security gaps.

## Critical (must-have for production)

### Encrypted vault storage
- [ ] Wire `useEncryptedVault` into `vault.ts` — replace `localStorage.getItem('attestto:vault:credentials')` with `loadEncryptedVault()` / `saveEncryptedVault()`
- [ ] Run migration on first unlock after upgrade (`migrateFromLocalStorage()`)
- [ ] Test: lock → unlock → credentials still present after encryption round-trip
- **Files:** `app/src/stores/vault.ts`, `app/src/composables/useEncryptedVault.ts`

### Full Ed25519 signature verification
- [ ] VerifyPage currently checks proof structure only — wire actual `ed25519.verify()` from `@noble/curves`
- [ ] Resolve issuer's public key from DID document (or from proof.verificationMethod)
- [ ] Handle verification failure gracefully (show "Firma no verificable" vs "Firma invalida")
- **Files:** `app/src/views/VerifyPage.vue`, `app/src/composables/useCrypto.ts`

### WebAuthn error handling
- [ ] Handle `SecurityError` (non-secure context, e.g. HTTP instead of HTTPS)
- [ ] Handle `InvalidStateError` (credential already registered on this authenticator)
- [ ] Show recovery flow if IndexedDB signing key is missing but WebAuthn credential exists
- [ ] Call `navigator.storage.persist()` and warn user if denied
- **Files:** `app/src/composables/useCrypto.ts`, `app/src/views/LockScreen.vue`

### Attestto-anchor service
- [ ] Build `attestto-anchor` HTTP service (Solana Memo program, Merkle batching)
- [ ] Set `VITE_ANCHOR_URL` in production environment
- [ ] Queue failed anchoring attempts for retry
- **Repo:** `attestto-anchor/` (separate repo, scaffolded)
- **Client ready:** `app/src/composables/useAnchor.ts`

## Important (should-have)

### LLM question generation endpoint
- [ ] Deploy LLM API endpoint (MediaPipe on-device or server-side)
- [ ] Set `VITE_LLM_URL` in production environment
- [ ] Validate LLM-generated questions (correct answer index in bounds, 4 options, non-empty why)
- **Client ready:** `modules/cr-driving/src/composables/useQuestionGenerator.ts`

### i18n coverage
- [ ] Wire `$t()` into remaining views: VerifyPage, PdfViewerPage, DocumentsPage, ModulesPage, WalletPage, CredentialDetail
- [ ] Wire `$t()` into overlay components: PaySheet, PresentSheet, ReceiveSheet
- [ ] Wire `$t()` into cr-driving module components (exam flow is Spanish-only by design for CR, but practice mode could be bilingual)
- **Locale files ready:** `app/src/i18n/es.ts`, `app/src/i18n/en.ts`

### Typecheck cleanup
- [ ] Build `@attestto/module-sdk` dist so TS6305 errors resolve across the monorepo
- [ ] Add explicit types to `modules.ts` createContext callbacks (implicit any warnings)
- [ ] Consider `tsconfig` references for monorepo type resolution

### Test coverage expansion
- [ ] Add vault store tests (unlock → credentials loaded, lock → session cleared, sign → returns signature)
- [ ] Add useExam tests (hash chain integrity, answer recording, incident tracking)
- [ ] Add useMastery tests (decay calculation, law change reset, renewal gate)
- [ ] Add Vue component tests for LockScreen (registration vs auth flow)
- **Current:** 30 tests passing (useCrypto, useAnchor, i18n, watermark, evidenceExport)

## Nice-to-have (post-launch)

### Key recovery
- [ ] Social recovery (Shamir 2-of-3) for Ed25519 signing key
- [ ] Cloud backup option (encrypted key export)
- [ ] Re-attestation flow (if key is lost, re-verify identity and re-issue credentials)

### PDF signing integration
- [ ] Wire `@attestto/pdf` signer into PdfViewerPage's "Firmar" button
- [ ] Use vault Ed25519 key for PAdES-B signatures
- [ ] Show signature panel after signing

### Watermark extraction tool
- [ ] Build a CLI or web tool to extract zero-width watermarks from screenshots
- [ ] Feed extracted payload into forensic evidence chain

### Selective disclosure
- [ ] Wire PresentSheet's "Compartir" to build a real Verifiable Presentation (VP)
- [ ] Sign VP with Ed25519 key
- [ ] Implement field-level selective disclosure (BBS+ or SD-JWT in future)

### Performance
- [ ] Lazy-load pdfjs-dist only when PdfViewerPage is visited (already dynamic import, verify chunk splitting)
- [ ] Lazy-load qr-scanner only when VerifyPage is visited
- [ ] Service worker caching strategy for question banks and manual content
