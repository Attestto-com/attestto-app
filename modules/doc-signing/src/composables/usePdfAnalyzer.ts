import type { LlmHandle } from '@attestto/module-sdk'
import type {
  DocumentAnalysis,
  DocumentCategory,
  RiskLevel,
  FlaggedClause,
  AnalysisQuestion,
} from '../types'
import { CATEGORY_DEFAULT_RISK } from '../types'

// ── LLM Handle (set by module install) ──────────────────────────

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

// ── PDF Text Extraction ─────────────────────────────────────────

/**
 * Extract text from a PDF using pdfjs-dist.
 * Returns concatenated text from all pages (max 20 pages).
 */
export async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`
  }

  const doc = await pdfjsLib.getDocument({ data: pdfBytes }).promise
  const maxPages = Math.min(doc.numPages, 20)
  const pages: string[] = []

  for (let i = 1; i <= maxPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => 'str' in item ? (item as { str: string }).str : '')
      .join(' ')
    pages.push(text)
  }

  return pages.join('\n\n')
}

// ── LLM Analysis ────────────────────────────────────────────────

const MAX_TEXT_LENGTH = 4000

function truncateText(text: string): string {
  if (text.length <= MAX_TEXT_LENGTH) return text
  const half = Math.floor(MAX_TEXT_LENGTH / 2)
  return text.slice(0, half) + '\n\n[...texto truncado...]\n\n' + text.slice(-half)
}

function buildAnalysisPrompt(text: string): string {
  const truncated = truncateText(text)

  return `Eres un analizador de documentos legales. Analiza el siguiente documento y responde SOLO con un JSON valido.

CATEGORIAS DE DOCUMENTO (usa exactamente uno):
govt_form_standard, govt_form_sensitive, nda, service_agreement_short, employment_contract, lease_short, lease_long, commercial_contract, real_estate_deed, corporate_document, loan_agreement, unknown

NIVELES DE RIESGO: low, medium, high, critical

REGLAS:
- Responde SOLO con JSON, sin texto adicional
- El resumen debe ser en español, lenguaje llano, 3-5 oraciones
- Las preguntas deben ser especificas al contenido del documento
- Identifica clausulas que puedan ser desfavorables para el firmante
- Severidad de clausulas: info (informativo), warning (atencion), critical (riesgoso)

FORMATO DE RESPUESTA:
{
  "documentType": "categoria",
  "riskLevel": "nivel",
  "parties": [{"role": "rol", "name": "nombre"}],
  "obligations": ["obligacion 1"],
  "penalties": ["penalidad 1"],
  "flaggedClauses": [{"clause": "texto", "concern": "explicacion", "severity": "warning"}],
  "plainLanguageSummary": "resumen en lenguaje llano",
  "questions": [{"id": "q1", "text": "pregunta especifica"}]
}

DOCUMENTO:
${truncated}

JSON:`
}

interface RawAnalysis {
  documentType?: string
  riskLevel?: string
  parties?: { role?: string; name?: string }[]
  obligations?: string[]
  penalties?: string[]
  flaggedClauses?: { clause?: string; concern?: string; severity?: string }[]
  plainLanguageSummary?: string
  questions?: { id?: string; text?: string }[]
}

const VALID_CATEGORIES: DocumentCategory[] = [
  'govt_form_standard', 'govt_form_sensitive', 'nda', 'service_agreement_short',
  'employment_contract', 'lease_short', 'lease_long', 'commercial_contract',
  'real_estate_deed', 'corporate_document', 'loan_agreement', 'unknown',
]

const VALID_RISKS: RiskLevel[] = ['low', 'medium', 'high', 'critical']
const VALID_SEVERITIES = ['info', 'warning', 'critical'] as const

function parseAnalysisResponse(text: string): DocumentAnalysis | null {
  let json = text.trim()

  // Strip markdown fences
  const fenceStart = json.indexOf('```')
  if (fenceStart >= 0) {
    const afterFence = json.indexOf('\n', fenceStart)
    const fenceEnd = json.indexOf('```', afterFence)
    json = json.slice(afterFence + 1, fenceEnd >= 0 ? fenceEnd : undefined).trim()
  }

  // Find JSON object bounds
  const objStart = json.indexOf('{')
  const objEnd = json.lastIndexOf('}')
  if (objStart < 0 || objEnd < 0) return null

  json = json.slice(objStart, objEnd + 1)

  let parsed: RawAnalysis
  try {
    parsed = JSON.parse(json)
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null

  // Validate and normalize
  const docType = VALID_CATEGORIES.includes(parsed.documentType as DocumentCategory)
    ? (parsed.documentType as DocumentCategory)
    : 'unknown'

  const riskLevel = VALID_RISKS.includes(parsed.riskLevel as RiskLevel)
    ? (parsed.riskLevel as RiskLevel)
    : CATEGORY_DEFAULT_RISK[docType]

  const parties = Array.isArray(parsed.parties)
    ? parsed.parties
        .filter((p) => p && p.name)
        .map((p) => ({ role: p.role ?? 'parte', name: p.name! }))
    : []

  const obligations = Array.isArray(parsed.obligations)
    ? parsed.obligations.filter((o): o is string => typeof o === 'string')
    : []

  const penalties = Array.isArray(parsed.penalties)
    ? parsed.penalties.filter((p): p is string => typeof p === 'string')
    : []

  const flaggedClauses: FlaggedClause[] = Array.isArray(parsed.flaggedClauses)
    ? parsed.flaggedClauses
        .filter((c) => c && c.clause && c.concern)
        .map((c) => ({
          clause: c.clause!,
          concern: c.concern!,
          severity: VALID_SEVERITIES.includes(c.severity as typeof VALID_SEVERITIES[number])
            ? (c.severity as FlaggedClause['severity'])
            : 'info',
          legalRef: undefined,
        }))
    : []

  const summary = typeof parsed.plainLanguageSummary === 'string'
    ? parsed.plainLanguageSummary
    : 'No se pudo generar un resumen automatico.'

  const questions: AnalysisQuestion[] = Array.isArray(parsed.questions)
    ? parsed.questions
        .filter((q) => q && q.text)
        .map((q, i) => ({ id: q.id ?? `q${i + 1}`, text: q.text! }))
    : []

  return {
    documentType: docType,
    riskLevel,
    parties,
    obligations,
    penalties,
    flaggedClauses,
    plainLanguageSummary: summary,
    questions,
  }
}

