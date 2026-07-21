<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useQrScanner } from '@/composables/useQrScanner'
import { verify as ed25519Verify, fromBase64url, didKeyFromEd25519PublicKey } from '@/composables/useCrypto'

const router = useRouter()
const qr = useQrScanner()
const { t } = useI18n()
const videoEl = ref<HTMLVideoElement | null>(null)

type SignatureStatus = 'valid' | 'self-asserted' | 'invalid' | 'unverifiable' | 'none'
// Trust level shown on the result card. `self-asserted` = cryptographically
// sound but signed by a self-generated did:key (no third-party authority);
// `unverifiable` = issuer DID cannot be resolved to confirm authorship.
type TrustLevel = 'verified' | 'self-asserted' | 'unverifiable' | 'invalid'

interface VerifyResult {
  valid: boolean
  trust: TrustLevel
  type: string
  holder: string
  issuer: string
  active: boolean
  signatureStatus: SignatureStatus
  anchored: boolean
  anchorTx?: string
  raw?: Record<string, unknown>
}

const verifyResult = ref<VerifyResult | null>(null)
const verifying = ref(false)
const verifyError = ref('')

// Map signature status (+ lifecycle) to the trust level shown on the card.
// `verified` (issuer-authenticated) is reserved for when third-party issuer DID
// resolution lands; today the strongest a signature reaches is `self-asserted`.
function computeTrust(active: boolean, notRevoked: boolean, sig: SignatureStatus): TrustLevel {
  if (!active || !notRevoked || sig === 'invalid') return 'invalid'
  if (sig === 'valid') return 'verified'
  if (sig === 'self-asserted') return 'self-asserted'
  return 'unverifiable' // 'unverifiable' | 'none'
}

// Card presentation per trust level.
function trustCardClass(tr: TrustLevel): string {
  return tr === 'verified' ? 'valid' : tr === 'invalid' ? 'invalid' : tr
}
function trustIcon(tr: TrustLevel): string {
  return tr === 'verified' ? 'verified' : tr === 'invalid' ? 'cancel' : 'gpp_maybe'
}
function trustColor(tr: TrustLevel): string {
  return tr === 'verified' ? 'positive' : tr === 'invalid' ? 'negative' : 'warning'
}
function trustLabel(tr: TrustLevel): string {
  if (tr === 'verified') return t('verify.validCredential')
  if (tr === 'invalid') return t('verify.invalidCredential')
  if (tr === 'self-asserted') return t('verify.selfAssertedCredential')
  return t('verify.unverifiableCredential')
}

onMounted(async () => {
  await nextTick()
  if (videoEl.value) {
    await qr.start(videoEl.value)
  }
})

// Watch for QR result
import { watch } from 'vue'
watch(
  () => qr.result.value,
  async (data) => {
    if (!data) return
    await processQrData(data)
  },
)

