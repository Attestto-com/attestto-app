import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests for OID4VCI receive + OID4VP present composables.
 *
 * These test the composable logic (state machine, parsing, matching) without
 * DOM rendering. HTTP calls are mocked via vi.stubGlobal('fetch').
 */

// ── Mock crypto before imports ───────────────────────────────────────────────
vi.mock('@/composables/useCrypto', () => ({
  getDID: () => 'did:web:test.holder.id',
  getKeySeed: () => new Uint8Array(32),
  getPrivateKeyBytes: () => new Uint8Array(32),
  getPublicKeyBase64url: () => 'AAAA',
  getVerificationMethod: () => 'did:web:test.holder.id#key-1',
  sign: (payload: Uint8Array) => new Uint8Array(64),
  toBase64url: (b: Uint8Array) => 'base64sig',
  isRegistered: () => true,
  isAuthenticated: () => true,
}))

vi.mock('@/stores/vault', () => ({
  useVaultStore: () => ({
    did: 'did:web:test.holder.id',
    credentials: [
      {
        '@context': ['https://www.w3.org/2018/credentials/v1'],
        type: ['VerifiableCredential', 'CedulaIdentidadCR'],
        id: 'urn:uuid:cedula-test',
        issuer: 'did:web:tse.go.cr',
        issuanceDate: '2026-01-01T00:00:00Z',
        credentialSubject: {
          id: 'did:web:test.holder.id',
          nombre: 'Test',
          cedula: '1-0000-0000',
        },
      },
    ],
    addCredential: vi.fn(),
  }),
}))

import { useCredentialReceive } from '@/composables/useCredentialReceive'
import { usePresentationRequest } from '@/composables/usePresentationRequest'

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ISSUER_METADATA = {
  credential_issuer: 'https://issuer.test.com',
  credential_endpoint: 'https://issuer.test.com/credentials',
  token_endpoint: 'https://issuer.test.com/token',
}

const TOKEN_RESPONSE = {
  access_token: 'test-access-token',
  token_type: 'Bearer',
  c_nonce: 'test-nonce',
}

const CREDENTIAL_RESPONSE = {
  credential: {
    '@context': ['https://www.w3.org/2018/credentials/v1'],
    type: ['VerifiableCredential', 'CedulaIdentidadCR'],
    id: 'urn:uuid:received-001',
    issuer: 'did:web:issuer.test.com',
    issuanceDate: '2026-04-17T00:00:00Z',
    credentialSubject: { id: 'did:web:test.holder.id', nombre: 'Test' },
  },
}

function mockFetch(responses: Record<string, unknown>[]) {
  let callIdx = 0
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => responses[callIdx++] ?? {},
    text: async () => JSON.stringify(responses[callIdx - 1] ?? {}),
  }))
}

// ── OID4VCI Receive Tests ────────────────────────────────────────────────────

describe('useCredentialReceive', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts in idle state', () => {
    const { step } = useCredentialReceive()
    expect(step.value).toBe('idle')
  })

  it('parses a JSON offer and transitions to reviewing', async () => {
    vi.stubGlobal('fetch', mockFetch([ISSUER_METADATA]))

    const { step, offer, handleOffer } = useCredentialReceive()
    await handleOffer(JSON.stringify({
      credential_issuer: 'https://issuer.test.com',
      credential_configuration_ids: ['CedulaIdentidadCR'],
    }))

    expect(step.value).toBe('reviewing')
    expect(offer.value?.credential_issuer).toBe('https://issuer.test.com')
  })

  it('transitions to tx-code when pre-auth with tx_code', async () => {
    vi.stubGlobal('fetch', mockFetch([ISSUER_METADATA]))

    const { step, handleOffer } = useCredentialReceive()
    await handleOffer(JSON.stringify({
      credential_issuer: 'https://issuer.test.com',
      credential_configuration_ids: ['X'],
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': 'abc',
          tx_code: { length: 4 },
        },
      },
    }))

    expect(step.value).toBe('tx-code')
  })

  it('sets error on invalid offer', async () => {
    const { step, error, handleOffer } = useCredentialReceive()
    await handleOffer('not-valid')

    expect(step.value).toBe('error')
    expect(error.value).toBeTruthy()
  })

  it('full accept flow: token exchange → credential → success', async () => {
    vi.stubGlobal('fetch', mockFetch([
      ISSUER_METADATA,     // metadata fetch
      TOKEN_RESPONSE,      // token exchange
      CREDENTIAL_RESPONSE, // credential fetch
    ]))

    const { step, handleOffer, accept, receivedCredentialId } = useCredentialReceive()
    await handleOffer(JSON.stringify({
      credential_issuer: 'https://issuer.test.com',
      credential_configuration_ids: ['CedulaIdentidadCR'],
      grants: {
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': {
          'pre-authorized_code': 'SplxlOBeZQQYbYS6WxSbIA',
        },
      },
    }))

    expect(step.value).toBe('reviewing')
    await accept()
    expect(step.value).toBe('success')
    expect(receivedCredentialId.value).toBe('urn:uuid:received-001')
  })

  it('resets to idle', () => {
    const { step, reset } = useCredentialReceive()
    reset()
    expect(step.value).toBe('idle')
  })
})

