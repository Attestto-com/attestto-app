/**
 * useEvidencePdf — PDF evidence export with embedded hashes (ATT-404).
 *
 * Generates a tamper-evident PDF containing:
 * - Exam results (score, categories, pass/fail)
 * - Hash chain head (SHA-256)
 * - Incident summary
 * - Proof signatures (user + station)
 * - Solana anchor TX (if available)
 */
import { jsPDF } from 'jspdf'
import type { ExamResult } from '../types'

interface PdfOptions {
  sessionId: string
  userDid: string
  stationDid?: string
  anchorTx?: string
  vcId?: string
}

export function generateEvidencePdf(result: ExamResult, options: PdfOptions): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20

  // ── Header ───────────────────────────────────────────
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('ATTESTTO', pageWidth / 2, y, { align: 'center' })
  y += 8

  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Acta de Evidencia — Examen Teorico de Conduccion', pageWidth / 2, y, { align: 'center' })
  y += 12

  // ── Session info ─────────────────────────────────────
  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Informacion de Sesion', 15, y)
  y += 6
  doc.setFont('helvetica', 'normal')

  const sessionInfo = [
    ['ID de Sesion:', options.sessionId],
    ['Fecha:', new Date().toISOString().slice(0, 19).replace('T', ' ')],
    ['DID del Sustentante:', truncate(options.userDid, 50)],
    ['Duracion:', `${Math.floor(result.durationSeconds / 60)}m ${result.durationSeconds % 60}s`],
  ]
  if (options.stationDid) {
    sessionInfo.push(['DID de Estacion:', truncate(options.stationDid, 50)])
  }

  for (const [label, value] of sessionInfo) {
    doc.setFont('helvetica', 'bold')
    doc.text(label, 15, y)
    doc.setFont('helvetica', 'normal')
    doc.text(value, 65, y)
    y += 5
  }
  y += 5

  // ── Result ───────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.text('Resultado', 15, y)
  y += 6
  doc.setFont('helvetica', 'normal')

  const status = result.passed ? 'APROBADO' : 'REPROBADO'
  doc.setFont('helvetica', 'bold')
  doc.text(`Estado: ${status}`, 15, y)
  doc.setFont('helvetica', 'normal')
  y += 5
  doc.text(`Puntaje: ${result.score}% (${result.correct}/${result.total})`, 15, y)
  y += 5
  doc.text(`Incidentes: ${result.incidents.length}`, 15, y)
  y += 8

  // ── Category breakdown ───────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.text('Desglose por Categoria', 15, y)
  y += 6
  doc.setFont('helvetica', 'normal')

  // Table header
  doc.setFont('helvetica', 'bold')
  doc.text('Categoria', 15, y)
  doc.text('Correctas', 100, y)
  doc.text('Total', 130, y)
  doc.text('%', 155, y)
  doc.setFont('helvetica', 'normal')
  y += 1
  doc.line(15, y, 170, y)
  y += 4

  for (const cat of result.categoryBreakdown) {
    doc.text(truncate(cat.category, 40), 15, y)
    doc.text(String(cat.correct), 105, y)
    doc.text(String(cat.total), 133, y)
    doc.text(`${cat.percent}%`, 155, y)
    y += 5
  }
  y += 5

  // ── Incidents ────────────────────────────────────────
  if (result.incidents.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.text('Registro de Incidentes', 15, y)
    y += 6
    doc.setFont('helvetica', 'normal')

    for (const inc of result.incidents) {
      const time = new Date(inc.timestamp).toISOString().slice(11, 19)
      doc.text(`[${time}] ${inc.type} (${inc.severity}) x${inc.count}`, 15, y)
      y += 5
    }
    y += 5
  }

  // ── Cryptographic proof ──────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.text('Prueba Criptografica', 15, y)
  y += 6
  doc.setFont('helvetica', 'normal')

  doc.text('Hash Chain (SHA-256):', 15, y)
  y += 5
  doc.setFontSize(8)
  doc.setFont('courier', 'normal')
  doc.text(result.chainHead, 15, y)
  y += 6
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  if (options.anchorTx) {
    doc.text('Transaccion Solana:', 15, y)
    y += 5
    doc.setFontSize(8)
    doc.setFont('courier', 'normal')
    doc.text(options.anchorTx, 15, y)
    y += 6
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
  }

  if (options.vcId) {
    doc.text(`Credencial: ${options.vcId}`, 15, y)
    y += 8
  }

  // ── Footer ───────────────────────────────────────────
  doc.setFontSize(8)
  doc.setFont('helvetica', 'italic')
  doc.text(
    'Este documento fue generado automaticamente por Attestto. La integridad se verifica mediante la cadena de hashes SHA-256 y el anclaje en Solana.',
    pageWidth / 2, 280,
    { align: 'center', maxWidth: 170 },
  )
  doc.text('https://verify.attestto.com', pageWidth / 2, 288, { align: 'center' })

  // ── Embed hash in PDF metadata ───────────────────────
  doc.setProperties({
    title: `Attestto Evidence — ${options.sessionId}`,
    subject: result.chainHead,
    creator: 'Attestto PWA',
    keywords: `chainHead:${result.chainHead}`,
  })

  // Download
  doc.save(`attestto-evidencia-${options.sessionId.slice(0, 8)}.pdf`)
}

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 3) + '...' : str
}
