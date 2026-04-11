import type { VerifiableCredential, ModuleContext } from '@attestto/module-sdk'
import type { AgreementSession, SignedAgreementRecord } from '../types'
import { AGREEMENT_TYPE_LABELS, RISK_LABELS, AGREEMENT_DEFAULT_RISK } from '../types'

let moduleCtx: ModuleContext | null = null

export function setSignerContext(ctx: ModuleContext): void {
  moduleCtx = ctx
}

// ── Agreement Hashing ───────────────────────────────────────────

async function hashAgreement(session: AgreementSession): Promise<string> {
  const activeDraft = session.editedDraft ?? session.draft
  const canonical = JSON.stringify({
    draft: activeDraft,
    conversationText: session.conversationText,
    createdAt: session.createdAt,
  })
  const data = new TextEncoder().encode(canonical)
  const copy = new Uint8Array(data).buffer as ArrayBuffer
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', copy)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ── Sign Agreement ──────────────────────────────────────────────

export async function signAgreement(
  session: AgreementSession,
): Promise<SignedAgreementRecord> {
  if (!moduleCtx) throw new Error('Contexto de modulo no disponible')

  const activeDraft = session.editedDraft ?? session.draft
  if (!activeDraft) throw new Error('No hay borrador para firmar')

  const agreementHash = await hashAgreement(session)
  const now = new Date().toISOString()
  const vcId = `urn:uuid:${globalThis.crypto.randomUUID()}`

  const vc: VerifiableCredential = {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://schema.attestto.com/agreement/v1',
    ],
    type: ['VerifiableCredential', 'ConversationAgreementCredential'],
    id: vcId,
    issuer: { id: 'self' },
    issuanceDate: now,
    credentialSubject: {
      id: '',
      agreementType: activeDraft.type,
      agreementHash,
      partiesCount: activeDraft.parties.length,
      termsCount: activeDraft.terms.length,
      ambiguitiesCount: activeDraft.ambiguities.length,
      conversationSource: session.conversationSource,
      wasEdited: session.editedDraft !== null,
    },
  }

  await moduleCtx.storeCredential(vc)

  const parties = activeDraft.parties.map((p) => p.name).join(' / ')

  return {
    sessionId: session.id,
    agreementType: activeDraft.type,
    agreementHash,
    signature: 'in-vc',
    signedAt: now,
    anchorTx: null,
    vcId,
    partySummary: parties || 'Sin partes identificadas',
  }
}

// ── Audit Trail PDF ─────────────────────────────────────────────

export async function generateAuditPdf(
  session: AgreementSession,
  record: SignedAgreementRecord,
): Promise<void> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const activeDraft = session.editedDraft ?? session.draft
  if (!activeDraft) return

  const margin = 20
  let y = margin

  // ── Header ──
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('Acta de Acuerdo Conversacional', margin, y)
  y += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text('Attestto — Acuerdo desde Conversacion', margin, y)
  y += 8

  doc.setDrawColor(100)
  doc.line(margin, y, 190, y)
  y += 8

  // ── Agreement Info ──
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Acuerdo', margin, y)
  y += 6

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const riskLevel = AGREEMENT_DEFAULT_RISK[activeDraft.type]
  const info = [
    `Tipo: ${AGREEMENT_TYPE_LABELS[activeDraft.type]}`,
    `Riesgo: ${RISK_LABELS[riskLevel]}`,
    `Partes: ${record.partySummary}`,
    `Fuente: ${session.conversationSource}`,
    `Fecha de firma: ${record.signedAt}`,
    `Hash del acuerdo: ${record.agreementHash}`,
    `ID de sesion: ${record.sessionId}`,
  ]
  for (const line of info) {
    doc.text(line, margin, y)
    y += 5
  }
  y += 4

  // ── Summary ──
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Resumen', margin, y)
  y += 6

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  const summaryLines = doc.splitTextToSize(activeDraft.summary, 170)
  doc.text(summaryLines, margin, y)
  y += summaryLines.length * 4 + 4

  // ── Terms ──
  if (activeDraft.terms.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Terminos', margin, y)
    y += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    for (const term of activeDraft.terms) {
      const line = `${term.description}: ${term.value}`
      const wrapped = doc.splitTextToSize(line, 165)
      doc.text(wrapped, margin + 5, y)
      y += wrapped.length * 4 + 2
    }
    y += 2
  }

  // ── Obligations ──
  if (activeDraft.obligations.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Obligaciones', margin, y)
    y += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    for (const ob of activeDraft.obligations) {
      const wrapped = doc.splitTextToSize(`- ${ob}`, 165)
      doc.text(wrapped, margin + 5, y)
      y += wrapped.length * 4 + 1
    }
    y += 2
  }

  // ── Amounts ──
  if (activeDraft.amounts.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Montos', margin, y)
    y += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    for (const a of activeDraft.amounts) {
      doc.text(`${a.description}: ${a.currency} ${a.amount.toLocaleString()}`, margin + 5, y)
      y += 5
    }
    y += 2
  }

  // ── Ambiguities ──
  if (activeDraft.ambiguities.length > 0) {
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text(`Ambiguedades detectadas (${activeDraft.ambiguities.length})`, margin, y)
    y += 6

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    for (const a of activeDraft.ambiguities) {
      const wrapped = doc.splitTextToSize(`[!] ${a}`, 165)
      doc.text(wrapped, margin + 5, y)
      y += wrapped.length * 4 + 1
    }
    y += 2
  }

  // ── Edit note ──
  if (session.editedDraft) {
    doc.setFontSize(9)
    doc.setFont('helvetica', 'italic')
    doc.text('Nota: El usuario modifico el borrador generado por IA antes de firmar.', margin, y)
    y += 6
  }

  // ── Conversation excerpt ──
  if (y < 240) {
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Extracto de la conversacion', margin, y)
    y += 6

    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    const excerpt = session.conversationText.slice(0, 1500)
    const excerptLines = doc.splitTextToSize(excerpt + (session.conversationText.length > 1500 ? '\n[...]' : ''), 170)
    const maxLines = Math.floor((270 - y) / 3.5)
    doc.text(excerptLines.slice(0, maxLines), margin, y)
    y += Math.min(excerptLines.length, maxLines) * 3.5 + 4
  }

  // ── Cryptographic Proof ──
  if (y > 260) { doc.addPage(); y = margin }
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text('Prueba Criptografica', margin, y)
  y += 6

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text(`VC ID: ${record.vcId}`, margin, y); y += 5
  doc.text(`Hash del acuerdo: ${record.agreementHash}`, margin, y); y += 5
  doc.text(`Firmado: ${record.signedAt}`, margin, y); y += 5
  if (record.anchorTx) {
    doc.text(`Solana TX: ${record.anchorTx}`, margin, y); y += 5
  }

  // ── Footer ──
  doc.setFontSize(8)
  doc.setTextColor(100)
  doc.text('Verificar en: https://verify.attestto.com', margin, 280)
  doc.text('Este documento fue generado automaticamente por Attestto.', margin, 284)

  doc.setProperties({
    title: `Acta de Acuerdo - ${record.partySummary}`,
    subject: 'Audit trail de acuerdo conversacional',
    keywords: `agreementHash:${record.agreementHash}`,
  })

  doc.save(`attestto-acta-acuerdo-${record.sessionId.slice(0, 8)}.pdf`)
}
