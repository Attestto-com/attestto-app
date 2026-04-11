/**
 * Maps 53 raw question categories to 9 macro-categories.
 * Used across mastery tracking, question selection, and UI display.
 */

export const MIN_QUESTIONS_PER_CATEGORY = 10

export const MACRO_CATEGORIES = [
  'Leyes y reglamento',
  'Señales y semáforos',
  'Velocidad y frenado',
  'Maniobras y conducción',
  'Seguridad del vehículo',
  'Convivencia vial',
  'Condiciones adversas',
  'Accidentes y emergencias',
  'Conocimiento por licencia',
] as const

export type MacroCategory = typeof MACRO_CATEGORIES[number]

/** Keywords that map raw categories to macro-categories */
const CATEGORY_RULES: [MacroCategory, string[]][] = [
  ['Leyes y reglamento', ['ley', 'sancion', 'punto', 'licencia', 'documento', 'reglamento', 'dev']],
  ['Señales y semáforos', ['señal', 'semáforo', 'marca', 'semafor']],
  ['Velocidad y frenado', ['velocidad', 'distancia', 'freno', 'llanta', 'frenado']],
  ['Maniobras y conducción', ['maniobra', 'adelant', 'giro', 'cambio de carril', 'estacionamiento', 'conducción en la vía', 'preparación']],
  ['Seguridad del vehículo', ['seguridad activa', 'seguridad pasiva', 'panel', 'instrumento', 'transmisión', 'sistema de seguridad']],
  ['Convivencia vial', ['convivencia', 'peatón', 'peatones', 'ciclista', 'vulnerable', 'emergencia', 'carga', 'compartido', 'vial como espacio']],
  ['Condiciones adversas', ['condicion', 'adversa', 'peligro', 'fatiga', 'alcohol', 'droga', 'distracción', 'atención', 'clima']],
  ['Accidentes y emergencias', ['accidente', 'riesgo', 'qué hacer']],
  ['Conocimiento por licencia', ['conocimiento universal', 'licencia b', 'licencia a', 'conductor de moto', 'profesional', 'todo conductor']],
]

/**
 * Map a raw question category string to one of 9 macro-categories.
 * Uses case-insensitive substring matching against keyword rules.
 */
export function mapToMacroCategory(rawCategory: string): MacroCategory {
  const lower = rawCategory.toLowerCase()

  for (const [macro, keywords] of CATEGORY_RULES) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return macro
    }
  }

  // Fallback: try to match numbered sections (e.g. "1. Conocimiento universal")
  if (lower.startsWith('1.') || lower.includes('todo conductor')) return 'Conocimiento por licencia'
  if (lower.startsWith('2.') || lower.startsWith('3.')) return 'Conocimiento por licencia'
  if (lower.startsWith('4.')) return 'Conocimiento por licencia'
  if (lower.startsWith('5.')) return 'Conocimiento por licencia'
  if (lower.startsWith('6.')) return 'Señales y semáforos'
  if (lower.startsWith('7.')) return 'Convivencia vial'
  if (lower.startsWith('8.')) return 'Condiciones adversas'
  if (lower.startsWith('9.')) return 'Convivencia vial'

  // Default fallback
  return 'Leyes y reglamento'
}
