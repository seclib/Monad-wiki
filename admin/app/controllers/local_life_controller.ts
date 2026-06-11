import LocalDocument from '#models/local_document'
import LocalNote from '#models/local_note'
import LocalReminder from '#models/local_reminder'
import LocalServiceEntry from '#models/local_service_entry'
import { VaultService } from '#services/vault_service'
import {
  documentCategories,
  reminderValidator,
  serviceEntryValidator,
  updateDocumentValidator,
  updateNoteValidator,
  updateReminderValidator,
  updateServiceEntryValidator,
  noteValidator,
} from '#validators/local_life'
import type { HttpContext } from '@adonisjs/core/http'
import { DateTime } from 'luxon'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import {
  deleteFileIfExists,
  ensureDirectoryExists,
  getFileStatsIfExists,
  sanitizeFilename,
} from '../utils/fs.js'
import { STORAGE_PATH, assertProjectReadPath, assertProjectWritePath } from '../utils/paths.js'
import {
  createEncryptedStorageReadStream,
  encryptFileIntoStorage,
} from '../utils/storage_crypto.js'

const DOCUMENT_STORAGE_PATH = assertProjectWritePath(join(STORAGE_PATH, 'local-life', 'documents'))
const DOCUMENT_UPLOAD_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'txt', 'md']

function likeTerm(value: string) {
  return `%${value.trim()}%`
}

function parseTagsInput(value: unknown): string[] {
  if (Array.isArray(value))
    return value
      .map(String)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 12)
  if (typeof value !== 'string') return []

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return parseTagsInput(parsed)
  } catch {
    // Fall through to comma-separated tags.
  }

  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 12)
}

function nullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function safeAttachmentName(filename: string) {
  return sanitizeFilename(filename).replace(/"/g, '')
}

function wantsVaultSave(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

export default class LocalLifeController {
  private vaultService = new VaultService()

  async dashboardPage({ inertia }: HttpContext) {
    return inertia.render('local-life/dashboard')
  }

  async documentsPage({ inertia }: HttpContext) {
    return inertia.render('local-life/documents')
  }

  async notesPage({ inertia }: HttpContext) {
    return inertia.render('local-life/notes')
  }

  async servicesPage({ inertia }: HttpContext) {
    return inertia.render('local-life/services')
  }

  async dashboard({}: HttpContext) {
    const [documentsCount, notesCount, servicesCount, remindersCount] = await Promise.all([
      LocalDocument.query().count('* as total').first(),
      LocalNote.query().count('* as total').first(),
      LocalServiceEntry.query().count('* as total').first(),
      LocalReminder.query().where('completed', false).count('* as total').first(),
    ])

    const [recentDocuments, recentNotes, recentServices, reminders] = await Promise.all([
      LocalDocument.query().orderBy('updated_at', 'desc').limit(5),
      LocalNote.query().orderBy('pinned', 'desc').orderBy('updated_at', 'desc').limit(5),
      LocalServiceEntry.query().orderBy('updated_at', 'desc').limit(5),
      LocalReminder.query()
        .where('completed', false)
        .orderBy('due_date', 'asc')
        .orderBy('created_at', 'desc')
        .limit(8),
    ])

    return {
      today: DateTime.now().setZone('Indian/Reunion').setLocale('fr').toFormat('cccc dd/LL/yyyy'),
      counts: {
        documents: Number(documentsCount?.$extras.total ?? 0),
        notes: Number(notesCount?.$extras.total ?? 0),
        services: Number(servicesCount?.$extras.total ?? 0),
        reminders: Number(remindersCount?.$extras.total ?? 0),
      },
      recentDocuments,
      recentNotes,
      recentServices,
      reminders,
    }
  }

  async unifiedSearch({ request }: HttpContext) {
    const q = String(request.qs().q || '').trim()
    if (!q) return { documents: [], notes: [], services: [] }

    const term = likeTerm(q)
    const [documents, notes, services] = await Promise.all([
      LocalDocument.query()
        .where((query) => {
          query
            .where('title', 'like', term)
            .orWhere('description', 'like', term)
            .orWhere('original_filename', 'like', term)
        })
        .orderBy('updated_at', 'desc')
        .limit(10),
      LocalNote.query()
        .where((query) => {
          query.where('title', 'like', term).orWhere('content', 'like', term)
        })
        .orderBy('updated_at', 'desc')
        .limit(10),
      LocalServiceEntry.query()
        .where((query) => {
          query
            .where('name', 'like', term)
            .orWhere('category', 'like', term)
            .orWhere('commune', 'like', term)
            .orWhere('address', 'like', term)
            .orWhere('notes', 'like', term)
        })
        .orderBy('updated_at', 'desc')
        .limit(10),
    ])

    return { documents, notes, services }
  }

  async listDocuments({ request }: HttpContext) {
    const { q, category } = request.qs()
    const query = LocalDocument.query().orderBy('updated_at', 'desc').limit(100)

    if (typeof category === 'string' && category !== 'all') {
      query.where('category', category)
    }

    if (typeof q === 'string' && q.trim()) {
      const term = likeTerm(q)
      query.where((builder) => {
        builder
          .where('title', 'like', term)
          .orWhere('description', 'like', term)
          .orWhere('original_filename', 'like', term)
      })
    }

    return { documents: await query }
  }

  async uploadDocument({ request, response }: HttpContext) {
    const uploadedFile = request.file('file', {
      size: '50mb',
      extnames: DOCUMENT_UPLOAD_EXTENSIONS,
    })

    if (!uploadedFile) {
      return response.status(400).send({ message: 'Aucun fichier fourni.' })
    }

    if (!uploadedFile.isValid) {
      return response
        .status(422)
        .send({ message: 'Fichier invalide.', errors: uploadedFile.errors })
    }

    const category = String(request.input('category') || '')
    if (!documentCategories.includes(category as (typeof documentCategories)[number])) {
      return response.status(422).send({ message: 'Catégorie de document invalide.' })
    }

    await ensureDirectoryExists(DOCUMENT_STORAGE_PATH)

    const originalFilename = sanitizeFilename(uploadedFile.clientName)
    const storedFilename = `${randomUUID()}-${originalFilename}`
    const storedPath = assertProjectWritePath(join(DOCUMENT_STORAGE_PATH, storedFilename))
    if (!uploadedFile.tmpPath) {
      return response.status(500).send({ message: 'Fichier temporaire introuvable.' })
    }
    const tmpPath = assertProjectReadPath(uploadedFile.tmpPath)
    await encryptFileIntoStorage(tmpPath, storedPath)
    await deleteFileIfExists(tmpPath)

    const document = await LocalDocument.create({
      title: nullableString(request.input('title')) || uploadedFile.clientName,
      category,
      description: nullableString(request.input('description')),
      tags: parseTagsInput(request.input('tags')),
      original_filename: uploadedFile.clientName,
      stored_filename: storedFilename,
      mime_type:
        uploadedFile.type && uploadedFile.subtype
          ? `${uploadedFile.type}/${uploadedFile.subtype}`
          : null,
      size_bytes: uploadedFile.size,
    })

    if (wantsVaultSave(request.input('saveToVault'))) {
      const vault = await this.vaultService.mirrorDocument({
        title: document.title,
        sourcePath: assertProjectReadPath(join(DOCUMENT_STORAGE_PATH, document.stored_filename)),
        originalFilename: document.original_filename,
        tags: document.tags,
        category: document.category,
        description: document.description,
      })
      document.vault_path = vault.relativePath
      await document.save()
    }

    return response.status(201).send({ document })
  }

  async updateDocument({ request, response }: HttpContext) {
    const document = await LocalDocument.find(request.params().id)
    if (!document) return response.status(404).send({ message: 'Document introuvable.' })

    const payload = await request.validateUsing(updateDocumentValidator)
    if (payload.title !== undefined) document.title = payload.title
    if (payload.category !== undefined) document.category = payload.category
    if (payload.description !== undefined) document.description = payload.description
    if (payload.tags !== undefined) document.tags = payload.tags

    await document.save()
    return { document }
  }

  async deleteDocument({ request, response }: HttpContext) {
    const document = await LocalDocument.find(request.params().id)
    if (!document) return response.status(404).send({ message: 'Document introuvable.' })

    await deleteFileIfExists(join(DOCUMENT_STORAGE_PATH, document.stored_filename))
    await document.delete()
    return { message: 'Document supprimé.' }
  }

  async downloadDocument({ request, response }: HttpContext) {
    const document = await LocalDocument.find(request.params().id)
    if (!document) return response.status(404).send({ message: 'Document introuvable.' })

    const filePath = assertProjectReadPath(join(DOCUMENT_STORAGE_PATH, document.stored_filename))
    const stats = await getFileStatsIfExists(filePath)
    if (!stats)
      return response.status(404).send({ message: 'Fichier introuvable sur le stockage local.' })

    response.header('Content-Type', document.mime_type || 'application/octet-stream')
    response.header(
      'Content-Disposition',
      `attachment; filename="${safeAttachmentName(document.original_filename)}"`
    )
    response.header('Content-Length', String(stats.size))
    return response.stream(createEncryptedStorageReadStream(filePath))
  }

  async listNotes({ request }: HttpContext) {
    const q = String(request.qs().q || '').trim()
    const tag = String(request.qs().tag || '').trim()
    const query = LocalNote.query()
      .orderBy('pinned', 'desc')
      .orderBy('updated_at', 'desc')
      .limit(100)

    if (q) {
      const term = likeTerm(q)
      query.where((builder) =>
        builder.where('title', 'like', term).orWhere('content', 'like', term)
      )
    }

    const notes = await query
    return {
      notes: tag ? notes.filter((note) => note.tags.includes(tag)) : notes,
    }
  }

  async createNote({ request, response }: HttpContext) {
    const payload = await request.validateUsing(noteValidator)
    const note = await LocalNote.create({
      title: payload.title,
      content: payload.content,
      tags: payload.tags ?? [],
      pinned: payload.pinned ?? false,
    })

    if (wantsVaultSave(request.input('saveToVault'))) {
      const vault = await this.vaultService.saveMarkdown({
        folder: 'notes',
        title: note.title,
        content: note.content,
        tags: note.tags,
        metadata: { note_id: note.id },
      })
      note.vault_path = vault.relativePath
      await note.save()
    }

    return response.status(201).send({ note })
  }

  async updateNote({ request, response }: HttpContext) {
    const note = await LocalNote.find(request.params().id)
    if (!note) return response.status(404).send({ message: 'Note introuvable.' })

    const payload = await request.validateUsing(updateNoteValidator)
    if (payload.title !== undefined) note.title = payload.title
    if (payload.content !== undefined) note.content = payload.content
    if (payload.tags !== undefined) note.tags = payload.tags
    if (payload.pinned !== undefined) note.pinned = payload.pinned

    await note.save()

    if (wantsVaultSave(request.input('saveToVault'))) {
      const vault = await this.vaultService.saveMarkdown({
        folder: 'notes',
        title: note.title,
        content: note.content,
        tags: note.tags,
        metadata: { note_id: note.id },
      })
      note.vault_path = vault.relativePath
      await note.save()
    }

    return { note }
  }

  async deleteNote({ request, response }: HttpContext) {
    const note = await LocalNote.find(request.params().id)
    if (!note) return response.status(404).send({ message: 'Note introuvable.' })

    await note.delete()
    return { message: 'Note supprimée.' }
  }

  async listServices({ request }: HttpContext) {
    const { q, category } = request.qs()
    const query = LocalServiceEntry.query().orderBy('name', 'asc').limit(200)

    if (typeof category === 'string' && category !== 'all') {
      query.where('category', category)
    }

    if (typeof q === 'string' && q.trim()) {
      const term = likeTerm(q)
      query.where((builder) => {
        builder
          .where('name', 'like', term)
          .orWhere('category', 'like', term)
          .orWhere('commune', 'like', term)
          .orWhere('address', 'like', term)
          .orWhere('notes', 'like', term)
      })
    }

    return { services: await query }
  }

  async createService({ request, response }: HttpContext) {
    const payload = await request.validateUsing(serviceEntryValidator)
    const service = await LocalServiceEntry.create({
      name: payload.name,
      category: payload.category,
      phone: payload.phone ?? null,
      email: payload.email ?? null,
      address: payload.address ?? null,
      commune: payload.commune ?? null,
      latitude: payload.latitude ?? null,
      longitude: payload.longitude ?? null,
      notes: payload.notes ?? null,
      tags: payload.tags ?? [],
    })

    if (wantsVaultSave(request.input('saveToVault'))) {
      const vault = await this.vaultService.saveMarkdown({
        folder: 'services',
        title: service.name,
        tags: ['service', service.category, ...(service.tags ?? [])],
        metadata: {
          service_id: service.id,
          category: service.category,
          commune: service.commune,
        },
        content: [
          service.address ? `Adresse: ${service.address}` : '',
          service.commune ? `Commune: ${service.commune}` : '',
          service.phone ? `Téléphone: ${service.phone}` : '',
          service.email ? `Email: ${service.email}` : '',
          service.notes || '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      })
      service.vault_path = vault.relativePath
      await service.save()
    }

    return response.status(201).send({ service })
  }

  async updateService({ request, response }: HttpContext) {
    const service = await LocalServiceEntry.find(request.params().id)
    if (!service) return response.status(404).send({ message: 'Service introuvable.' })

    const payload = await request.validateUsing(updateServiceEntryValidator)
    if (payload.name !== undefined) service.name = payload.name
    if (payload.category !== undefined) service.category = payload.category
    if (payload.phone !== undefined) service.phone = payload.phone
    if (payload.email !== undefined) service.email = payload.email
    if (payload.address !== undefined) service.address = payload.address
    if (payload.commune !== undefined) service.commune = payload.commune
    if (payload.latitude !== undefined) service.latitude = payload.latitude
    if (payload.longitude !== undefined) service.longitude = payload.longitude
    if (payload.notes !== undefined) service.notes = payload.notes
    if (payload.tags !== undefined) service.tags = payload.tags

    await service.save()

    if (wantsVaultSave(request.input('saveToVault'))) {
      const vault = await this.vaultService.saveMarkdown({
        folder: 'services',
        title: service.name,
        tags: ['service', service.category, ...(service.tags ?? [])],
        metadata: {
          service_id: service.id,
          category: service.category,
          commune: service.commune,
        },
        content: [
          service.address ? `Adresse: ${service.address}` : '',
          service.commune ? `Commune: ${service.commune}` : '',
          service.phone ? `Téléphone: ${service.phone}` : '',
          service.email ? `Email: ${service.email}` : '',
          service.notes || '',
        ]
          .filter(Boolean)
          .join('\n\n'),
      })
      service.vault_path = vault.relativePath
      await service.save()
    }

    return { service }
  }

  async deleteService({ request, response }: HttpContext) {
    const service = await LocalServiceEntry.find(request.params().id)
    if (!service) return response.status(404).send({ message: 'Service introuvable.' })

    await service.delete()
    return { message: 'Service supprimé.' }
  }

  async listReminders({}: HttpContext) {
    return {
      reminders: await LocalReminder.query()
        .orderBy('completed', 'asc')
        .orderBy('due_date', 'asc')
        .orderBy('created_at', 'desc')
        .limit(100),
    }
  }

  async createReminder({ request, response }: HttpContext) {
    const payload = await request.validateUsing(reminderValidator)
    const reminder = await LocalReminder.create({
      title: payload.title,
      due_date: payload.due_date ? DateTime.fromJSDate(payload.due_date) : null,
      completed: payload.completed ?? false,
      notes: payload.notes ?? null,
    })
    return response.status(201).send({ reminder })
  }

  async updateReminder({ request, response }: HttpContext) {
    const reminder = await LocalReminder.find(request.params().id)
    if (!reminder) return response.status(404).send({ message: 'Rappel introuvable.' })

    const payload = await request.validateUsing(updateReminderValidator)
    if (payload.title !== undefined) reminder.title = payload.title
    if (payload.due_date !== undefined) {
      reminder.due_date = payload.due_date ? DateTime.fromJSDate(payload.due_date) : null
    }
    if (payload.completed !== undefined) reminder.completed = payload.completed
    if (payload.notes !== undefined) reminder.notes = payload.notes

    await reminder.save()
    return { reminder }
  }

  async deleteReminder({ request, response }: HttpContext) {
    const reminder = await LocalReminder.find(request.params().id)
    if (!reminder) return response.status(404).send({ message: 'Rappel introuvable.' })

    await reminder.delete()
    return { message: 'Rappel supprimé.' }
  }
}
