/**
 * MRZ OCR for Costa Rica Cédula and TD1 documents.
 * Ported from attestto-desktop/src/renderer/country/cr/mrz-ocr.ts
 *
 * Uses Tesseract.js (WASM) for 100% local OCR — nothing leaves the device.
 *
 * MRZ format (ICAO TD1 — 3 lines of 30 chars):
 *   Line 1: IDCRI + cédula(9) + check + document number + filler
 *   Line 2: DOB(YYMMDD) + check + sex + expiry(YYMMDD) + check + nationality + filler + check
 *   Line 3: APELLIDO1<APELLIDO2<<NOMBRE1<NOMBRE2
 */

import Tesseract from 'tesseract.js'
import type { MRZResult } from '../types/identity'

// ── Image Preprocessing ─────────────────────────────────────────

export function cropMRZRegion(imageSource: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const cropRatio = 0.35
      const cropY = Math.floor(img.height * (1 - cropRatio))
      const cropH = img.height - cropY
      canvas.width = img.width
      canvas.height = cropH
      ctx.drawImage(img, 0, cropY, img.width, cropH, 0, 0, img.width, cropH)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      for (let i = 0; i < data.length; i += 4) {
        const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
        const val = gray < 140 ? 0 : 255
        data[i] = val
        data[i + 1] = val
        data[i + 2] = val
      }
      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('Failed to load image for MRZ crop'))
    img.src = imageSource
  })
}

export function enhanceContrast(imageSource: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      let minB = 255, maxB = 0
      for (let i = 0; i < data.length; i += 4) {
        const b = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
        if (b < minB) minB = b
        if (b > maxB) maxB = b
      }
      const range = maxB - minB || 1
      for (let i = 0; i < data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          data[i + c] = Math.min(255, Math.max(0, ((data[i + c] - minB) / range) * 255))
        }
      }
      ctx.putImageData(imageData, 0, 0)
      resolve(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => resolve(imageSource)
    img.src = imageSource
  })
}

export function rotateImage(imageSource: string, degrees: 90 | 180 | 270): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      const rad = (degrees * Math.PI) / 180
      if (degrees === 180) {
        canvas.width = img.width
        canvas.height = img.height
      } else {
        canvas.width = img.height
        canvas.height = img.width
      }
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate(rad)
      ctx.drawImage(img, -img.width / 2, -img.height / 2)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = () => reject(new Error('rotateImage: load failed'))
    img.src = imageSource
  })
}

// ── MRZ Line Detection ──────────────────────────────────────────

export function cleanMRZLine(line: string): string {
  return line
    .toUpperCase()
    .replace(/[|]/g, '<')
    .replace(/\s+/g, '')
    .replace(/O(?=\d)/g, '0')
    .replace(/(?<=\d)O/g, '0')
    .replace(/(?<=\d)I/g, '1')
    .replace(/I(?=\d)/g, '1')
    .replace(/[()]/g, '<')
    .replace(/[{}]/g, '<')
    .replace(/[_-]/g, '<')
}

export function findMRZLines(lines: string[]): string[] {
  const mrzCandidates: string[] = []
  for (const line of lines) {
    const cleaned = cleanMRZLine(line)
    const mrzChars = cleaned.replace(/[^A-Z0-9<]/g, '')
    if (mrzChars.length >= 25 && (cleaned.includes('<') || cleaned.startsWith('IDCRI'))) {
      mrzCandidates.push(mrzChars)
    }
  }
  return mrzCandidates.slice(0, 3)
}

// ── TD1 MRZ Parser ──────────────────────────────────────────────

