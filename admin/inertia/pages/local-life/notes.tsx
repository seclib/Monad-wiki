import { Head } from '@inertiajs/react'
import axios from 'axios'
import { useEffect, useMemo, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { IconPin } from '@tabler/icons-react'
import LocalLifeLayout from './_layout'
import StyledButton from '~/components/StyledButton'
import { useNotifications } from '~/context/NotificationContext'
import { formatDateTime, parseTags } from '~/lib/local_life'
import type { LocalNote } from '../../../types/local_life'

const emptyForm = { id: 0, title: '', content: '', tags: '', pinned: false }

export default function LocalLifeNotes() {
  const { addNotification } = useNotifications()
  const [notes, setNotes] = useState<LocalNote[]>([])
  const [query, setQuery] = useState('')
  const [form, setForm] = useState(emptyForm)
  const [preview, setPreview] = useState(false)

  const editing = form.id > 0
  const selectedNote = useMemo(() => notes.find((note) => note.id === form.id), [notes, form.id])

  async function loadNotes() {
    const response = await axios.get<{ notes: LocalNote[] }>('/api/local-life/notes', {
      params: { q: query || undefined },
    })
    setNotes(response.data.notes)
  }

  useEffect(() => {
    loadNotes().catch(() =>
      addNotification({ type: 'error', message: 'Impossible de charger les notes.' })
    )
  }, [])

  function editNote(note: LocalNote) {
    setForm({
      id: note.id,
      title: note.title,
      content: note.content,
      tags: note.tags.join(', '),
      pinned: note.pinned,
    })
    setPreview(false)
  }

  async function saveNote() {
    const payload = {
      title: form.title,
      content: form.content,
      tags: parseTags(form.tags),
      pinned: form.pinned,
    }

    if (editing) {
      await axios.patch(`/api/local-life/notes/${form.id}`, payload)
      addNotification({ type: 'success', message: 'Note mise à jour.' })
    } else {
      await axios.post('/api/local-life/notes', payload)
      addNotification({ type: 'success', message: 'Note créée.' })
    }

    setForm(emptyForm)
    await loadNotes()
  }

  async function deleteNote(note: LocalNote) {
    if (!window.confirm(`Supprimer "${note.title}" ?`)) return
    await axios.delete(`/api/local-life/notes/${note.id}`)
    addNotification({ type: 'success', message: 'Note supprimée.' })
    if (form.id === note.id) setForm(emptyForm)
    await loadNotes()
  }

  return (
    <LocalLifeLayout>
      <Head title="Notes locales" />

      <section className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="rounded-md border border-border-default bg-surface-primary p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-text-primary">Notes</h3>
            <StyledButton
              size="sm"
              variant="outline"
              icon="IconPlus"
              onClick={() => setForm(emptyForm)}
            >
              Nouvelle
            </StyledButton>
          </div>
          <div className="mt-3 flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  loadNotes().catch(() =>
                    addNotification({ type: 'error', message: 'Recherche impossible.' })
                  )
                }
              }}
              className="w-full rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Rechercher"
            />
            <StyledButton size="sm" icon="IconSearch" onClick={() => loadNotes()}>
              OK
            </StyledButton>
          </div>
          <div className="mt-4 space-y-2">
            {notes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => editNote(note)}
                className="w-full rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-left hover:border-desert-green"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-text-primary">{note.title}</p>
                  {note.pinned && <IconPin className="size-4 shrink-0 text-desert-orange" />}
                </div>
                <p className="line-clamp-2 text-sm text-text-secondary">{note.content}</p>
                <p className="mt-1 text-xs text-desert-green">
                  {note.tags.join(', ') || formatDateTime(note.updated_at)}
                </p>
              </button>
            ))}
            {!notes.length && <p className="text-sm text-text-secondary">Aucune note locale.</p>}
          </div>
        </div>

        <div className="rounded-md border border-border-default bg-surface-primary p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h3 className="text-xl font-semibold text-text-primary">
              {editing ? 'Modifier la note' : 'Créer une note'}
            </h3>
            <div className="flex gap-2">
              <StyledButton
                size="sm"
                variant={preview ? 'secondary' : 'outline'}
                icon="IconEye"
                onClick={() => setPreview((current) => !current)}
              >
                Aperçu
              </StyledButton>
              {selectedNote && (
                <StyledButton
                  size="sm"
                  variant="danger"
                  icon="IconTrash"
                  onClick={() =>
                    deleteNote(selectedNote).catch(() =>
                      addNotification({ type: 'error', message: 'Suppression impossible.' })
                    )
                  }
                >
                  Supprimer
                </StyledButton>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Titre"
            />
            <input
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Tags séparés par virgules"
            />
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-text-primary">
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(event) =>
                  setForm((current) => ({ ...current, pinned: event.target.checked }))
                }
              />
              Épingler
            </label>

            {preview ? (
              <div className="min-h-72 rounded-md border border-border-default bg-surface-secondary p-4 text-text-primary">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {form.content || '_Aucun contenu_'}
                </ReactMarkdown>
              </div>
            ) : (
              <textarea
                value={form.content}
                onChange={(event) =>
                  setForm((current) => ({ ...current, content: event.target.value }))
                }
                className="min-h-72 rounded-md border border-border-default bg-surface-secondary px-3 py-2 font-mono text-sm text-text-primary"
                placeholder="Contenu Markdown"
              />
            )}

            <StyledButton
              icon={editing ? 'IconDeviceFloppy' : 'IconPlus'}
              onClick={() =>
                saveNote().catch(() =>
                  addNotification({ type: 'error', message: 'Impossible d’enregistrer la note.' })
                )
              }
            >
              {editing ? 'Enregistrer' : 'Créer la note'}
            </StyledButton>
          </div>
        </div>
      </section>
    </LocalLifeLayout>
  )
}
