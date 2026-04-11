import type { LlmHandle } from '@attestto/module-sdk'
import type {
  AgreementDraft,
  AgreementType,
  AgreementParty,
  AgreementTerm,
  AgreementAmount,
  AgreementDate,
  ConversationSource,
} from '../types'
import { AGREEMENT_DEFAULT_RISK } from '../types'

// ── LLM Handle ──────────────────────────────────────────────────

let llmHandle: LlmHandle | null = null

export function setLlmHandle(handle: LlmHandle): void {
  llmHandle = handle
}

export function getLlmStatus(): { available: boolean; status: string; supported: boolean } {
  if (!llmHandle) return { available: false, status: 'no-handle', supported: false }
  return {
    available: llmHandle.status() === 'ready',
    status: llmHandle.status(),
    supported: llmHandle.supported,
  }
}

// ── Text Processing ─────────────────────────────────────────────

const MAX_TEXT_LENGTH = 6000

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text
  const half = Math.floor(MAX_TEXT_LENGTH / 2)
  return text.slice(0, half) + '\n\n[...texto truncado...]\n\n' + text.slice(-half)
}

// ── LLM Prompt ──────────────────────────────────────────────────

const SOURCE_HINTS: Record<ConversationSource, string> = {
  whatsapp: 'La conversacion viene de WhatsApp. Los mensajes tienen formato "[fecha, hora] nombre: mensaje".',
  email: 'La conversacion viene de un hilo de correo. Busca cabeceras De:/Para:/Asunto:.',
  voice_transcript: 'Esto es una transcripcion de voz. Puede tener errores de transcripcion.',
  typed: 'El usuario escribio los terminos directamente.',
  other: 'Formato de conversacion no especificado.',
}

function buildAnalysisPrompt(text: string, source: ConversationSource): string {
  const truncated = truncateText(text)

  return `Eres un analizador de conversaciones que extrae acuerdos implicitos y explicitos entre las partes.

${SOURCE_HINTS[source]}

REGLAS:
- Responde SOLO con JSON valido, sin texto adicional
- Identifica todas las partes por nombre e infiere sus roles
- Extrae cada termino concreto con descripcion y valor
- Separa obligaciones por parte
- Detecta montos (distingue CRC vs USD del contexto)
- Detecta fechas y plazos
- Señala ambiguedades: cualquier termino vago o que podria interpretarse de dos maneras
- Sugiere terminos no discutidos que deberian acordarse (propiedad intelectual, penalidades, jurisdiccion, metodo de pago, garantia, terminacion)
- Clasifica el tipo de acuerdo
- Genera resumen de 3-5 oraciones en español llano

TIPOS DE ACUERDO (usa exactamente uno):
service_agreement, freelance_contract, informal_lease, personal_loan, sale_agreement, partnership_agreement, purchase_commitment, verbal_agreement, unknown

FORMATO DE RESPUESTA:
{
  "type": "tipo_de_acuerdo",
  "parties": [{"role": "rol", "name": "nombre"}],
  "terms": [{"description": "descripcion", "value": "valor"}],
  "obligations": ["obligacion 1"],
  "amounts": [{"description": "descripcion", "amount": 5000, "currency": "USD"}],
  "dates": [{"description": "descripcion", "date": "15 junio 2026"}],
  "ambiguities": ["termino ambiguo 1"],
  "undiscussedTerms": ["termino sugerido 1"],
  "summary": "resumen en lenguaje llano"
}

CONVERSACION:
${truncated}

JSON:`
}

// ── Response Parsing ────────────────────────────────────────────

const VALID_TYPES: AgreementType[] = [
  'service_agreement', 'freelance_contract', 'informal_lease', 'personal_loan',
  'sale_agreement', 'partnership_agreement', 'purchase_commitment', 'verbal_agreement', 'unknown',
]

interface RawDraft {
  type?: string
  parties?: { role?: string; name?: string }[]
  terms?: { description?: string; value?: string }[]
  obligations?: string[]
  amounts?: { description?: string; amount?: number; currency?: string }[]
  dates?: { description?: string; date?: string }[]
  ambiguities?: string[]
  undiscussedTerms?: string[]
  summary?: string
}

export function parseAnalysisResponse(text: string): AgreementDraft | null {
  let json = text.trim()

  // Strip markdown fences
  const fenceStart = json.indexOf('```')
  if (fenceStart >= 0) {
    const afterFence = json.indexOf('\n', fenceStart)
    const fenceEnd = json.indexOf('```', afterFence)
    json = json.slice(afterFence + 1, fenceEnd >= 0 ? fenceEnd : undefined).trim()
  }

  const objStart = json.indexOf('{')
  const objEnd = json.lastIndexOf('}')
  if (objStart < 0 || objEnd < 0) return null

  json = json.slice(objStart, objEnd + 1)

  let parsed: RawDraft
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null

  const type = VALID_TYPES.includes(parsed.type as AgreementType)
    ? (parsed.type as AgreementType)
    : 'unknown'

  const parties: AgreementParty[] = Array.isArray(parsed.parties)
    ? parsed.parties.filter((p) => p && p.name).map((p) => ({ role: p.role ?? 'parte', name: p.name! }))
    : []

  const terms: AgreementTerm[] = Array.isArray(parsed.terms)
    ? parsed.terms.filter((t) => t && t.description && t.value).map((t) => ({ description: t.description!, value: t.value! }))
    : []

  const obligations = Array.isArray(parsed.obligations)
    ? parsed.obligations.filter((o): o is string => typeof o === 'string' && o.length > 0)
    : []

  const amounts: AgreementAmount[] = Array.isArray(parsed.amounts)
    ? parsed.amounts
        .filter((a) => a && a.description && typeof a.amount === 'number')
        .map((a) => ({ description: a.description!, amount: a.amount!, currency: a.currency ?? 'USD' }))
    : []

  const dates: AgreementDate[] = Array.isArray(parsed.dates)
    ? parsed.dates.filter((d) => d && d.description && d.date).map((d) => ({ description: d.description!, date: d.date! }))
    : []

  const ambiguities = Array.isArray(parsed.ambiguities)
    ? parsed.ambiguities.filter((a): a is string => typeof a === 'string' && a.length > 0)
    : []

  const undiscussedTerms = Array.isArray(parsed.undiscussedTerms)
    ? parsed.undiscussedTerms.filter((t): t is string => typeof t === 'string' && t.length > 0)
    : []

  const summary = typeof parsed.summary === 'string' && parsed.summary.length > 0
    ? parsed.summary
    : 'No se pudo generar un resumen automatico.'

  return {
    type,
    parties,
    terms,
    obligations,
    amounts,
    dates,
    ambiguities,
    undiscussedTerms,
    summary,
  }
}

// ── Public API ──────────────────────────────────────────────────

export async function analyzeConversation(
  text: string,
  source: ConversationSource,
): Promise<AgreementDraft | null> {
  if (!llmHandle || !llmHandle.supported) return null

  if (llmHandle.status() !== 'ready') {
    try {
      await llmHandle.init()
    } catch {
      return null
    }
  }

  if (llmHandle.status() !== 'ready') return null

  try {
    const prompt = buildAnalysisPrompt(text, source)
    const response = await llmHandle.generate(prompt)
    return parseAnalysisResponse(response)
  } catch {
    return null
  }
}

export function buildManualDraft(type: AgreementType): AgreementDraft {
  return {
    type,
    parties: [],
    terms: [],
    obligations: [],
    amounts: [],
    dates: [],
    ambiguities: [],
    undiscussedTerms: [],
    summary: '',
  }
}
