import { createRouter, createWebHistory } from 'vue-router'
import { useVaultStore } from '@/stores/vault'

// GitHub Pages SPA redirect: 404.html redirects /path → /?p=/path
const ghPagesRedirect = new URLSearchParams(window.location.search).get('p')
if (ghPagesRedirect) {
  window.history.replaceState(null, '', ghPagesRedirect + window.location.hash)
}

// Desktop users see the marketing/demo page; mobile users get the app.
// Bypass in dev so we can iterate the app UI on a laptop without emulating a phone.
const isDesktop = window.innerWidth > 768 && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
const isIframe = window.self !== window.top
if (!import.meta.env.DEV && isDesktop && !isIframe && !window.location.pathname.startsWith('/demo')) {
  window.location.replace('/demo/')
}

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/home',
    },
    {
      path: '/lock',
      name: 'lock',
      component: () => import('@/views/LockScreen.vue'),
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/views/HomePage.vue'),
      meta: { requiresAuth: true, nav: true },
    },
    {
      path: '/pagos',
      name: 'pagos',
      component: () => import('@/views/PagosPage.vue'),
      meta: { requiresAuth: true, nav: true },
    },
    {
      path: '/firmar',
      name: 'firmar',
      component: () => import('@/views/DocumentsPage.vue'),
      meta: { requiresAuth: true, nav: true },
    },
    {
      path: '/wallet',
      name: 'wallet',
      component: () => import('@/views/WalletPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/documents/:id',
      name: 'pdf-viewer',
      component: () => import('@/views/PdfViewerPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/wallet/:id',
      name: 'credential-detail',
      component: () => import('@/views/CredentialDetail.vue'),
      meta: { requiresAuth: true },
    },
    {
      // Public on purpose: verifying someone else's credential (scanned from a
      // website or another phone) reads no vault data, so it must be reachable
      // straight from the lock screen without unlocking. Verify is free and
      // permissionless — no account, no unlock.
      path: '/verify',
      name: 'verify',
      component: () => import('@/views/VerifyPage.vue'),
    },
    {
      path: '/modules',
      name: 'modules',
      component: () => import('@/views/ModulesPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/receive',
      name: 'receive-credential',
      component: () => import('@/views/ReceiveCredentialPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/present',
      name: 'present-credentials',
      component: () => import('@/views/PresentCredentialsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsPage.vue'),
      meta: { requiresAuth: true, nav: true },
    },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth) {
    const vault = useVaultStore()
    if (!vault.unlocked) return { name: 'lock' }
  }
})

// Track SPA navigations in Plausible (default script only tracks initial load)
router.afterEach(() => {
  window.plausible?.('pageview')
})

export { router }