/**
 * Analyze a document using the on-device LLM.
 * Returns null if LLM is unavailable or returns invalid output.
 */
export async function analyzeDocument(text: string): Promise<DocumentAnalysis | null> {
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
    const prompt = buildAnalysisPrompt(text)
    const response = await llmHandle.generate(prompt)
    return parseAnalysisResponse(response)
  } catch {
    return null
  }
}

/**
 * Build a minimal manual analysis from user-provided classification.
 */
export function buildManualAnalysis(
  documentType: DocumentCategory,
  summary: string,
): DocumentAnalysis {
  return {
    documentType,
    riskLevel: CATEGORY_DEFAULT_RISK[documentType],
    parties: [],
    obligations: [],
    penalties: [],
    flaggedClauses: [],
    plainLanguageSummary: summary || 'Documento clasificado manualmente.',
    questions: getDefaultQuestions(documentType),
  }
}

function getDefaultQuestions(category: DocumentCategory): AnalysisQuestion[] {
  const base: AnalysisQuestion[] = [
    { id: 'q-data', text: '¿Los datos personales en el documento (nombre, cedula, direccion) son correctos?' },
  ]

  switch (category) {
    case 'govt_form_standard':
      base.push({ id: 'q-values', text: '¿Los valores declarados son exactos y veridicos?' })
      return base

    case 'nda':
      base.push(
        { id: 'q-scope', text: '¿Entiendes que informacion se define como "confidencial" en este acuerdo?' },
        { id: 'q-duration', text: '¿Estas de acuerdo con el plazo de confidencialidad establecido?' },
      )
      return base

    case 'employment_contract':
      base.push(
        { id: 'q-salary', text: '¿El salario indicado coincide con lo acordado verbalmente?' },
        { id: 'q-schedule', text: '¿La jornada laboral y horario descritos corresponden a lo esperado?' },
        { id: 'q-noncompete', text: '¿Hay clausula de no competencia? ¿Entiendes sus implicaciones?' },
      )
      return base

    case 'lease_short':
    case 'lease_long':
      base.push(
        { id: 'q-amount', text: '¿El monto mensual es el que negociaste con el arrendador?' },
        { id: 'q-termination', text: '¿Entiendes las condiciones para terminar el contrato anticipadamente?' },
        { id: 'q-renewal', text: '¿Hay clausula de renovacion automatica? ¿Sabes cuantos dias antes debes avisar?' },
      )
      return base

    case 'real_estate_deed':
      base.push(
        { id: 'q-folio', text: '¿El folio real corresponde exactamente a la propiedad?' },
        { id: 'q-price', text: '¿El precio declarado es el precio real de la transaccion?' },
        { id: 'q-liens', text: '¿Verificaste que no hay hipotecas o gravamenes vigentes?' },
        { id: 'q-irreversible', text: '¿Entiendes que esta escritura es irreversible salvo acuerdo mutuo o resolucion judicial?' },
      )
      return base

    case 'loan_agreement':
      base.push(
        { id: 'q-rate', text: '¿La tasa de interes es la que acordaste?' },
        { id: 'q-payments', text: '¿Entiendes la cuota mensual y por cuantos meses?' },
        { id: 'q-guarantee', text: '¿Hay garantia real (hipoteca, prenda) sobre algun bien tuyo?' },
      )
      return base

    default:
      base.push(
        { id: 'q-terms', text: '¿Has leido y entendido los terminos principales del documento?' },
        { id: 'q-obligations', text: '¿Tienes claro cuales son tus obligaciones al firmar?' },
      )
      return base
  }
}
