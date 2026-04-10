import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Quasar } from 'quasar'
import '@quasar/extras/material-icons/material-icons.css'
import 'quasar/src/css/index.sass'
import './styles/tokens.css'

import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'

const app = createApp(App)

app.use(createPinia())
app.use(router)
app.use(i18n)
app.use(Quasar, {
  config: {
    dark: true,
    brand: {
      primary: '#594FD3',
      secondary: '#1a1f2e',
      accent: '#4ade80',
      dark: '#0f1923',
      positive: '#4ade80',
      negative: '#ef4444',
      info: '#594FD3',
      warning: '#f97316',
    },
  },
})

app.mount('#app')