// ── OID4VP Presentation Tests ────────────────────────────────────────────────

describe('usePresentationRequest', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('starts in idle state', () => {
    const { step } = usePresentationRequest()
    expect(step.value).toBe('idle')
  })

  it('parses a VP request and matches wallet credentials', async () => {
    const { step, request, matchResult, canPresent, handleRequest } = usePresentationRequest()
    await handleRequest(JSON.stringify({
      response_type: 'vp_token',
      client_id: 'https://verifier.test.com',
      nonce: 'test-nonce',
      response_mode: 'direct_post',
      response_uri: 'https://verifier.test.com/response',
      dcql_query: {
        credentials: [{
          id: 'cedula',
          format: 'ldp_vc',
          meta: { vct_values: ['CedulaIdentidadCR'] },
        }],
      },
    }))

    expect(step.value).toBe('selecting')
    expect(request.value?.client_id).toBe('https://verifier.test.com')
    expect(matchResult.value?.satisfied).toBe(true)
    expect(canPresent.value).toBe(true)
  })

  it('reports unsatisfiable when credential missing', async () => {
    const { canPresent, handleRequest } = usePresentationRequest()
    await handleRequest(JSON.stringify({
      response_type: 'vp_token',
      client_id: 'https://v.com',
      nonce: 'n',
      dcql_query: {
        credentials: [{
          id: 'bank',
          format: 'ldp_vc',
          meta: { vct_values: ['BankAccountVC'] },
        }],
      },
    }))
    expect(canPresent.value).toBe(false)
  })

  it('presents via direct_post', async () => {
    const mockFn = vi.fn(async () => ({ ok: true, status: 200 }))
    vi.stubGlobal('fetch', mockFn)

    const { step, handleRequest, present } = usePresentationRequest()
    await handleRequest(JSON.stringify({
      response_type: 'vp_token',
      client_id: 'https://verifier.test.com',
      nonce: 'test-nonce',
      state: 'state-abc',
      response_mode: 'direct_post',
      response_uri: 'https://verifier.test.com/response',
      dcql_query: {
        credentials: [{
          id: 'cedula',
          format: 'ldp_vc',
          meta: { vct_values: ['CedulaIdentidadCR'] },
        }],
      },
    }))

    await present()
    expect(step.value).toBe('success')
    expect(mockFn).toHaveBeenCalledWith(
      'https://verifier.test.com/response',
      expect.objectContaining({ method: 'POST' }),
    )
  })

  it('extracts verifier name from client_id', async () => {
    const { verifierName, handleRequest } = usePresentationRequest()
    await handleRequest(JSON.stringify({
      response_type: 'vp_token',
      client_id: 'https://verifier.attestto.com',
      nonce: 'n',
      dcql_query: { credentials: [{ id: 'x', format: 'ldp_vc' }] },
    }))
    expect(verifierName.value).toBe('verifier.attestto.com')
  })

  it('sets error on invalid input', async () => {
    const { step, error, handleRequest } = usePresentationRequest()
    await handleRequest('garbage')
    expect(step.value).toBe('error')
    expect(error.value).toBeTruthy()
  })
})
