/**
 * OID4VCI credential receive flow.
 *
 * Handles: scan QR → parse offer → fetch metadata → exchange token → get credential → store in vault.
 * Uses @attestto/vc-sdk parsers; HTTP calls done via fetch().
 */

import { ref } from 'vue'
import {
  parseCredentialOffer,
  hasPreAuthorizedCode,
  requiresTxCode,
  getIssuerMetadataUrl,
  parseIssuerMetadata,
  getTokenEndpoint,
  buildPreAuthorizedTokenRequest,
  encodeTokenRequest,
  parseTokenResponse,
  buildProofJwt,
  buildCredentialRequest,
  parseCredentialResponse,
  PRE_AUTHORIZED_CODE_GRANT,
} from '@attestto/vc-sdk'
import type {
  CredentialOfferPayload,
  IssuerMetadata,
  TokenResponse,
} from '@attestto/vc-sdk'
import { useVaultStore } from '@/stores/vault'
import * as crypto from '@/composables/useCrypto'

export type ReceiveStep = 'idle' | 'parsing' | 'reviewing' | 'tx-code' | 'exchanging' | 'success' | 'error'

export function useCredentialReceive() {
  const step = ref<ReceiveStep>('idle')
  const offer = ref<CredentialOfferPayload | null>(null)
  const issuerMeta = ref<IssuerMetadata | null>(null)
  const error = ref<string | null>(null)
  const receivedCredentialId = ref<string | null>(null)

  /** Step 1: Parse a credential offer from QR content or deep link */
  async function handleOffer(input: string) {
    step.value = 'parsing'
    error.value = null

    try {
      const parsed = parseCredentialOffer(input)
      offer.value = parsed.payload

      // Fetch issuer metadata
      const metaUrl = getIssuerMetadataUrl(parsed.payload.credential_issuer)
      const metaRes = await fetch(metaUrl)
      if (!metaRes.ok) {
        throw new Error(`Issuer metadata fetch failed: ${metaRes.status}`)
      }
      issuerMeta.value = parseIssuerMetadata(await metaRes.json())

      // If pre-auth with tx_code required, go to pin entry
      if (hasPreAuthorizedCode(parsed.payload) && requiresTxCode(parsed.payload)) {
        step.value = 'tx-code'
      } else {
        step.value = 'reviewing'
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      step.value = 'error'
    }
  }

  /** Step 2: Accept the offer and exchange for credential */
  async function accept(txCode?: string) {
    if (!offer.value || !issuerMeta.value) return

    step.value = 'exchanging'
    error.value = null

    try {
      const vault = useVaultStore()
      if (!vault.did) throw new Error('Vault locked')

      // Token exchange (pre-authorized code flow)
      const tokenReq = buildPreAuthorizedTokenRequest(offer.value, txCode)
      const tokenUrl = getTokenEndpoint(issuerMeta.value)
      const tokenRes = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: encodeTokenRequest(tokenReq),
      })

      const tokenData = parseTokenResponse(await tokenRes.json())

      // Build proof of possession if c_nonce provided
      let proofJwt: string | undefined
      if (tokenData.c_nonce) {
        const keySeed = crypto.getKeySeed()
        const privKey = crypto.getPrivateKeyBytes()
        proofJwt = buildProofJwt({
          holderDid: vault.did,
          issuerUrl: offer.value.credential_issuer,
          nonce: tokenData.c_nonce,
          privateKey: privKey,
          algorithm: 'Ed25519',
        })
      }

      // Fetch credential
      const credReq = buildCredentialRequest(
        offer.value.credential_configuration_ids[0],
        proofJwt,
      )
      const credRes = await fetch(issuerMeta.value.credential_endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenData.access_token}`,
        },
        body: JSON.stringify(credReq),
      })

      const credData = parseCredentialResponse(await credRes.json())

      // Extract the credential (single or batch)
      const rawCred = credData.credential ?? credData.credentials?.[0]?.credential
      if (!rawCred) {
        throw new Error('No credential in response')
      }

      // Store in vault
      const vc = typeof rawCred === 'string' ? JSON.parse(rawCred) : rawCred
      await vault.addCredential(vc)
      receivedCredentialId.value = vc.id ?? null

      step.value = 'success'
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      step.value = 'error'
    }
  }

  function reset() {
    step.value = 'idle'
    offer.value = null
    issuerMeta.value = null
    error.value = null
    receivedCredentialId.value = null
  }

  return {
    step,
    offer,
    issuerMeta,
    error,
    receivedCredentialId,
    handleOffer,
    accept,
    reset,
  }
}
