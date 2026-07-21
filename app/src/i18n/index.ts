import { createI18n } from 'vue-i18n'
import es from './es'
import en from './en'

function detectLocale(): 'es' | 'en' {
  const saved = localStorage.getItem('attestto:locale')
  if (saved === 'es' || saved === 'en') return saved
  const browser = (navigator.language || 'es').toLowerCase()
  return browser.startsWith('es') ? 'es' : 'en'
}

export const i18n = createI18n({
  legacy: false,
  locale: detectLocale(),
  fallbackLocale: 'es',
  messages: { es, en },
})

export function setLocale(locale: 'es' | 'en') {
  i18n.global.locale.value = locale
  localStorage.setItem('attestto:locale', locale)
}

export function getLocale(): string {
  return i18n.global.locale.value
}
