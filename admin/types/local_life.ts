export type LocalDocumentCategory = 'administratif' | 'sante' | 'travail' | 'education' | 'maison'
export type LocalServiceCategory =
  | 'pharmacies'
  | 'medecins'
  | 'administrations'
  | 'transports'
  | 'commerces_locaux'

export interface LocalDocument {
  id: number
  title: string
  category: LocalDocumentCategory
  description: string | null
  tags: string[]
  original_filename: string
  stored_filename: string
  mime_type: string | null
  size_bytes: number
  vault_path: string | null
  created_at: string
  updated_at: string
}

export interface LocalNote {
  id: number
  title: string
  content: string
  tags: string[]
  pinned: boolean
  vault_path: string | null
  created_at: string
  updated_at: string
}

export interface LocalServiceEntry {
  id: number
  name: string
  category: LocalServiceCategory
  phone: string | null
  email: string | null
  address: string | null
  commune: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  tags: string[]
  vault_path: string | null
  created_at: string
  updated_at: string
}

export interface LocalReminder {
  id: number
  title: string
  due_date: string | null
  completed: boolean
  notes: string | null
  created_at: string
  updated_at: string
}

export interface LocalLifeDashboardData {
  today: string
  counts: {
    documents: number
    notes: number
    services: number
    reminders: number
  }
  recentDocuments: LocalDocument[]
  recentNotes: LocalNote[]
  recentServices: LocalServiceEntry[]
  reminders: LocalReminder[]
}
