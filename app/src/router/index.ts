import { createRouter, createWebHistory } from 'vue-router'
import { useVaultStore } from '@/stores/vault'

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
      path: '/wallet',
      name: 'wallet',
      component: () => import('@/views/WalletPage.vue'),
      meta: { requiresAuth: true, nav: true },
    },
    {
      path: '/documents',
      name: 'documents',
      component: () => import('@/views/DocumentsPage.vue'),
      meta: { requiresAuth: true, nav: true },
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

export { router }
