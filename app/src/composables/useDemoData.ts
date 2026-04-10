import { useInboxStore } from '@/stores/inbox'

export function seedDemoInbox() {
  const inbox = useInboxStore()

  if (inbox.items.length > 0) return

  inbox.push({
    id: 'demo-sign-contract',
    moduleId: 'core',
    type: 'action',
    icon: 'description',
    title: 'Contrato de arriendo',
    subtitle: 'Firma requerida — De: Bufete Durango',
    action: 'Firmar',
    route: '/documents',
    timestamp: Date.now(),
    priority: 10,
  })

  inbox.push({
    id: 'demo-dictamen-expiry',
    moduleId: 'core',
    type: 'warning',
    icon: 'warning',
    title: 'Dictamen por vencer',
    subtitle: 'Vence en 12 dias',
    action: 'Renovar',
    route: '/wallet',
    timestamp: Date.now() - 3600_000,
    priority: 7,
  })

  inbox.push({
    id: 'demo-recent-sign',
    moduleId: 'core',
    type: 'info',
    icon: 'check_circle',
    title: 'Firmaste contrato.pdf',
    subtitle: 'Hace 2 horas',
    timestamp: Date.now() - 7200_000,
  })

  inbox.push({
    id: 'demo-recent-selfie',
    moduleId: 'core',
    type: 'info',
    icon: 'photo_camera',
    title: 'Selfie capturada',
    subtitle: 'Hoy',
    timestamp: Date.now() - 14400_000,
  })
}
