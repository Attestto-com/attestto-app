import { describe, it, expect } from 'vitest'

/**
 * Tests for LLM question generator logic.
 * Tests prompt building and response parsing without actual LLM calls.
 */

// Inline the pure functions to test without module imports
function buildPrompt(request: { licenseType: string; categories: string[]; count: number; difficulty: 'easy' | 'medium' | 'hard'; context?: string }): string {
  const diffLabel =
    request.difficulty === 'easy' ? 'basica'
    : request.difficulty === 'hard' ? 'avanzada'
    : 'intermedia'

  return `Eres un generador de preguntas para el examen teorico de conducir de Costa Rica (COSEVI).

REGLAS ESTRICTAS:
- Genera exactamente ${request.count} preguntas nuevas y UNICAS sobre: ${request.categories.join(', ')}
- Dificultad: ${diffLabel}
- Cada pregunta debe evaluar COMPRENSION del concepto, no memoria textual
- Reformula usando situaciones practicas, escenarios de conduccion real, o aplicacion de la ley
- Las 4 opciones deben ser plausibles — no pongas opciones obviamente incorrectas
- La explicacion ("why") debe enseñar el concepto, no solo decir cual es correcta
- Responde SOLO con un JSON array valido, sin texto adicional

CONTEXTO DEL MANUAL:
${request.context ?? 'No disponible'}

FORMATO DE RESPUESTA (JSON array):
[
  {
    "question": "pregunta aqui",
    "options": ["opcion A", "opcion B", "opcion C", "opcion D"],
    "correct": 0,
    "why": "explicacion educativa",
    "category": "${request.categories[0] ?? 'General'}"
  }
]

Genera ${request.count} preguntas:`
}

interface RawQ { question: string; options: string[]; correct: number; why: string; category: string }

function parseResponse(text: string, licenseType: string): { id: string; category: string; question: string; options: string[]; correct: number; why: string; licenses: string[] }[] {
  let json = text.trim()
  const fenceStart = json.indexOf('```')
  if (fenceStart >= 0) {
    const afterFence = json.indexOf('\n', fenceStart)
    const fenceEnd = json.indexOf('```', afterFence)
    json = json.slice(afterFence + 1, fenceEnd >= 0 ? fenceEnd : undefined).trim()
  }

  const arrStart = json.indexOf('[')
  const arrEnd = json.lastIndexOf(']')
  if (arrStart < 0 || arrEnd < 0) return []

  json = json.slice(arrStart, arrEnd + 1)

  const parsed = JSON.parse(json) as RawQ[]
  if (!Array.isArray(parsed)) return []

  return parsed
    .filter((q) =>
      q.question &&
      Array.isArray(q.options) &&
      q.options.length >= 3 &&
      typeof q.correct === 'number' &&
      q.correct >= 0 &&
      q.correct < q.options.length &&
      q.why,
    )
    .map((q, i) => ({
      id: `llm-test-${i}`,
      category: q.category || 'General',
      question: q.question,
      options: q.options.slice(0, 4),
      correct: q.correct,
      why: q.why,
      licenses: [licenseType],
    }))
}

