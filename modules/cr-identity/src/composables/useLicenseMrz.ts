/**
 * Costa Rica Driving License Parser
 *
 * CR licenses use TD1 MRZ format on the back (same as cédula).
 * The front has a categories table (A1-E3) with validity dates.
 *
 * This parser:
 * 1. Extracts identity from back MRZ via the cédula TD1 parser
 * 2. Extracts license categories from front via OCR
 */

import Tesseract from 'tesseract.js'
import type { LicenseCategory } from '../types/identity'
import { LICENSE_CATEGORY_CODES } from '../types/identity'
import { enhanceContrast } from './useMrzOcr'

// ── Category Parser ─────────────────────────────────────────────

/**
 * Parse OCR text lines to extract license category codes.
 * Looks for patterns like "B1", "A2", "C1" etc. that match CR license categories.
 */
export function parseLicenseCategories(lines: string[]): LicenseCategory[] {
  const categories: LicenseCategory[] = []
  const seen = new Set<string>()

  for (const line of lines) {
    const upper = line.toUpperCase().replace(/\s+/g, ' ')

    for (const code of LICENSE_CATEGORY_CODES) {
      // Match category code with word boundary or surrounded by spaces/punctuation
      const pattern = new RegExp(`\\b${code}\\b`)
      if (pattern.test(upper) && !seen.has(code)) {
        seen.add(code)

        // Try to extract dates from the same line
        const dates = upper.match(/(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})/g) || []
        categories.push({
          code,
          from: dates[0] || '',
          to: dates[1] || '',
        })
      }
    }
  }

  return categories
}

// ── OCR Entry Point ─────────────────────────────────────────────

/**
 * Extract license categories from the front of a CR driving license.
 * Uses general OCR (not MRZ) since categories are in a table format.
 */
export async function extractLicenseCategories(
  frontImage: string,
  onProgress?: (progress: number) => void,
): Promise<LicenseCategory[]> {
  try {
    const enhanced = await enhanceContrast(frontImage)

    const worker = await Tesseract.createWorker('spa', undefined, {
      logger: (m: any) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 100))
        }
      },
    })

    const result = await worker.recognize(enhanced)
    await worker.terminate()

    const lines = result.data.text.split('\n').map((l: string) => l.trim()).filter(Boolean)
    return parseLicenseCategories(lines)
  } catch (err) {
    console.error('[license-ocr] Category extraction failed:', err)
    return []
  }
}
