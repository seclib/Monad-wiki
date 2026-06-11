import type { LocalDocumentCategory, LocalServiceCategory } from '../../types/local_life'

export const documentCategoryLabels: Record<LocalDocumentCategory, string> = {
  administratif: 'Administratif',
  sante: 'Santé',
  travail: 'Travail',
  education: 'Éducation',
  maison: 'Maison',
}

export const serviceCategoryLabels: Record<LocalServiceCategory, string> = {
  pharmacies: 'Pharmacies',
  medecins: 'Médecins',
  administrations: 'Administrations',
  transports: 'Transports',
  commerces_locaux: 'Commerces locaux',
}

export const documentCategories = Object.keys(documentCategoryLabels) as LocalDocumentCategory[]
export const serviceCategories = Object.keys(serviceCategoryLabels) as LocalServiceCategory[]

export function parseTags(value: string): string[] {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12)
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 o'
  const units = ['o', 'Ko', 'Mo', 'Go']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

export function formatDate(value?: string | null): string {
  if (!value) return 'Sans date'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatDateTime(value?: string | null): string {
  if (!value) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}