describe('Question Generator', () => {

  describe('buildPrompt', () => {
    it('includes category names', () => {
      const prompt = buildPrompt({ licenseType: 'B', categories: ['Señales'], count: 5, difficulty: 'medium' })
      expect(prompt).toContain('Señales')
    })

    it('includes question count', () => {
      const prompt = buildPrompt({ licenseType: 'B', categories: ['General'], count: 10, difficulty: 'medium' })
      expect(prompt).toContain('exactamente 10 preguntas')
    })

    it('maps easy difficulty to basica', () => {
      const prompt = buildPrompt({ licenseType: 'B', categories: ['General'], count: 5, difficulty: 'easy' })
      expect(prompt).toContain('basica')
    })

    it('maps hard difficulty to avanzada', () => {
      const prompt = buildPrompt({ licenseType: 'B', categories: ['General'], count: 5, difficulty: 'hard' })
      expect(prompt).toContain('avanzada')
    })

    it('maps medium difficulty to intermedia', () => {
      const prompt = buildPrompt({ licenseType: 'B', categories: ['General'], count: 5, difficulty: 'medium' })
      expect(prompt).toContain('intermedia')
    })

    it('includes manual context when provided', () => {
      const prompt = buildPrompt({ licenseType: 'B', categories: ['General'], count: 5, difficulty: 'medium', context: 'Chapter 1: Speed limits' })
      expect(prompt).toContain('Chapter 1: Speed limits')
    })

    it('shows "No disponible" when no context', () => {
      const prompt = buildPrompt({ licenseType: 'B', categories: ['General'], count: 5, difficulty: 'medium' })
      expect(prompt).toContain('No disponible')
    })

    it('includes COSEVI reference', () => {
      const prompt = buildPrompt({ licenseType: 'B', categories: ['General'], count: 5, difficulty: 'medium' })
      expect(prompt).toContain('COSEVI')
    })
  })

  describe('parseResponse', () => {
    it('parses valid JSON array', () => {
      const response = JSON.stringify([
        { question: '¿Qué hacer?', options: ['A', 'B', 'C', 'D'], correct: 0, why: 'Porque sí', category: 'Señales' },
      ])
      const result = parseResponse(response, 'B')
      expect(result).toHaveLength(1)
      expect(result[0].question).toBe('¿Qué hacer?')
      expect(result[0].licenses).toEqual(['B'])
    })

    it('handles markdown fences', () => {
      const response = 'Here are the questions:\n```json\n[{"question":"Q?","options":["A","B","C","D"],"correct":1,"why":"W","category":"C"}]\n```\nDone!'
      const result = parseResponse(response, 'B')
      expect(result).toHaveLength(1)
      expect(result[0].correct).toBe(1)
    })

    it('handles text before/after JSON', () => {
      const response = 'Sure! Here:\n[{"question":"Q?","options":["A","B","C"],"correct":0,"why":"W","category":"C"}]\nHope this helps!'
      const result = parseResponse(response, 'B')
      expect(result).toHaveLength(1)
    })

    it('filters out questions with missing fields', () => {
      const response = JSON.stringify([
        { question: 'Good', options: ['A', 'B', 'C', 'D'], correct: 0, why: 'Yes', category: 'C' },
        { question: '', options: ['A', 'B', 'C', 'D'], correct: 0, why: 'Yes', category: 'C' }, // empty question
        { question: 'Q', options: ['A'], correct: 0, why: 'Yes', category: 'C' }, // too few options
        { question: 'Q', options: ['A', 'B', 'C', 'D'], correct: 5, why: 'Yes', category: 'C' }, // correct out of range
        { question: 'Q', options: ['A', 'B', 'C', 'D'], correct: 0, why: '', category: 'C' }, // empty why
      ])
      const result = parseResponse(response, 'B')
      expect(result).toHaveLength(1)
      expect(result[0].question).toBe('Good')
    })

    it('accepts 3+ options', () => {
      const response = JSON.stringify([
        { question: 'Q?', options: ['A', 'B', 'C'], correct: 2, why: 'W', category: 'C' },
      ])
      const result = parseResponse(response, 'B')
      expect(result).toHaveLength(1)
    })

    it('truncates options to 4', () => {
      const response = JSON.stringify([
        { question: 'Q?', options: ['A', 'B', 'C', 'D', 'E', 'F'], correct: 0, why: 'W', category: 'C' },
      ])
      const result = parseResponse(response, 'A')
      expect(result[0].options).toHaveLength(4)
      expect(result[0].licenses).toEqual(['A'])
    })

    it('returns empty array for invalid JSON', () => {
      expect(parseResponse('not json at all', 'B')).toEqual([])
    })

    it('returns empty array for no array brackets', () => {
      expect(parseResponse('{"single": "object"}', 'B')).toEqual([])
    })

    it('defaults category to General when missing', () => {
      const response = JSON.stringify([
        { question: 'Q?', options: ['A', 'B', 'C', 'D'], correct: 0, why: 'W', category: '' },
      ])
      const result = parseResponse(response, 'B')
      expect(result[0].category).toBe('General')
    })

    it('parses multiple questions', () => {
      const qs = Array.from({ length: 5 }, (_, i) => ({
        question: `Q${i}?`, options: ['A', 'B', 'C', 'D'], correct: i % 4, why: `W${i}`, category: 'Señales',
      }))
      const result = parseResponse(JSON.stringify(qs), 'B')
      expect(result).toHaveLength(5)
    })
  })
})
