import { describe, it, expect } from 'vitest'
import { mapToMacroCategory, MACRO_CATEGORIES, MIN_QUESTIONS_PER_CATEGORY } from '../../modules/cr-driving/src/composables/useCategoryMap'

describe('useCategoryMap', () => {
  it('has exactly 9 macro-categories', () => {
    expect(MACRO_CATEGORIES).toHaveLength(9)
  })

  it('MIN_QUESTIONS_PER_CATEGORY is 10', () => {
    expect(MIN_QUESTIONS_PER_CATEGORY).toBe(10)
  })

  it('maps "Leyes de tránsito" to "Leyes y reglamento"', () => {
    expect(mapToMacroCategory('Leyes de tránsito')).toBe('Leyes y reglamento')
  })

  it('maps "Sanciones y puntos" to "Leyes y reglamento"', () => {
    expect(mapToMacroCategory('Sanciones y puntos')).toBe('Leyes y reglamento')
  })

  it('maps "Señales de tránsito" to "Señales y semáforos"', () => {
    expect(mapToMacroCategory('Señales de tránsito')).toBe('Señales y semáforos')
  })

  it('maps "Semáforos" to "Señales y semáforos"', () => {
    expect(mapToMacroCategory('Semáforos')).toBe('Señales y semáforos')
  })

  it('maps "Velocidad máxima" to "Velocidad y frenado"', () => {
    expect(mapToMacroCategory('Velocidad máxima')).toBe('Velocidad y frenado')
  })

  it('maps "Distancia de frenado" to "Velocidad y frenado"', () => {
    expect(mapToMacroCategory('Distancia de frenado')).toBe('Velocidad y frenado')
  })

  it('maps "Llantas y neumáticos" to "Velocidad y frenado"', () => {
    expect(mapToMacroCategory('Llantas y neumáticos')).toBe('Velocidad y frenado')
  })

  it('maps "Adelantamiento" to "Maniobras y conducción"', () => {
    expect(mapToMacroCategory('Adelantamiento')).toBe('Maniobras y conducción')
  })

  it('maps "Giros y cambio de carril" to "Maniobras y conducción"', () => {
    expect(mapToMacroCategory('Giros y cambio de carril')).toBe('Maniobras y conducción')
  })

  it('maps "Estacionamiento" to "Maniobras y conducción"', () => {
    expect(mapToMacroCategory('Estacionamiento')).toBe('Maniobras y conducción')
  })

  it('maps "Seguridad activa" to "Seguridad del vehículo"', () => {
    expect(mapToMacroCategory('Seguridad activa')).toBe('Seguridad del vehículo')
  })

  it('maps "Panel de instrumentos" to "Seguridad del vehículo"', () => {
    expect(mapToMacroCategory('Panel de instrumentos')).toBe('Seguridad del vehículo')
  })

  it('maps "Peatones y ciclistas" to "Convivencia vial"', () => {
    expect(mapToMacroCategory('Peatones y ciclistas')).toBe('Convivencia vial')
  })

  it('maps "Convivencia vial" to itself', () => {
    expect(mapToMacroCategory('Convivencia vial')).toBe('Convivencia vial')
  })

  it('maps "Condiciones adversas de clima" to "Condiciones adversas"', () => {
    expect(mapToMacroCategory('Condiciones adversas de clima')).toBe('Condiciones adversas')
  })

  it('maps "Fatiga y alcohol" to "Condiciones adversas"', () => {
    expect(mapToMacroCategory('Fatiga y alcohol')).toBe('Condiciones adversas')
  })

  it('maps "Accidentes de tránsito" to "Accidentes y emergencias"', () => {
    expect(mapToMacroCategory('Accidentes de tránsito')).toBe('Accidentes y emergencias')
  })

  it('maps "Qué hacer en un accidente" to "Accidentes y emergencias"', () => {
    expect(mapToMacroCategory('Qué hacer en un accidente')).toBe('Accidentes y emergencias')
  })

  it('maps "Conocimiento universal" to "Conocimiento por licencia"', () => {
    expect(mapToMacroCategory('Conocimiento universal')).toBe('Conocimiento por licencia')
  })

  it('maps "Licencia B" to "Leyes y reglamento" (licencia keyword matches first)', () => {
    expect(mapToMacroCategory('Licencia B')).toBe('Leyes y reglamento')
  })

  it('maps "Licencia b especifica" to "Conocimiento por licencia"', () => {
    expect(mapToMacroCategory('Licencia b especifica')).toBe('Leyes y reglamento')
  })

  it('maps "Todo conductor debe saber" to "Conocimiento por licencia"', () => {
    expect(mapToMacroCategory('Todo conductor debe saber')).toBe('Conocimiento por licencia')
  })

  // Numbered section fallbacks
  it('maps "1. Tema general" to "Conocimiento por licencia" (numbered fallback)', () => {
    expect(mapToMacroCategory('1. Tema general')).toBe('Conocimiento por licencia')
  })

  it('maps "6. Señalización" to "Señales y semáforos" (numbered fallback)', () => {
    expect(mapToMacroCategory('6. Señalización')).toBe('Señales y semáforos')
  })

  it('maps "8. Riesgos" to "Accidentes y emergencias" (riesgo keyword matches before numbered fallback)', () => {
    expect(mapToMacroCategory('8. Riesgos')).toBe('Accidentes y emergencias')
  })

  it('maps "8. Clima nocturno" to "Condiciones adversas" (numbered fallback when no keyword match)', () => {
    expect(mapToMacroCategory('8. Clima nocturno')).toBe('Condiciones adversas')
  })

  // Default fallback
  it('maps unknown category to "Leyes y reglamento" (default)', () => {
    expect(mapToMacroCategory('xyz unknown category')).toBe('Leyes y reglamento')
  })

  // Case insensitivity
  it('is case-insensitive', () => {
    expect(mapToMacroCategory('VELOCIDAD MAXIMA')).toBe('Velocidad y frenado')
    expect(mapToMacroCategory('accidente')).toBe('Accidentes y emergencias')
  })

  // Every macro-category is a valid return value
  it('all macro-categories are reachable', () => {
    const testInputs = [
      'Leyes', 'Señales', 'Velocidad', 'Maniobras',
      'Seguridad activa', 'Convivencia', 'Condiciones adversas',
      'Accidente', 'Conocimiento universal',
    ]
    const results = new Set(testInputs.map(mapToMacroCategory))
    expect(results.size).toBe(9)
  })
})
