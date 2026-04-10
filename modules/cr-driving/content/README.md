# CR Driving Module — Content

Source material for the on-device LLM question generator and the seed question bank.

## Manuals (LLM context)

These are the full COSEVI driving manuals. The LLM reads chapter content to generate
new understanding-based questions dynamically per session.

| File | License | Chapters |
|---|---|---|
| `manuals/automovil.json` | B (car/light vehicle) | 31 |
| `manuals/moto.json` | A (motorcycle/bicimoto) | 32 |
| `manuals/transporte-publico.json` | C (taxi/bus) | 6 |

## Questions (seed bank)

Pre-generated questions used as seeds and fallbacks when LLM is unavailable.

| File | Count | Format |
|---|---|---|
| `questions/seed-automovil-40.json` | 40 | id, chapter, topic, question, options[4], correct, explanation |
| `questions/understanding-78.json` | 78 | q, options[4], answer, answer_text, why |
| `questions/by-license.json` | 100+ | Sections by license type (ALL/A/B/C/PRO), each with id, licenses[], q, options, answer, why |

## How the LLM uses this

1. **Practice mode**: pick a random chapter → feed chapter content to LLM → generate 5 fresh questions
2. **Proctored exam**: select 40 questions from seed bank + LLM-generated, weighted by mastery gaps
3. **Fallback**: if LLM unavailable, serve from seed banks with Fisher-Yates shuffle
4. **License filtering**: `by-license.json` tags questions with applicable license types (A/B/C/PRO)

All content is from public law (Ley 9078) — no secrecy required.
