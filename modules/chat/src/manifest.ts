import type { ModuleManifest } from '@attestto/module-sdk'

export const manifest: ModuleManifest = {
  id: 'chat',
  name: 'Chat',
  country: 'universal',
  version: '0.1.0',
  description: 'Signed negotiation channel — every message is DID-signed and encrypted',
  icon: 'chat',
  requiredCredentials: [],
  capabilities: ['messaging', 'encryption', 'agreement'],
  routes: [
    {
      path: '/channels',
      name: 'chat-channels',
      component: () => import('./views/ChannelListView.vue'),
    },
    {
      path: '/channel/:channelId',
      name: 'chat-channel',
      component: () => import('./views/ChannelView.vue'),
    },
    {
      path: '/new',
      name: 'chat-new',
      component: () => import('./views/NewChannelView.vue'),
    },
  ],
  inboxTypes: ['chat-message'],
  credentialTypes: ['AgreementCredential'],
}
