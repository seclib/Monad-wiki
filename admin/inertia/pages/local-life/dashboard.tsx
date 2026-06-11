import { Head, Link } from '@inertiajs/react'
import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import {
  IconBell,
  IconBuildingStore,
  IconCheck,
  IconFileText,
  IconNotebook,
} from '@tabler/icons-react'
import LocalLifeLayout from './_layout'
import StyledButton from '~/components/StyledButton'
import { useNotifications } from '~/context/NotificationContext'
import {
  documentCategoryLabels,
  formatDate,
  formatDateTime,
  serviceCategoryLabels,
} from '~/lib/local_life'
import type {
  LocalDocument,
  LocalLifeDashboardData,
  LocalNote,
  LocalReminder,
  LocalServiceEntry,
} from '../../../types/local_life'

type SearchResults = {
  documents: LocalDocument[]
  notes: LocalNote[]
  services: LocalServiceEntry[]
}

const emptyDashboard: LocalLifeDashboardData = {
  today: '',
  counts: { documents: 0, notes: 0, services: 0, reminders: 0 },
  recentDocuments: [],
  recentNotes: [],
  recentServices: [],
  reminders: [],
}

export default function LocalLifeDashboard() {
  const { addNotification } = useNotifications()
  const [dashboard, setDashboard] = useState<LocalLifeDashboardData>(emptyDashboard)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [quickNote, setQuickNote] = useState({ title: '', content: '' })
  const [reminder, setReminder] = useState({ title: '', due_date: '' })

  const hasSearchResults = useMemo(() => {
    if (!results) return false
    return results.documents.length + results.notes.length + results.services.length > 0
  }, [results])

  async function loadDashboard() {
    setLoading(true)
    const response = await axios.get<LocalLifeDashboardData>('/api/local-life/dashboard')
    setDashboard(response.data)
    setLoading(false)
  }

  useEffect(() => {
    loadDashboard().catch(() => {
      setLoading(false)
      addNotification({ type: 'error', message: 'Impossible de charger le tableau local.' })
    })
  }, [])

  async function runSearch(value = search) {
    const q = value.trim()
    if (!q) {
      setResults(null)
      return
    }
    const response = await axios.get<SearchResults>('/api/local-life/search', { params: { q } })
    setResults(response.data)
  }

  async function createQuickNote() {
    if (!quickNote.title.trim()) return
    await axios.post('/api/local-life/notes', {
      title: quickNote.title,
      content: quickNote.content || quickNote.title,
      tags: ['rapide'],
    })
    setQuickNote({ title: '', content: '' })
    addNotification({ type: 'success', message: 'Note rapide enregistrée.' })
    await loadDashboard()
  }

  async function createReminder() {
    if (!reminder.title.trim()) return
    await axios.post('/api/local-life/reminders', {
      title: reminder.title,
      due_date: reminder.due_date || null,
    })
    setReminder({ title: '', due_date: '' })
    addNotification({ type: 'success', message: 'Rappel ajouté.' })
    await loadDashboard()
  }

  async function toggleReminder(item: LocalReminder) {
    await axios.patch(`/api/local-life/reminders/${item.id}`, { completed: !item.completed })
    await loadDashboard()
  }

  return (
    <LocalLifeLayout>
      <Head title="Vie locale" />

      <section className="grid gap-3 md:grid-cols-4">
        <MetricCard icon={<IconFileText />} label="Documents" value={dashboard.counts.documents} />
        <MetricCard icon={<IconNotebook />} label="Notes" value={dashboard.counts.notes} />
        <MetricCard
          icon={<IconBuildingStore />}
          label="Services"
          value={dashboard.counts.services}
        />
        <MetricCard icon={<IconBell />} label="Rappels actifs" value={dashboard.counts.reminders} />
      </section>

      <section className="rounded-md border border-border-default bg-surface-primary p-4 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-xl font-semibold text-text-primary">Aujourd'hui</h3>
            <p className="text-text-secondary">{dashboard.today || 'Chargement...'}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter')
                  runSearch().catch(() => {
                    addNotification({ type: 'error', message: 'Recherche indisponible.' })
                  })
              }}
              className="min-w-72 rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Recherche locale"
            />
            <StyledButton
              icon="IconSearch"
              onClick={() =>
                runSearch().catch(() =>
                  addNotification({ type: 'error', message: 'Recherche indisponible.' })
                )
              }
            >
              Rechercher
            </StyledButton>
          </div>
        </div>

        {results && (
          <div className="mt-4 border-t border-border-default pt-4">
            {hasSearchResults ? (
              <div className="grid gap-3 md:grid-cols-3">
                <SearchColumn title="Documents" href="/local-life/documents">
                  {results.documents.map((item) => (
                    <ResultLine
                      key={`doc-${item.id}`}
                      title={item.title}
                      meta={documentCategoryLabels[item.category]}
                    />
                  ))}
                </SearchColumn>
                <SearchColumn title="Notes" href="/local-life/notes">
                  {results.notes.map((item) => (
                    <ResultLine
                      key={`note-${item.id}`}
                      title={item.title}
                      meta={formatDateTime(item.updated_at)}
                    />
                  ))}
                </SearchColumn>
                <SearchColumn title="Services" href="/local-life/services">
                  {results.services.map((item) => (
                    <ResultLine
                      key={`service-${item.id}`}
                      title={item.name}
                      meta={serviceCategoryLabels[item.category]}
                    />
                  ))}
                </SearchColumn>
              </div>
            ) : (
              <p className="text-text-secondary">Aucun résultat local.</p>
            )}
          </div>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border-default bg-surface-primary p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-text-primary">Note rapide</h3>
          <div className="mt-3 grid gap-2">
            <input
              value={quickNote.title}
              onChange={(event) =>
                setQuickNote((current) => ({ ...current, title: event.target.value }))
              }
              className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Titre"
            />
            <textarea
              value={quickNote.content}
              onChange={(event) =>
                setQuickNote((current) => ({ ...current, content: event.target.value }))
              }
              className="min-h-24 rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Contenu Markdown"
            />
            <StyledButton
              icon="IconPlus"
              onClick={() =>
                createQuickNote().catch(() =>
                  addNotification({ type: 'error', message: 'Note non enregistrée.' })
                )
              }
            >
              Ajouter la note
            </StyledButton>
          </div>
        </div>

        <div className="rounded-md border border-border-default bg-surface-primary p-4 shadow-sm">
          <h3 className="text-lg font-semibold text-text-primary">Rappels</h3>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              value={reminder.title}
              onChange={(event) =>
                setReminder((current) => ({ ...current, title: event.target.value }))
              }
              className="flex-1 rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Rappel"
            />
            <input
              type="date"
              value={reminder.due_date}
              onChange={(event) =>
                setReminder((current) => ({ ...current, due_date: event.target.value }))
              }
              className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
            />
            <StyledButton
              icon="IconPlus"
              onClick={() =>
                createReminder().catch(() =>
                  addNotification({ type: 'error', message: 'Rappel non ajouté.' })
                )
              }
            >
              Ajouter
            </StyledButton>
          </div>
          <div className="mt-4 space-y-2">
            {dashboard.reminders.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() =>
                  toggleReminder(item).catch(() =>
                    addNotification({ type: 'error', message: 'Rappel non mis à jour.' })
                  )
                }
                className="flex w-full items-center justify-between rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-left text-text-primary hover:border-desert-green"
              >
                <span>{item.title}</span>
                <span className="flex items-center gap-2 text-sm text-text-secondary">
                  {formatDate(item.due_date)}
                  <IconCheck className="size-4" />
                </span>
              </button>
            ))}
            {!dashboard.reminders.length && !loading && (
              <p className="text-sm text-text-secondary">Aucun rappel actif.</p>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <RecentList title="Documents récents" href="/local-life/documents">
          {dashboard.recentDocuments.map((item) => (
            <ResultLine
              key={item.id}
              title={item.title}
              meta={documentCategoryLabels[item.category]}
            />
          ))}
        </RecentList>
        <RecentList title="Notes récentes" href="/local-life/notes">
          {dashboard.recentNotes.map((item) => (
            <ResultLine
              key={item.id}
              title={item.title}
              meta={item.tags.join(', ') || formatDateTime(item.updated_at)}
            />
          ))}
        </RecentList>
        <RecentList title="Services récents" href="/local-life/services">
          {dashboard.recentServices.map((item) => (
            <ResultLine
              key={item.id}
              title={item.name}
              meta={item.commune || serviceCategoryLabels[item.category]}
            />
          ))}
        </RecentList>
      </section>
    </LocalLifeLayout>
  )
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="rounded-md border border-border-default bg-surface-primary p-4 shadow-sm">
      <div className="flex items-center justify-between text-desert-green">
        <span className="[&>svg]:size-7">{icon}</span>
        <span className="text-3xl font-bold text-text-primary">{value}</span>
      </div>
      <p className="mt-2 text-sm font-semibold text-text-secondary">{label}</p>
    </div>
  )
}

function SearchColumn({
  title,
  href,
  children,
}: {
  title: string
  href: string
  children: React.ReactNode
}) {
  return (
    <div>
      <Link href={href} className="font-semibold text-desert-green hover:underline">
        {title}
      </Link>
      <div className="mt-2 space-y-2">
        {children || <p className="text-sm text-text-secondary">Aucun résultat.</p>}
      </div>
    </div>
  )
}

function RecentList({
  title,
  href,
  children,
}: {
  title: string
  href: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-md border border-border-default bg-surface-primary p-4 shadow-sm">
      <Link href={href} className="text-lg font-semibold text-desert-green hover:underline">
        {title}
      </Link>
      <div className="mt-3 space-y-2">
        {children || <p className="text-sm text-text-secondary">Rien pour le moment.</p>}
      </div>
    </div>
  )
}

function ResultLine({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="rounded-md bg-surface-secondary px-3 py-2">
      <p className="font-medium text-text-primary">{title}</p>
      <p className="text-sm text-text-secondary">{meta}</p>
    </div>
  )
}
