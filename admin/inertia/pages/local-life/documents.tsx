import { Head } from '@inertiajs/react'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { IconDownload, IconTrash } from '@tabler/icons-react'
import LocalLifeLayout from './_layout'
import StyledButton from '~/components/StyledButton'
import { useNotifications } from '~/context/NotificationContext'
import {
  documentCategories,
  documentCategoryLabels,
  formatBytes,
  formatDateTime,
  parseTags,
} from '~/lib/local_life'
import type { LocalDocument, LocalDocumentCategory } from '../../../types/local_life'

export default function LocalLifeDocuments() {
  const { addNotification } = useNotifications()
  const [documents, setDocuments] = useState<LocalDocument[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | LocalDocumentCategory>('all')
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({
    title: '',
    category: 'administratif' as LocalDocumentCategory,
    description: '',
    tags: '',
  })
  const [file, setFile] = useState<File | null>(null)

  async function loadDocuments() {
    const response = await axios.get<{ documents: LocalDocument[] }>('/api/local-life/docs', {
      params: { q: query || undefined, category },
    })
    setDocuments(response.data.documents)
  }

  useEffect(() => {
    loadDocuments().catch(() =>
      addNotification({ type: 'error', message: 'Impossible de charger les documents.' })
    )
  }, [category])

  async function uploadDocument() {
    if (!file) {
      addNotification({ type: 'error', message: 'Sélectionne un fichier.' })
      return
    }

    setUploading(true)
    const data = new FormData()
    data.append('file', file)
    data.append('category', form.category)
    data.append('tags', JSON.stringify(parseTags(form.tags)))
    if (form.title.trim()) data.append('title', form.title.trim())
    if (form.description.trim()) data.append('description', form.description.trim())

    await axios.post('/api/local-life/docs', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    setUploading(false)
    setFile(null)
    setForm({ title: '', category: 'administratif', description: '', tags: '' })
    addNotification({ type: 'success', message: 'Document stocké localement.' })
    await loadDocuments()
  }

  async function deleteDocument(document: LocalDocument) {
    if (!window.confirm(`Supprimer "${document.title}" ?`)) return
    await axios.delete(`/api/local-life/docs/${document.id}`)
    addNotification({ type: 'success', message: 'Document supprimé.' })
    await loadDocuments()
  }

  return (
    <LocalLifeLayout>
      <Head title="Documents locaux" />

      <section className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <div className="rounded-md border border-border-default bg-surface-primary p-4 shadow-sm">
          <h3 className="text-xl font-semibold text-text-primary">Ajouter un document</h3>
          <div className="mt-4 grid gap-3">
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.md"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
              className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
            />
            <input
              value={form.title}
              onChange={(event) =>
                setForm((current) => ({ ...current, title: event.target.value }))
              }
              className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Titre"
            />
            <select
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value as LocalDocumentCategory,
                }))
              }
              className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
            >
              {documentCategories.map((item) => (
                <option key={item} value={item}>
                  {documentCategoryLabels[item]}
                </option>
              ))}
            </select>
            <input
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Tags séparés par virgules"
            />
            <textarea
              value={form.description}
              onChange={(event) =>
                setForm((current) => ({ ...current, description: event.target.value }))
              }
              className="min-h-24 rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Description"
            />
            <StyledButton
              icon="IconUpload"
              loading={uploading}
              onClick={() =>
                uploadDocument()
                  .catch(() => addNotification({ type: 'error', message: 'Upload impossible.' }))
                  .finally(() => setUploading(false))
              }
            >
              Stocker en local
            </StyledButton>
          </div>
        </div>

        <div className="rounded-md border border-border-default bg-surface-primary p-4 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h3 className="text-xl font-semibold text-text-primary">Documents</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    loadDocuments().catch(() =>
                      addNotification({ type: 'error', message: 'Recherche impossible.' })
                    )
                  }
                }}
                className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
                placeholder="Rechercher"
              />
              <select
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as 'all' | LocalDocumentCategory)
                }
                className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              >
                <option value="all">Toutes catégories</option>
                {documentCategories.map((item) => (
                  <option key={item} value={item}>
                    {documentCategoryLabels[item]}
                  </option>
                ))}
              </select>
              <StyledButton icon="IconSearch" onClick={() => loadDocuments()}>
                Filtrer
              </StyledButton>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full divide-y divide-border-default text-sm">
              <thead>
                <tr className="text-left text-text-secondary">
                  <th className="py-2 pr-3 font-semibold">Titre</th>
                  <th className="py-2 pr-3 font-semibold">Catégorie</th>
                  <th className="py-2 pr-3 font-semibold">Taille</th>
                  <th className="py-2 pr-3 font-semibold">Modifié</th>
                  <th className="py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {documents.map((document) => (
                  <tr key={document.id} className="text-text-primary">
                    <td className="py-3 pr-3">
                      <p className="font-semibold">{document.title}</p>
                      <p className="text-xs text-text-secondary">{document.original_filename}</p>
                      {document.tags.length > 0 && (
                        <p className="mt-1 text-xs text-desert-green">{document.tags.join(', ')}</p>
                      )}
                    </td>
                    <td className="py-3 pr-3">{documentCategoryLabels[document.category]}</td>
                    <td className="py-3 pr-3">{formatBytes(document.size_bytes)}</td>
                    <td className="py-3 pr-3">{formatDateTime(document.updated_at)}</td>
                    <td className="py-3">
                      <div className="flex gap-2">
                        <a
                          href={`/api/local-life/docs/${document.id}/download`}
                          className="inline-flex items-center rounded-md border border-desert-green px-2 py-1 text-desert-green hover:bg-desert-green hover:text-white"
                        >
                          <IconDownload className="size-4" />
                        </a>
                        <button
                          type="button"
                          onClick={() =>
                            deleteDocument(document).catch(() =>
                              addNotification({ type: 'error', message: 'Suppression impossible.' })
                            )
                          }
                          className="inline-flex items-center rounded-md border border-desert-red px-2 py-1 text-desert-red hover:bg-desert-red hover:text-white"
                        >
                          <IconTrash className="size-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!documents.length && (
              <p className="py-6 text-center text-text-secondary">Aucun document local.</p>
            )}
          </div>
        </div>
      </section>
    </LocalLifeLayout>
  )
}