export function parseMRZ(mrzLines: string[], confidence: number): MRZResult {
  const empty: MRZResult = {
    success: false,
    cedula: '', nombre: '', apellido1: '', apellido2: '',
    fechaNacimiento: '', fechaVencimiento: '',
    nacionalidad: '', sexo: '',
    rawMRZ: mrzLines, confidence,
  }

  const line1 = mrzLines[0] || ''
  let cedula = ''
  const idMatch = line1.match(/IDCR[I1](\d{9})/)
  if (idMatch) {
    cedula = idMatch[1]
  } else {
    const numMatch = line1.match(/\d{9}/)
    if (numMatch) cedula = numMatch[0]
  }

  const line2 = mrzLines[1] || ''
  let fechaNacimiento = ''
  let fechaVencimiento = ''
  let nacionalidad = ''
  let sexo = ''

  const dobMatch = line2.match(/^(\d{6})/)
  if (dobMatch) {
    const dob = dobMatch[1]
    const year = parseInt(dob.substring(0, 2), 10)
    const fullYear = year > 50 ? 1900 + year : 2000 + year
    fechaNacimiento = `${dob.substring(4, 6)}/${dob.substring(2, 4)}/${fullYear}`
  }

  const sexMatch = line2.match(/\d{7}([MF<])/)
  if (sexMatch) {
    sexo = sexMatch[1] === '<' ? '' : sexMatch[1]
  }

  const expiryMatch = line2.match(/[MF<](\d{6})/)
  if (expiryMatch) {
    const exp = expiryMatch[1]
    const year = parseInt(exp.substring(0, 2), 10)
    const fullYear = 2000 + year
    fechaVencimiento = `${exp.substring(4, 6)}/${exp.substring(2, 4)}/${fullYear}`
  }

  const natMatch = line2.match(/CRI/)
  if (natMatch) nacionalidad = 'CRI'

  const line3 = mrzLines[2] || ''
  let nombre = ''
  let apellido1 = ''
  let apellido2 = ''

  const nameParts = line3.split(/<<+/)
  if (nameParts.length >= 2) {
    const apellidos = nameParts[0].split('<').filter(Boolean)
    apellido1 = apellidos[0] || ''
    apellido2 = apellidos[1] || ''
    nombre = nameParts.slice(1).join(' ').replace(/</g, ' ').trim()
  }

  const success = cedula.length === 9 && apellido1.length > 0

  return {
    success, cedula, nombre, apellido1, apellido2,
    fechaNacimiento, fechaVencimiento, nacionalidad, sexo,
    rawMRZ: mrzLines, confidence,
  }
}

// ── OCR Helpers for Old-Format Cédula ───────────────────────────

export function findCedulaNumber(lines: string[]): string {
  for (const line of lines) {
    const lower = line.toLowerCase().replace(/[éè]/g, 'e').replace(/[úù]/g, 'u')
    if (lower.includes('cedula') || lower.includes('numero')) {
      const afterLabel = line.replace(/^[^:]*:?\s*/, '')
      const digits = afterLabel.replace(/[\s.\-]/g, '').replace(/[^0-9]/g, '')
      if (digits.length === 9) return digits
    }
  }
  for (const line of lines) {
    const numMatch = line.match(/(\d[\s.-]?\d{3,4}[\s.-]?\d{3,4})/)
    if (numMatch) {
      const digits = numMatch[1].replace(/[\s.\-]/g, '')
      if (digits.length === 9) return digits
    }
    const bareMatch = line.match(/\b(\d{9})\b/)
    if (bareMatch) return bareMatch[1]
  }
  return ''
}

export function findNameFields(lines: string[]): { nombre: string; apellido1: string; apellido2: string } {
  let nombre = ''
  let apellido1 = ''
  let apellido2 = ''

  const cleanLabel = (val: string): string =>
    val
      .replace(/\b(nombre|apellido|primer[oa]?|segundo|cedula|c[\s.]?c[\s.]?)\b/gi, '')
      .replace(/[1-2][°*º]/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()

  const extractValue = (l: string, nextLine?: string): string => {
    const afterColon = l.split(/[:;.]/)[1]?.trim()
    if (afterColon && afterColon.length > 1) {
      return cleanLabel(afterColon.replace(/[^A-ZÁÉÍÓÚÑa-záéíóúñ\s]/g, '').trim())
    }
    if (nextLine) {
      return cleanLabel(nextLine.replace(/[^A-ZÁÉÍÓÚÑa-záéíóúñ\s]/g, '').trim())
    }
    return ''
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lower = line.toLowerCase()
      .replace(/[áà]/g, 'a').replace(/[éè]/g, 'e')
      .replace(/[íì]/g, 'i').replace(/[óò]/g, 'o').replace(/[úù]/g, 'u')

    if (!nombre && lower.includes('nombre') && !lower.includes('padre') && !lower.includes('madre') && !lower.includes('apellido')) {
      nombre = extractValue(line, lines[i + 1])
    }
    if (!apellido1 && lower.includes('apellido') && (lower.includes('1') || lower.includes('primer'))) {
      apellido1 = extractValue(line, lines[i + 1])
    }
    if (!apellido2 && lower.includes('apellido') && (lower.includes('2') || lower.includes('segundo'))) {
      apellido2 = extractValue(line, lines[i + 1])
    }
  }

  return { nombre, apellido1, apellido2 }
}

function findFechaNacimiento(lines: string[]): string {
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (lower.includes('nacimiento') || lower.includes('nac')) {
      const dateMatch = line.match(/(\d{1,2})[\s/.-](\d{1,2})[\s/.-](\d{4})/)
      if (dateMatch) {
        return `${dateMatch[1].padStart(2, '0')}/${dateMatch[2].padStart(2, '0')}/${dateMatch[3]}`
      }
    }
  }
  return ''
}

