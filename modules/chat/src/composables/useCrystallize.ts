/**
 * Crystallize flow — turn a conversation into a legally binding agreement.
 *
 * Steps:
 * 1. Select message range
 * 2. Claude API extracts terms
 * 3. Review card shown to all parties
 * 4. Each party: Accept / Edit / Reject
 * 5. Liveness gate (WebAuthn biometric per signer)
 * 6. PresenceCredential issued per signer
 * 7. AgreementCredential issued with multi-party signatures
 * 8. Anchored via Attestto Pay ($1)
 */

import { ref } from 'vue'
import type { ChatMessage } from '../types.js'
import { getChatContext } from './useChatContext.js'

// ── Types ────────────────────────────────────────────────────────────

export interface ExtractedTerms {
  parties: Array<{ did: string; role: string }>
  terms: Array<{
    obligation: string
    responsibleParty: string
    deadline?: string
    amount?: { value: number; currency: string }
    conditions?: string[]
  }>
  summary: string
}

export type CrystallizeStep =
  | 'idle'
  | 'selecting'
  | 'extracting'
  | 'reviewing'
  | 'signing'
  | 'anchoring'
  | 'complete'
  | 'error'

// ── State ────────────────────────────────────────────────────────────

const step = ref<CrystallizeStep>('idle')
const extractedTerms = ref<ExtractedTerms | null>(null)
const error = ref<string | null>(null)

// ── Term Extraction ──────────────────────────────────────────────────

/**
 * Extract agreement terms from a range of messages using AI.
 * In production, this calls the Claude API. For now, it uses the on-device LLM
 * or a structured extraction prompt.
 */
export async function extractTerms(
  messages: ChatMessage[],
  channelParticipants: string[]
): Promise<ExtractedTerms> {
  step.value = 'extracting'

  const transcript = messages
    .map((m) => `[${m.from}] ${m.body}`)
    .join('\n')

  const prompt = `Analyze this negotiation transcript and extract the agreement terms.

TRANSCRIPT:
${transcript}

PARTICIPANTS: ${channelParticipants.join(', ')}

Extract:
1. Each party and their role (buyer, seller, tenant, landlord, service provider, client, etc.)
2. Each obligation (who must do what)
3. Any monetary amounts with currency
4. Any deadlines
5. Any conditions

Respond in this exact JSON format:
{
  "parties": [{"did": "...", "role": "..."}],
  "terms": [{"obligation": "...", "responsibleParty": "...", "deadline": "...", "amount": {"value": 0, "currency": "USD"}, "conditions": ["..."]}],
  "summary": "One paragraph summary of the agreement"
}`

  try {
    const ctx = getChatContext()

    // Try on-device LLM first
    if (ctx.llm.supported && ctx.llm.status() === 'ready') {
      const response = await ctx.llm.generate(prompt)
      const parsed = parseTermsResponse(response, channelParticipants)
      extractedTerms.value = parsed
      step.value = 'reviewing'
      return parsed
    }

    // Fallback: manual extraction from message patterns
    const parsed = manualExtract(messages, channelParticipants)
    extractedTerms.value = parsed
    step.value = 'reviewing'
    return parsed
  } catch (e) {
    error.value = (e as Error).message
    step.value = 'error'
    throw e
  }
}

/**
 * After review and acceptance, perform the liveness gate + signing.
 */
export async function signAgreement(
  terms: ExtractedTerms,
  channelId: string,
  messageRange: [string, string],
  messageCount: number,
  conversationHash: string
): Promise<{ agreementId: string }> {
  step.value = 'signing'

  const ctx = getChatContext()

  try {
    // Liveness gate — biometric confirmation
    const livenessOk = await ctx.requestBiometric(
      'Confirma tu identidad para firmar este acuerdo legalmente vinculante'
    )
    if (!livenessOk) {
      step.value = 'reviewing'
      throw new Error('Biometric verification failed')
    }

    // Build the credential claims
    const claims = {
      parties: terms.parties,
      terms: terms.terms,
      conversationRef: {
        channelId,
        messageRange,
        messageCount,
        hash: conversationHash,
      },
      presenceProofs: [{
        signer: ctx.getDID(),
        presenceCredentialHash: 'pending-other-party',
        method: 'device-biometric' as const,
        timestamp: new Date().toISOString(),
      }],
      extractedBy: 'ai' as const,
      reviewedBy: [ctx.getDID()],
    }

    // Sign the agreement
    const signPayload = JSON.stringify(claims)
    const { signature } = await ctx.sign(signPayload)

    // Store the partially-signed agreement for the other party to co-sign
    const agreementId = crypto.randomUUID()
    await ctx.storage.set(`agreement:${agreementId}`, {
      id: agreementId,
      claims,
      signatures: [{ did: ctx.getDID(), signature }],
      status: 'pending-cosign',
      channelId,
      createdAt: new Date().toISOString(),
    })

    step.value = 'complete'
    return { agreementId }
  } catch (e) {
    if (step.value !== 'reviewing') {
      error.value = (e as Error).message
      step.value = 'error'
    }
    throw e
  }
}

/**
 * Reset the crystallize flow.
 */
export function resetCrystallize(): void {
  step.value = 'idle'
  extractedTerms.value = null
  error.value = null
}

/**
 * Vue composable for the crystallize flow.
 */
export function useCrystallize() {
  return {
    step,
    extractedTerms,
    error,
    extractTerms,
    signAgreement,
    resetCrystallize,
  }
}

// ── Internal helpers ─────────────────────────────────────────────────

function parseTermsResponse(response: string, participants: string[]): ExtractedTerms {
  try {
    // Try to extract JSON from the response
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      return {
        parties: parsed.parties || participants.map((p: string) => ({ did: p, role: 'party' })),
        terms: parsed.terms || [],
        summary: parsed.summary || '',
      }
    }
  } catch {
    // fallthrough to manual
  }
  return manualExtract([], participants)
}

/**
 * Manual fallback: extract basic structure when LLM is unavailable.
 * Presents all participants as parties with generic roles.
 * Terms must be filled in manually by the user during review.
 */
function manualExtract(messages: ChatMessage[], participants: string[]): ExtractedTerms {
  return {
    parties: participants.map((did) => ({ did, role: 'parte' })),
    terms: [],
    summary: messages.length > 0
      ? `Acuerdo basado en ${messages.length} mensajes de negociación.`
      : 'Acuerdo pendiente de definir términos.',
  }
}
