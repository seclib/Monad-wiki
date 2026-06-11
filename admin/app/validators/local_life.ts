import vine from '@vinejs/vine'

export const documentCategories = ['administratif', 'sante', 'travail', 'education', 'maison'] as const
export const serviceCategories = [
  'pharmacies',
  'medecins',
  'administrations',
  'transports',
  'commerces_locaux',
] as const

const tagsSchema = vine.array(vine.string().trim().minLength(1).maxLength(40)).maxLength(12).optional()

export const documentMetadataValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255).optional(),
    category: vine.enum(documentCategories),
    description: vine.string().trim().maxLength(2000).nullable().optional(),
    tags: tagsSchema,
  })
)

export const updateDocumentValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255).optional(),
    category: vine.enum(documentCategories).optional(),
    description: vine.string().trim().maxLength(2000).nullable().optional(),
    tags: tagsSchema,
  })
)

export const noteValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255),
    content: vine.string().trim().maxLength(100000),
    tags: tagsSchema,
    pinned: vine.boolean().optional(),
  })
)

export const updateNoteValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255).optional(),
    content: vine.string().trim().maxLength(100000).optional(),
    tags: tagsSchema,
    pinned: vine.boolean().optional(),
  })
)

export const serviceEntryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255),
    category: vine.enum(serviceCategories),
    phone: vine.string().trim().maxLength(80).nullable().optional(),
    email: vine.string().trim().email().maxLength(255).nullable().optional(),
    address: vine.string().trim().maxLength(2000).nullable().optional(),
    commune: vine.string().trim().maxLength(120).nullable().optional(),
    latitude: vine.number().min(-90).max(90).nullable().optional(),
    longitude: vine.number().min(-180).max(180).nullable().optional(),
    notes: vine.string().trim().maxLength(5000).nullable().optional(),
    tags: tagsSchema,
  })
)

export const updateServiceEntryValidator = vine.compile(
  vine.object({
    name: vine.string().trim().minLength(1).maxLength(255).optional(),
    category: vine.enum(serviceCategories).optional(),
    phone: vine.string().trim().maxLength(80).nullable().optional(),
    email: vine.string().trim().email().maxLength(255).nullable().optional(),
    address: vine.string().trim().maxLength(2000).nullable().optional(),
    commune: vine.string().trim().maxLength(120).nullable().optional(),
    latitude: vine.number().min(-90).max(90).nullable().optional(),
    longitude: vine.number().min(-180).max(180).nullable().optional(),
    notes: vine.string().trim().maxLength(5000).nullable().optional(),
    tags: tagsSchema,
  })
)

export const reminderValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255),
    due_date: vine.date().nullable().optional(),
    completed: vine.boolean().optional(),
    notes: vine.string().trim().maxLength(2000).nullable().optional(),
  })
)

export const updateReminderValidator = vine.compile(
  vine.object({
    title: vine.string().trim().minLength(1).maxLength(255).optional(),
    due_date: vine.date().nullable().optional(),
    completed: vine.boolean().optional(),
    notes: vine.string().trim().maxLength(2000).nullable().optional(),
  })
)