async function processQrData(data: string) {
  verifying.value = true
  verifyError.value = ''

  try {
    // Try to parse as JSON (VerifiableCredential or VP)
    let vc: Record<string, unknown>

    try {
      vc = JSON.parse(data)
    } catch {
      // Might be a URL — try fetching
      if (data.startsWith('http')) {
        const res = await fetch(data)
        if (!res.ok) throw new Error(t('verify.invalidUrl'))
        vc = await res.json()
      } else {
        throw new Error(t('verify.unrecognizedQr'))
      }
    }

    // Extract VC fields
    const types = (vc.type as string[]) ?? []
    const mainType = types.find((ty) => ty !== 'VerifiableCredential') ?? types[0] ?? t('common.unknown')
    const issuer = typeof vc.issuer === 'string' ? vc.issuer : (vc.issuer as { name?: string })?.name ?? t('common.unknown')
    const subject = vc.credentialSubject as Record<string, unknown> | undefined
    const holder = (subject?.id as string) ?? t('common.unknown')

    // Check expiration
    const expDate = vc.expirationDate as string | undefined
    const active = !expDate || new Date(expDate) > new Date()

    // Check revocation status
    const revStatus = vc.revocationStatus as string | undefined
    const notRevoked = !revStatus || revStatus === 'valid'

    // Verify Ed25519 signature if proof present
    let signatureStatus: SignatureStatus = 'none'
    const proof = vc.proof as Record<string, unknown> | undefined
    if (proof?.type === 'Ed25519Signature2020' && proof.proofValue) {
      try {
        // Reconstruct the exact signed payload
        const payload = JSON.stringify({
          '@context': vc['@context'],
          type: vc.type,
          issuer: vc.issuer,
          issuanceDate: vc.issuanceDate,
          credentialSubject: vc.credentialSubject,
        })
        const payloadBytes = new TextEncoder().encode(payload)

        // Extract public key from verificationMethod (did:sns:X#key-1 → resolve)
        const vm = proof.verificationMethod as string | undefined
        const proofValue = proof.proofValue as string
        const pubKeyB64 = proof.publicKey as string | undefined

        if (pubKeyB64) {
          // Public key embedded in the proof. A valid signature over an embedded
          // key only proves self-consistency (SOC-10) — it does NOT prove the
          // CLAIMED issuer signed it. Bind the key to the issuer DID: for a
          // did:key issuer the DID *is* the key, so re-encode the verifying key
          // and require it to equal the issuer (and verificationMethod) DID.
          const pubKey = fromBase64url(pubKeyB64)
          const sig = fromBase64url(proofValue)
          if (!ed25519Verify(payloadBytes, sig, pubKey)) {
            signatureStatus = 'invalid'
          } else {
            const issuerDid = typeof vc.issuer === 'string'
              ? vc.issuer
              : (vc.issuer as { id?: string } | undefined)?.id
            const vmDid = vm ? vm.split('#')[0] : undefined
            if (issuerDid && issuerDid.startsWith('did:key:z')) {
              const boundToIssuer =
                didKeyFromEd25519PublicKey(pubKey) === issuerDid && (!vmDid || vmDid === issuerDid)
              // Bound → self-asserted (sound, but a self-generated DID, not an
              // authority). Not bound → the claimed did:key issuer's key does
              // not match the signing key: a forgery.
              signatureStatus = boundToIssuer ? 'self-asserted' : 'invalid'
            } else {
              // did:web / did:sns issuer: resolving that DID is out of scope
              // here, so we cannot confirm the claimed issuer signed this —
              // never present it as 'valid'.
              signatureStatus = 'unverifiable'
            }
          }
        } else if (vm && proofValue) {
          // No embedded key — can't resolve DID yet
          signatureStatus = 'unverifiable'
        }
      } catch {
        signatureStatus = 'invalid'
      }
    }

    // Check anchor
    const anchorTx = (vc as Record<string, unknown>).anchorTx as string | undefined

    // Derive the trust level shown on the card. Expired/revoked/forged → invalid;
    // an issuer-authenticated signature → verified; a self-generated did:key →
    // self-asserted; anything we cannot confirm → unverifiable.
    const trust = computeTrust(active, notRevoked, signatureStatus)

    verifyResult.value = {
      // `valid` means issuer-authenticated. Self-asserted / unverifiable are
      // surfaced via `trust` so the UI does not overclaim authority.
      valid: trust === 'verified',
      trust,
      type: mainType,
      holder,
      issuer: typeof issuer === 'string' ? issuer : t('common.unknown'),
      active: active && notRevoked,
      signatureStatus,
      anchored: !!anchorTx,
      anchorTx,
      raw: vc,
    }
  } catch (e: unknown) {
    verifyError.value = e instanceof Error ? e.message : t('verify.verifyError')
  } finally {
    verifying.value = false
  }
}

async function scanAgain() {
  verifyResult.value = null
  verifyError.value = ''
  qr.reset()
  await nextTick()
  if (videoEl.value) {
    await qr.start(videoEl.value)
  }
}
</script>

