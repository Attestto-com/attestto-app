import { createI18n } from 'vue-i18n'
import es from './es'
import en from './en'

export const i18n = createI18n({
  legacy: false,
  locale: localStorage.getItem('attestto:locale') ?? 'es',
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