function findVencimiento(lines: string[]): string {
  for (const line of lines) {
    const lower = line.toLowerCase()
    if (lower.includes('vencimiento') || lower.includes('venc')) {
      const dateMatch = line.match(/(\d{1,2})[\s/.-](\d{1,2})[\s/.-](\d{4})/)
      if (dateMatch) {
        return `${dateMatch[1].padStart(2, '0')}/${dateMatch[2].padStart(2, '0')}/${dateMatch[3]}`
      }
    }
  }
  return ''
}

// ── Main OCR Entry Points ───────────────────────────────────────

export async function extractCedulaMRZ(
  imageSource: string,
  onProgress?: (progress: number) => void,
): Promise<MRZResult> {
  const empty: MRZResult = {
    success: false,
    cedula: '', nombre: '', apellido1: '', apellido2: '',
    fechaNacimiento: '', fechaVencimiento: '',
    nacionalidad: '', sexo: '',
    rawMRZ: [], confidence: 0,
  }

  try {
    let mrzImage: string
    try {
      mrzImage = await cropMRZRegion(imageSource)
    } catch {
      mrzImage = imageSource
    }

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

    const result = await worker.recognize(mrzImage)
    await worker.terminate()

    const fullText = result.data.text
    const confidence = result.data.confidence
    const lines = fullText.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 10)
    let mrzLines = findMRZLines(lines)

    if (mrzLines.length < 2) {
      const cleaned = lines.map(cleanMRZLine).filter((l: string) => l.length >= 25)
      mrzLines = findMRZLines(cleaned)
      if (mrzLines.length < 2) {
        // Try rotations
        for (const rotation of [180, 90, 270] as const) {
          try {
            const rotated = await rotateImage(imageSource, rotation)
            const rotResult = await Tesseract.recognize(rotated, 'eng')
            const rotLines = rotResult.data.text.split('\n').map((l: string) => l.trim()).filter((l: string) => l.length > 10)
            mrzLines = findMRZLines(rotLines)
            if (mrzLines.length >= 2) return parseMRZ(mrzLines, rotResult.data.confidence)
          } catch { /* skip rotation */ }
        }
        return { ...empty, confidence }
      }
    }

    return parseMRZ(mrzLines, confidence)
  } catch (err) {
    console.error('[mrz-ocr] OCR failed:', err)
    return empty
  }
}

export async function extractFromFront(
  frontImage: string,
  onProgress?: (progress: number) => void,
  backImage?: string | null,
): Promise<MRZResult> {
  const empty: MRZResult = {
    success: false,
    cedula: '', nombre: '', apellido1: '', apellido2: '',
    fechaNacimiento: '', fechaVencimiento: '',
    nacionalidad: 'CRI', sexo: '',
    rawMRZ: [], confidence: 0,
    source: 'front-ocr',
  }

  try {
    const enhancedFront = await enhanceContrast(frontImage)
    const enhancedBack = backImage ? await enhanceContrast(backImage) : null

    const frontWorker = await Tesseract.createWorker('spa', undefined, {
      logger: (m: any) => {
        if (m.status === 'recognizing text' && onProgress) {
          onProgress(Math.round(m.progress * 50))
        }
      },
    })
    const frontResult = await frontWorker.recognize(enhancedFront)
    await frontWorker.terminate()
    const frontLines = frontResult.data.text.split('\n').map((l: string) => l.trim()).filter(Boolean)

    let cedula = findCedulaNumber(frontLines)
    let { nombre, apellido1, apellido2 } = findNameFields(frontLines)
    let fechaNacimiento = ''
    let fechaVencimiento = ''
    let confidence = frontResult.data.confidence

    if (enhancedBack) {
      const backWorker = await Tesseract.createWorker('spa', undefined, {
        logger: (m: any) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(50 + Math.round(m.progress * 50))
          }
        },
      })
      const backResult = await backWorker.recognize(enhancedBack)
      await backWorker.terminate()
      const backLines = backResult.data.text.split('\n').map((l: string) => l.trim()).filter(Boolean)
      confidence = Math.max(confidence, backResult.data.confidence)

      if (!cedula) cedula = findCedulaNumber(backLines)
      if (!nombre || !apellido1) {
        const backNames = findNameFields(backLines)
        if (!nombre && backNames.nombre) nombre = backNames.nombre
        if (!apellido1 && backNames.apellido1) apellido1 = backNames.apellido1
        if (!apellido2 && backNames.apellido2) apellido2 = backNames.apellido2
      }
      fechaNacimiento = findFechaNacimiento(backLines)
      fechaVencimiento = findVencimiento(backLines)
    }

    const success = cedula.length === 9

    return {
      success, cedula, nombre, apellido1, apellido2,
      fechaNacimiento, fechaVencimiento,
      nacionalidad: 'CRI', sexo: '',
      rawMRZ: frontLines.slice(0, 5),
      confidence,
      source: 'front-ocr',
    }
  } catch (err) {
    console.error('[front-ocr] OCR failed:', err)
    return empty
  }
}
