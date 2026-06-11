import { Head } from '@inertiajs/react'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { IconEdit, IconMapPin, IconPhone, IconTrash } from '@tabler/icons-react'
import LocalLifeLayout from './_layout'
import StyledButton from '~/components/StyledButton'
import { useNotifications } from '~/context/NotificationContext'
import { parseTags, serviceCategories, serviceCategoryLabels } from '~/lib/local_life'
import type { LocalServiceCategory, LocalServiceEntry } from '../../../types/local_life'

const emptyForm = {
  id: 0,
  name: '',
  category: 'pharmacies' as LocalServiceCategory,
  phone: '',
  email: '',
  address: '',
  commune: '',
  latitude: '',
  longitude: '',
  notes: '',
  tags: '',
}

export default function LocalLifeServices() {
  const { addNotification } = useNotifications()
  const [services, setServices] = useState<LocalServiceEntry[]>([])
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<'all' | LocalServiceCategory>('all')
  const [form, setForm] = useState(emptyForm)
  const editing = form.id > 0

  async function loadServices() {
    const response = await axios.get<{ services: LocalServiceEntry[] }>(
      '/api/local-life/services',
      {
        params: { q: query || undefined, category },
      }
    )
    setServices(response.data.services)
  }

  useEffect(() => {
    loadServices().catch(() =>
      addNotification({ type: 'error', message: 'Impossible de charger les services.' })
    )
  }, [category])

  function editService(service: LocalServiceEntry) {
    setForm({
      id: service.id,
      name: service.name,
      category: service.category,
      phone: service.phone || '',
      email: service.email || '',
      address: service.address || '',
      commune: service.commune || '',
      latitude: service.latitude === null ? '' : String(service.latitude),
      longitude: service.longitude === null ? '' : String(service.longitude),
      notes: service.notes || '',
      tags: service.tags.join(', '),
    })
  }

  async function saveService() {
    const payload = {
      name: form.name,
      category: form.category,
      phone: form.phone || null,
      email: form.email || null,
      address: form.address || null,
      commune: form.commune || null,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      notes: form.notes || null,
      tags: parseTags(form.tags),
    }

    if (editing) {
      await axios.patch(`/api/local-life/services/${form.id}`, payload)
      addNotification({ type: 'success', message: 'Service mis à jour.' })
    } else {
      await axios.post('/api/local-life/services', payload)
      addNotification({ type: 'success', message: 'Service ajouté.' })
    }

    setForm(emptyForm)
    await loadServices()
  }

  async function deleteService(service: LocalServiceEntry) {
    if (!window.confirm(`Supprimer "${service.name}" ?`)) return
    await axios.delete(`/api/local-life/services/${service.id}`)
    addNotification({ type: 'success', message: 'Service supprimé.' })
    if (form.id === service.id) setForm(emptyForm)
    await loadServices()
  }

  return (
    <LocalLifeLayout>
      <Head title="Services locaux" />

      <section className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="rounded-md border border-border-default bg-surface-primary p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-text-primary">
              {editing ? 'Modifier un service' : 'Ajouter un service'}
            </h3>
            {editing && (
              <StyledButton
                size="sm"
                variant="outline"
                icon="IconPlus"
                onClick={() => setForm(emptyForm)}
              >
                Nouveau
              </StyledButton>
            )}
          </div>

          <div className="mt-4 grid gap-3">
            <input
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Nom"
            />
            <select
              value={form.category}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  category: event.target.value as LocalServiceCategory,
                }))
              }
              className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
            >
              {serviceCategories.map((item) => (
                <option key={item} value={item}>
                  {serviceCategoryLabels[item]}
                </option>
              ))}
            </select>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                value={form.phone}
                onChange={(event) =>
                  setForm((current) => ({ ...current, phone: event.target.value }))
                }
                className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
                placeholder="Téléphone"
              />
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  setForm((current) => ({ ...current, email: event.target.value }))
                }
                className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
                placeholder="Email"
              />
            </div>
            <input
              value={form.address}
              onChange={(event) =>
                setForm((current) => ({ ...current, address: event.target.value }))
              }
              className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Adresse"
            />
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                value={form.commune}
                onChange={(event) =>
                  setForm((current) => ({ ...current, commune: event.target.value }))
                }
                className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
                placeholder="Commune"
              />
              <input
                type="number"
                step="any"
                value={form.latitude}
                onChange={(event) =>
                  setForm((current) => ({ ...current, latitude: event.target.value }))
                }
                className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
                placeholder="Latitude"
              />
              <input
                type="number"
                step="any"
                value={form.longitude}
                onChange={(event) =>
                  setForm((current) => ({ ...current, longitude: event.target.value }))
                }
                className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
                placeholder="Longitude"
              />
            </div>
            <input
              value={form.tags}
              onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
              className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Tags séparés par virgules"
            />
            <textarea
              value={form.notes}
              onChange={(event) =>
                setForm((current) => ({ ...current, notes: event.target.value }))
              }
              className="min-h-24 rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              placeholder="Notes"
            />
            <StyledButton
              icon={editing ? 'IconDeviceFloppy' : 'IconPlus'}
              onClick={() =>
                saveService().catch(() =>
                  addNotification({
                    type: 'error',
                    message: 'Impossible d’enregistrer le service.',
                  })
                )
              }
            >
              {editing ? 'Enregistrer' : 'Ajouter'}
            </StyledButton>
          </div>
        </div>

        <div className="rounded-md border border-border-default bg-surface-primary p-4 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <h3 className="text-xl font-semibold text-text-primary">Annuaire local</h3>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    loadServices().catch(() =>
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
                  setCategory(event.target.value as 'all' | LocalServiceCategory)
                }
                className="rounded-md border border-border-default bg-surface-secondary px-3 py-2 text-text-primary"
              >
                <option value="all">Toutes catégories</option>
                {serviceCategories.map((item) => (
                  <option key={item} value={item}>
                    {serviceCategoryLabels[item]}
                  </option>
                ))}
              </select>
              <StyledButton icon="IconSearch" onClick={() => loadServices()}>
                Filtrer
              </StyledButton>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {services.map((service) => (
              <article
                key={service.id}
                className="rounded-md border border-border-default bg-surface-secondary p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-lg font-semibold text-text-primary">{service.name}</h4>
                    <p className="text-sm text-desert-green">
                      {serviceCategoryLabels[service.category]}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => editService(service)}
                      className="rounded-md border border-desert-green p-2 text-desert-green hover:bg-desert-green hover:text-white"
                    >
                      <IconEdit className="size-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        deleteService(service).catch(() =>
                          addNotification({ type: 'error', message: 'Suppression impossible.' })
                        )
                      }
                      className="rounded-md border border-desert-red p-2 text-desert-red hover:bg-desert-red hover:text-white"
                    >
                      <IconTrash className="size-4" />
                    </button>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm text-text-secondary">
                  {service.phone && (
                    <p className="flex items-center gap-2">
                      <IconPhone className="size-4" />
                      {service.phone}
                    </p>
                  )}
                  {(service.address || service.commune) && (
                    <p className="flex items-center gap-2">
                      <IconMapPin className="size-4" />
                      {[service.address, service.commune].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {service.email && <p>{service.email}</p>}
                  {service.notes && <p className="pt-2 text-text-primary">{service.notes}</p>}
                  {service.tags.length > 0 && (
                    <p className="pt-2 text-xs text-desert-green">{service.tags.join(', ')}</p>
                  )}
                </div>
              </article>
            ))}
            {!services.length && (
              <p className="text-sm text-text-secondary">Aucun service local enregistré.</p>
            )}
          </div>
        </div>
      </section>
    </LocalLifeLayout>
  )
}
