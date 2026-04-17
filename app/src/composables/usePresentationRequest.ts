/**
 * OID4VP credential presentation flow.
 *
 * Handles: scan QR → parse request → match wallet credentials → user selects → build VP → submit.
 * Uses @attestto/vc-sdk parsers + builder; HTTP submission via fetch().
 */

import { ref, computed } from 'vue'
import {
  parseAuthorizationRequest,
  isDirectPost,
  matchCredentials,
  buildPresentation,
  buildDirectPostBody,
  encodeDirectPostBody,
} from '@attestto/vc-sdk'
import type {
  AuthorizationRequest,
  DcqlMatchResult,
  VerifiableCredential as VcSdkCredential,
} from '@attestto/vc-sdk'
import type { VerifiableCredential } from '@attestto/module-sdk'
import { useVaultStore } from '@/stores/vault'
import * as crypto from '@/composables/useCrypto'

export type PresentStep = 'idle' | 'parsing' | 'selecting' | 'presenting' | 'success' | 'error'

export function usePresentationRequest() {
  const step = ref<PresentStep>('idle')
  const request = ref<AuthorizationRequest | null>(null)
  const matchResult = ref<DcqlMatchResult | null>(null)
  const error = ref<string | null>(null)
  const verifierName = ref<string | null>(null)

  const canPresent = computed(() => matchResult.value?.satisfied === true)

  /** Step 1: Parse a VP request from QR content or deep link */
  async function handleRequest(input: string) {
    step.value = 'parsing'
    error.value = null

    try {
      const parsed = parseAuthorizationRequest(input)

      // JAR by reference — need to fetch
      if (parsed.source === 'request_uri' && parsed.request.request_uri) {
        const method = parsed.request.request_uri_method ?? 'get'
        const jarRes = method === 'post'
          ? await fetch(parsed.request.request_uri, { method: 'POST' })
          : await fetch(parsed.request.request_uri)

        if (!jarRes.ok) throw new Error(`Failed to fetch authorization request: ${jarRes.status}`)

        // Re-parse the fetched JAR content
        const jarContent = await jarRes.text()
        const fullParsed = parseAuthorizationRequest(jarContent)
        request.value = fullParsed.request
      } else {
        request.value = parsed.request
      }

      // Extract verifier name from client_id or client_metadata
      verifierName.value = request.value.client_metadata?.client_name as string
        ?? new URL(request.value.client_id).hostname

      // Match wallet credentials against DCQL query
      if (request.value.dcql_query) {
        const vault = useVaultStore()
        matchResult.value = matchCredentials(
          request.value.dcql_query,
          vault.credentials as unknown as VcSdkCredential[],
        )
      }

      step.value = 'selecting'
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      step.value = 'error'
    }
  }

  /** Step 2: Present selected credentials to the verifier */
  async function present() {
    if (!request.value || !matchResult.value?.satisfied) return

    step.value = 'presenting'
    error.value = null

    try {
      const vault = useVaultStore()
      if (!vault.did) throw new Error('Vault locked')

      // Collect matched credentials (first match per query)
      const selected: VcSdkCredential[] = []
      const queryIds: string[] = []

      for (const cq of request.value.dcql_query!.credentials) {
        const matched = matchResult.value.matches.get(cq.id)
        if (matched && matched.length > 0) {
          selected.push(matched[0])
          queryIds.push(cq.id)
        }
      }

      // Build + sign VP
      const privKey = crypto.getPrivateKeyBytes()
      const vp = buildPresentation(selected, {
        holderDid: vault.did,
        privateKey: privKey,
        algorithm: 'Ed25519',
        nonce: request.value.nonce,
        domain: request.value.client_id,
      })

      // Submit via direct_post
      if (isDirectPost(request.value) && request.value.response_uri) {
        const body = buildDirectPostBody(vp, request.value, queryIds)
        const res = await fetch(request.value.response_uri, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: encodeDirectPostBody(body),
        })

        if (!res.ok) {
          const errBody = await res.text()
          throw new Error(`Verifier rejected presentation: ${res.status} ${errBody}`)
        }
      }

      step.value = 'success'
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      step.value = 'error'
    }
  }

  function reset() {
    step.value = 'idle'
    request.value = null
    matchResult.value = null
    error.value = null
    verifierName.value = null
  }

  return {
    step,
    request,
    matchResult,
    error,
    verifierName,
    canPresent,
    handleRequest,
    present,
    reset,
  }
}
