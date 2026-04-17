import { createRouter, createWebHistory } from 'vue-router'
import { useVaultStore } from '@/stores/vault'

// GitHub Pages SPA redirect: 404.html redirects /path → /?p=/path
const ghPagesRedirect = new URLSearchParams(window.location.search).get('p')
if (ghPagesRedirect) {
  window.history.replaceState(null, '', ghPagesRedirect + window.location.hash)
}

// Desktop users see the marketing/demo page; mobile users get the app
const isDesktop = window.innerWidth > 768 && !/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
const isIframe = window.self !== window.top
if (isDesktop && !isIframe && !window.location.pathname.startsWith('/demo')) {
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
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('@/views/OnboardingFlow.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/home',
      name: 'home',
      component: () => import('@/views/HomePage.vue'),
      meta: { requiresAuth: true, nav: true },
    },
    {
      path: '/wallet',
      name: 'wallet',
      component: () => import('@/views/WalletPage.vue'),
      meta: { requiresAuth: true, nav: true },
    },
    {
      path: '/documents',
      name: 'documents',
      component: () => import('@/views/DocumentsPage.vue'),
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
      path: '/verify',
      name: 'verify',
      component: () => import('@/views/VerifyPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/modules',
      name: 'modules',
      component: () => import('@/views/ModulesPage.vue'),
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
