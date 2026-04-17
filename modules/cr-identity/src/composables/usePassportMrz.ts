/**
 * TD3 Passport MRZ Parser
 *
 * ICAO 9303 TD3 format — 2 lines × 44 characters:
 *   Line 1: P<CRISURNAME<<GIVEN<NAMES<<<<<<<<<<<<<<<<<<
 *   Line 2: DOCNUMBER<CHECKDOBCHECKSEXEXPIRYCHECKNATCHECK
 *
 * Field positions (line 2):
 *   [0:9]   document number
 *   [9]     check digit
 *   [10:13] nationality (3-letter)
 *   [13:19] DOB (YYMMDD)
 *   [19]    check digit
 *   [20]    sex (M/F/<)
 *   [21:27] expiry (YYMMDD)
 *   [27]    check digit
 *   [28:42] personal number
 *   [42]    check digit
 *   [43]    composite check digit
 */

import Tesseract from 'tesseract.js'
import type { PassportMRZResult } from '../types/identity'
import { cleanMRZLine, enhanceContrast, rotateImage } from './useMrzOcr'

// ── TD3 Line Detection ──────────────────────────────────────────

export function findPassportMRZLines(lines: string[]): string[] {
  const candidates: string[] = []

  for (const line of lines) {
    const cleaned = cleanMRZLine(line)
    const mrzChars = cleaned.replace(/[^A-Z0-9<]/g, '')
    // TD3 lines are 44 chars; allow some OCR variance (40+)
    if (mrzChars.length >= 40) {
      // Line 1 starts with P< or P followed by country code
      // Line 2 is all digits/letters with check digits
      if (mrzChars.startsWith('P') || mrzChars.match(/^\d{9}/)) {
        candidates.push(mrzChars)
      }
    }
  }

  // Return first 2 candidates (line 1 = name, line 2 = data)
  return candidates.slice(0, 2)
}

// ── TD3 MRZ Parser ──────────────────────────────────────────────

function parseYYMMDD(raw: string): string {
  if (raw.length !== 6) return ''
  const yy = parseInt(raw.substring(0, 2), 10)
  const mm = raw.substring(2, 4)
  const dd = raw.substring(4, 6)
  const fullYear = yy > 50 ? 1900 + yy : 2000 + yy
  return `${dd}/${mm}/${fullYear}`
}

export function parsePassportMRZ(mrzLines: string[]): PassportMRZResult {
  const empty: PassportMRZResult = {
    success: false,
    documentNumber: '', surname: '', givenNames: '',
    nationality: '', dateOfBirth: '', sex: '',
    dateOfExpiry: '', issuingCountry: '',
    rawMRZ: mrzLines, confidence: 0,
  }

  if (mrzLines.length < 2) return empty

  const line1 = mrzLines[0].padEnd(44, '<')
  const line2 = mrzLines[1].padEnd(44, '<')

  // Line 1: P<CRISURNAME<<GIVEN<NAMES
  // [0] = P (passport), [1] = <, [2:5] = issuing country
  const issuingCountry = line1.substring(2, 5).replace(/</g, '')

  // Names: everything after position 5, split on <<
  const nameField = line1.substring(5)
  const nameParts = nameField.split(/<<+/)
  const surname = (nameParts[0] || '').replace(/</g, ' ').trim()
  const givenNames = (nameParts.slice(1).join(' ') || '').replace(/</g, ' ').trim()

  // Line 2: data fields
  const documentNumber = line2.substring(0, 9).replace(/</g, '')
  // [9] = check digit (skip)
  const nationality = line2.substring(10, 13).replace(/</g, '')
  const dateOfBirth = parseYYMMDD(line2.substring(13, 19))
  // [19] = check digit (skip)
  const sex = line2[20] === '<' ? '' : line2[20]
  const dateOfExpiry = parseYYMMDD(line2.substring(21, 27))

  const success = documentNumber.length > 0 && surname.length > 0

  return {
    success,
    documentNumber,
    surname,
    givenNames,
    nationality,
    dateOfBirth,
    sex,
    dateOfExpiry,
    issuingCountry,
    rawMRZ: mrzLines,
    confidence: 0,
  }
}

// ── Main OCR Entry Point ────────────────────────────────────────

export async function extractPassportMRZ(
  imageSource: string,
  onProgress?: (progress: number) => void,
): Promise<PassportMRZResult> {
  const empty: PassportMRZResult = {
    success: false,
    documentNumber: '', surname: '', givenNames: '',
    nationality: '', dateOfBirth: '', sex: '',
    dateOfExpiry: '', issuingCountry: '',
    rawMRZ: [], confidence: 0,
  }

  try {
    // Passport MRZ is in the bottom ~25% of the data page
    const enhanced = await enhanceContrast(imageSource)

    const worker = await Tesseract.createWorker('eng', undefined, {
      logger: (m: any) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100))
        }
      },
    })

    await worker.setParameters({
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<',
      tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
    })

    const result = await worker.recognize(enhanced)
    await worker.terminate()

    const lines = result.data.text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 10)
    let mrzLines = findPassportMRZLines(lines)

    if (mrzLines.length < 2) {
      // Try cleaning
      const cleaned = lines.map(cleanMRZLine).filter((l: string) => l.length >= 40)
      mrzLines = findPassportMRZLines(cleaned)

      if (mrzLines.length < 2) {
        // Try rotation
        for (const rotation of [180] as const) {
          try {
            const rotated = await rotateImage(imageSource, rotation)
            const rotResult = await Tesseract.recognize(rotated, 'eng')
            const rotLines = rotResult.data.text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 10)
            mrzLines = findPassportMRZLines(rotLines)
            if (mrzLines.length >= 2) {
              const parsed = parsePassportMRZ(mrzLines)
              parsed.confidence = rotResult.data.confidence
              return parsed
            }
          } catch { /* skip */ }
        }
        return { ...empty, confidence: result.data.confidence }
      }
    }

    const parsed = parsePassportMRZ(mrzLines)
    parsed.confidence = result.data.confidence
    return parsed
  } catch (err) {
    console.error('[passport-mrz] OCR failed:', err)
    return empty
  }
}
