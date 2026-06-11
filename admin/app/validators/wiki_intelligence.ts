import vine from '@vinejs/vine'

export const semanticSearchSchema = vine.compile(
  vine.object({
    query: vine.string().trim().minLength(1),
    limit: vine.number().min(1).max(25).optional(),
    scoreThreshold: vine.number().min(0).max(1).optional(),
  })
)

export const wikiAskSchema = vine.compile(
  vine.object({
    question: vine.string().trim().minLength(1),
    model: vine.string().trim().minLength(1).optional(),
    limit: vine.number().min(1).max(10).optional(),
  })
)

export const wikiArticleQuerySchema = vine.compile(
  vine.object({
    articleTitle: vine.string().trim().optional(),
    query: vine.string().trim().optional(),
    source: vine.string().trim().optional(),
    model: vine.string().trim().minLength(1).optional(),
    limit: vine.number().min(1).max(15).optional(),
  })
)
