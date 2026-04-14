import type { VerifiableCredential, ModuleContext } from '@attestto/module-sdk'
import type { SigningSession, SignedDocumentRecord } from '../types'
import { CATEGORY_LABELS, RISK_LABELS } from '../types'

let moduleCtx: ModuleContext | null = null

export function setSignerContext(ctx: ModuleContext): void {
  moduleCtx = ctx
}

// ── PDF Hashing ─────────────────────────────────────────────────

async function hashPdf(pdfBytes: Uint8Array): Promise<string> {
  const copy = new Uint8Array(pdfBytes).buffer as ArrayBuffer
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', copy)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── VC Issuance ─────────────────────────────────────────────────

async function issueDocumentSignatureVC(
  session: SigningSession,
  pdfHash: string,
): Promise<VerifiableCredential> {
  if (!moduleCtx) throw new Error('Contexto de modulo no disponible')

  const now = new Date().toISOString()
  const vcId = `urn:uuid:${globalThis.crypto.randomUUID()}`

  // Get DID from vault — we use getCredentials to infer the user's DID
  // The vault sign function handles biometric gating
  const vc: VerifiableCredential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://schema.attestto.com/doc-signing/v1',
    ],
    type: ['VerifiableCredential', 'DocumentSignatureVC'],
    id: vcId,
    issuer: { id: 'self' },
    issuanceDate: now,
    credentialSubject: {
      id: '', // Will be filled after signing
      documentType: session.analysis?.documentType ?? 'unknown',
      riskLevel: session.analysis?.riskLevel ?? 'high',
      pdfHash,
      fileName: session.fileName,
      questionsAnswered: session.userAnswers.length,
      recommendation: session.recommendation,
      flaggedClausesCount: session.analysis?.flaggedClauses.length ?? 0,
    },
  }

  return { ...vc, _vcId: vcId } as VerifiableCredential & { _vcId: string }
}

// ── Sign Document ───────────────────────────────────────────────

export async function signDocument(
  session: SigningSession,
  pdfBytes: Uint8Array,
): Promise<SignedDocumentRecord> {
  if (!moduleCtx) throw new Error('Contexto de modulo no disponible')

  // 1. Hash the original PDF
  const pdfHash = await hashPdf(pdfBytes)

  // 2. Build the VC
  const vc = await issueDocumentSignatureVC(session, pdfHash)
  const vcId = (vc as VerifiableCredential & { _vcId?: string })._vcId ?? vc.id ?? ''

  // 3. Store credential in vault (this triggers biometric via the shell)
  await moduleCtx.storeCredential(vc)

  // 4. Return the signed record
  return {
    sessionId: session.id,
    fileName: session.fileName,
    documentType: session.analysis?.documentType ?? 'unknown',
    riskLevel: session.analysis?.riskLevel ?? 'high',
    pdfHash,
    signature: vcId, // Signature is embedded in the VC proof, verified via vcId
    verificationMethod: '',
    signedAt: new Date().toISOString(),
    anchorTx: null,
    vcId,
  }
}

// ── Audit Trail PDF ─────────────────────────────────────────────

export async function generateAuditPdf(
  session: SigningSession,
  record: SignedDocumentRecord,
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  const margin = 20
  let y = margin

  // ── Header ──
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Acta de Firma Digital', margin, y)
  y += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Attestto — Firma Inteligente de Documentos', margin, y)
  y += 8

  // ── Separator ──
  doc.setDrawColor(100)
  doc.line(margin, y, 190, y)
  y += 8

  // ── Document Info ──
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Documento', margin, y)
  y += 6

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const docType = session.analysis?.documentType
    ? CATEGORY_LABELS[session.analysis.documentType]
    : 'No clasificado'
  const risk = session.analysis?.riskLevel
    ? RISK_LABELS[session.analysis.riskLevel]
    : 'No evaluado'

  const info = [
    `Archivo: ${record.fileName}`,
    `Tipo: ${docType}`,
    `Nivel de riesgo: ${risk}`,
    `Hash SHA-256: ${record.pdfHash}`,
    `Fecha de firma: ${record.signedAt}`,
    `ID de sesion: ${record.sessionId}`,
  ]

  for (const line of info) {
    doc.text(line, margin, y)
    y += 5
  }
  y += 4

  // ── Analysis Summary ──
  if (session.analysis) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Analisis Pre-Firma (IA)', margin, y)
    y += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    const summaryLines = doc.splitTextToSize(session.analysis.plainLanguageSummary, 170)
    doc.text(summaryLines, margin, y)
    y += summaryLines.length * 4 + 4

    // Flagged clauses
    if (session.analysis.flaggedClauses.length > 0) {
      doc.setFont('helvetica', 'bold')
      doc.text(`Clausulas señaladas (${session.analysis.flaggedClauses.length}):`, margin, y)
      y += 5
      doc.setFont('helvetica', 'normal')

      for (const clause of session.analysis.flaggedClauses) {
        const severity = clause.severity === 'critical' ? '[CRITICO]'
          : clause.severity === 'warning' ? '[ATENCION]'
          : '[INFO]'
        const line = `${severity} ${clause.concern}`
        const wrapped = doc.splitTextToSize(line, 165)
        doc.text(wrapped, margin + 5, y)
        y += wrapped.length * 4 + 2
      }
      y += 2
    }
  }

  // ── User Q&A ──
  if (session.userAnswers.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Preguntas y Respuestas del Firmante', margin, y)
    y += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')

    for (const answer of session.userAnswers) {
      const question = session.analysis?.questions.find((q) => q.id === answer.questionId)
      if (question) {
        doc.setFont('helvetica', 'bold')
        const qLines = doc.splitTextToSize(`P: ${question.text}`, 165)
        doc.text(qLines, margin + 5, y)
        y += qLines.length * 4

        doc.setFont('helvetica', 'normal')
        const aLines = doc.splitTextToSize(`R: ${answer.answer}`, 165)
        doc.text(aLines, margin + 5, y)
        y += aLines.length * 4 + 3
      }
    }
    y += 2
  }

  // ── Recommendation ──
  if (session.recommendation) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    const recLabel = session.recommendation === 'sign' ? 'Firmar directamente'
      : session.recommendation === 'review' ? 'Buscar revisor (el firmante procedio sin revisor)'
      : 'Buscar asesoria legal (el firmante procedio sin asesoria)'
    doc.text(`Recomendacion del sistema: ${recLabel}`, margin, y)
    y += 8
  }

  // ── Cryptographic Proof ──
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Prueba Criptografica', margin, y)
  y += 6

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const proofLines = [
    `VC ID: ${record.vcId}`,
    `Hash del documento: ${record.pdfHash}`,
    `Firmado: ${record.signedAt}`,
  ]
  if (record.anchorTx) {
    proofLines.push(`Solana TX: ${record.anchorTx}`)
  }

  for (const line of proofLines) {
    doc.text(line, margin, y)
    y += 5
  }
  y += 6

  // ── Footer ──
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Verificar en: https://verify.attestto.com', margin, 280)
  doc.text('Este documento fue generado automaticamente por Attestto.', margin, 284)

  // ── Metadata ──
  doc.setProperties({
    title: `Acta de Firma - ${record.fileName}`,
    subject: 'Audit trail de firma digital',
    keywords: `pdfHash:${record.pdfHash}`,
  })

  doc.save(`attestto-acta-firma-${record.sessionId.slice(0, 8)}.pdf`)
}