<template>
  <q-page class="verify-page" padding>
    <header class="verify-header">
      <q-btn flat round icon="arrow_back" color="white" @click="router.back()" />
      <span class="verify-title">{{ $t('verify.title') }}</span>
    </header>

    <!-- Scanner -->
    <div v-if="!verifyResult && !verifyError" class="scanner-area">
      <video ref="videoEl" class="scanner-video" autoplay playsinline muted />
      <div v-if="qr.error.value" class="scanner-error">
        <q-icon name="videocam_off" size="48px" color="grey-6" />
        <p>{{ qr.error.value }}</p>
      </div>
      <div v-else-if="!qr.scanning.value" class="scanner-frame">
        <q-icon name="qr_code_scanner" size="64px" color="grey-6" />
        <p>{{ $t('verify.scanInstruction') }}</p>
      </div>
      <div class="scanner-overlay">
        <div class="scanner-corners" />
      </div>
    </div>

    <!-- Verifying spinner -->
    <div v-if="verifying" class="verifying">
      <q-spinner-dots size="32px" color="primary" />
      <p>{{ $t('verify.verifying') }}</p>
    </div>

    <!-- Error -->
    <div v-if="verifyError" class="error-card">
      <q-icon name="error_outline" size="32px" color="negative" />
      <p>{{ verifyError }}</p>
      <button class="scan-again-btn" @click="scanAgain">{{ $t('common.retry') }}</button>
    </div>

    <!-- Result -->
    <div v-if="verifyResult" class="result-card" :class="trustCardClass(verifyResult.trust)">
      <div class="result-header">
        <q-icon
          :name="trustIcon(verifyResult.trust)"
          size="32px"
          :color="trustColor(verifyResult.trust)"
        />
        <span class="result-label">
          {{ trustLabel(verifyResult.trust) }}
        </span>
      </div>

      <div class="result-fields">
        <div class="field">
          <span class="field-label">{{ $t('verify.type') }}</span>
          <span class="field-value">{{ verifyResult.type }}</span>
        </div>
        <div class="field">
          <span class="field-label">{{ $t('verify.holder') }}</span>
          <span class="field-value">{{ verifyResult.holder }}</span>
        </div>
        <div class="field">
          <span class="field-label">{{ $t('verify.issuer') }}</span>
          <span class="field-value">{{ verifyResult.issuer }}</span>
        </div>
        <div class="field">
          <span class="field-label">{{ $t('verify.active') }}</span>
          <span class="field-value">{{ verifyResult.active ? $t('common.yes') : $t('common.no') }}</span>
        </div>
        <div class="field">
          <span class="field-label">{{ $t('verify.signature') }}</span>
          <span
            class="field-value"
            :style="{
              color: verifyResult.signatureStatus === 'valid' ? 'var(--success)'
                : verifyResult.signatureStatus === 'invalid' ? 'var(--critical)'
                : verifyResult.signatureStatus === 'self-asserted' ? 'var(--warning, #f59e0b)'
                : 'var(--text-muted)'
            }"
          >
            {{
              verifyResult.signatureStatus === 'valid' ? $t('verify.signatureValid')
              : verifyResult.signatureStatus === 'invalid' ? $t('verify.signatureInvalid')
              : verifyResult.signatureStatus === 'self-asserted' ? $t('verify.signatureSelfAsserted')
              : verifyResult.signatureStatus === 'unverifiable' ? $t('verify.signatureUnverifiable')
              : $t('verify.signatureNone')
            }}
          </span>
        </div>
        <div class="field">
          <span class="field-label">{{ $t('verify.anchor') }}</span>
          <span v-if="verifyResult.anchored" class="field-value">
            <a
              :href="`https://explorer.solana.com/tx/${verifyResult.anchorTx}?cluster=devnet`"
              target="_blank"
              class="anchor-link"
            >
              Solana
            </a>
          </span>
          <span v-else class="field-value" style="color: var(--text-muted)">{{ $t('verify.notAvailable') }}</span>
        </div>
      </div>

      <button class="scan-again-btn" @click="scanAgain">
        {{ $t('verify.scanAnother') }}
      </button>
    </div>
  </q-page>
</template>

<style scoped>
.verify-page {
  display: flex;
  flex-direction: column;
}

.verify-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.verify-title {
  font-size: 18px;
  font-weight: 600;
}

.scanner-area {
  position: relative;
  flex: 1;
  min-height: 300px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.scanner-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.scanner-frame {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  color: var(--text-muted);
  font-size: 14px;
}

.scanner-error {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  color: var(--text-muted);
  font-size: 13px;
}

.scanner-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.scanner-corners {
  width: 200px;
  height: 200px;
  border: 2px solid var(--primary);
  border-radius: var(--radius-md);
  opacity: 0.6;
}

.verifying {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
  color: var(--text-muted);
}

.error-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-xl);
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
}

.result-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: var(--space-lg);
}

.result-card.valid {
  border: 1px solid rgba(74, 222, 128, 0.3);
}

.result-card.invalid {
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.result-card.self-asserted,
.result-card.unverifiable {
  border: 1px solid rgba(245, 158, 11, 0.35);
}

.result-header {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
  margin-bottom: var(--space-lg);
}

.result-label {
  font-size: 16px;
  font-weight: 700;
}

.result-fields {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.field {
  display: flex;
  justify-content: space-between;
  padding: var(--space-xs) 0;
  border-bottom: 1px solid var(--border-subtle);
}

.field-label {
  color: var(--text-muted);
  font-size: 13px;
}

.field-value {
  font-size: 13px;
  font-weight: 500;
}

.anchor-link {
  color: var(--primary);
  text-decoration: none;
}

.scan-again-btn {
  width: 100%;
  margin-top: var(--space-lg);
  padding: var(--space-md);
  background: var(--primary);
  border: none;
  border-radius: var(--radius-md);
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
</style>
