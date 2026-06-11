import env from '#start/env'
import { DateTime } from 'luxon'
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, extname, join, relative, resolve } from 'node:path'

export const VAULT_FOLDERS = ['notes', 'docs', 'ai', 'services'] as const
export type VaultFolder = (typeof VAULT_FOLDERS)[number]

export type VaultSaveInput = {
  folder: VaultFolder
  title: string
  content: string
  tags?: string[]
  filename?: string
  metadata?: Record<string, string | number | boolean | null | undefined>
}

export type VaultSaveResult = {
  relativePath: string
  absolutePath: string
}

export type VaultSearchResult = {
  title: string
  relativePath: string
  folder: string
  snippet: string
  tags: string[]
  updatedAt: string
}

export type VaultListItem = {
  title: string
  relativePath: string
  folder: string
  tags: string[]
  updatedAt: string
  sizeBytes: number
}

function slugify(value: string): string {
  const slug = value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 90)

  return slug || 'monad-note'
}

function escapeYamlString(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function frontmatter(input: VaultSaveInput): string {
  const today = DateTime.now().setZone('Indian/Reunion').toISODate()
  const tags = ['monad', ...(input.tags ?? [])]
    .map((tag) => slugify(tag).replace(/\./g, '-'))
    .filter(Boolean)

  const lines = [
    '---',
    `title: ${escapeYamlString(input.title)}`,
    `date: ${today}`,
    `tags: [${Array.from(new Set(tags)).join(', ')}]`,
    `source: ${escapeYamlString('MONAD')}`,
    `module: ${escapeYamlString(input.folder)}`,
  ]

  for (const [key, rawValue] of Object.entries(input.metadata ?? {})) {
    if (rawValue === undefined || rawValue === null) continue
    const safeKey = slugify(key).replace(/-/g, '_')
    const value = typeof rawValue === 'string' ? escapeYamlString(rawValue) : String(rawValue)
    lines.push(`${safeKey}: ${value}`)
  }

  lines.push('---', '')
  return lines.join('\n')
}

function parseFrontmatter(markdown: string): { title?: string; tags: string[] } {
  if (!markdown.startsWith('---')) return { tags: [] }
  const end = markdown.indexOf('\n---', 3)
  if (end === -1) return { tags: [] }

  const raw = markdown.slice(3, end)
  const title = raw.match(/^title:\s*"?([^"\n]+)"?/m)?.[1]
  const tagText = raw.match(/^tags:\s*\[([^\]]*)\]/m)?.[1] ?? ''
  const tags = tagText
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)

  return { title, tags }
}

export class VaultService {
  private readonly rootPath = resolve(env.get('VAULT_PATH') || '/vault')

  getRootPath() {
    return this.rootPath
  }

  async ensureVault() {
    await mkdir(this.rootPath, { recursive: true })
    await Promise.all(
      VAULT_FOLDERS.map((folder) => mkdir(join(this.rootPath, folder), { recursive: true }))
    )
    await mkdir(join(this.rootPath, 'docs', 'assets'), { recursive: true })
  }

  async status() {
    await this.ensureVault()
    const info = await stat(this.rootPath)
    return {
      enabled: true,
      rootPath: this.rootPath,
      writable: info.isDirectory(),
      folders: VAULT_FOLDERS,
    }
  }

  async saveMarkdown(input: VaultSaveInput): Promise<VaultSaveResult> {
    await this.ensureVault()

    const folderPath = this.resolveFolder(input.folder)
    const requestedName = input.filename
      ? basename(input.filename, extname(input.filename))
      : input.title
    const filename = `${DateTime.now().toFormat('yyyyLLdd-HHmmss')}-${slugify(requestedName)}.md`
    const absolutePath = join(folderPath, filename)
    const body = `${frontmatter(input)}${input.content.trim()}\n`

    await writeFile(absolutePath, body, 'utf8')

    return {
      absolutePath,
      relativePath: relative(this.rootPath, absolutePath),
    }
  }

  async saveAiOutput(input: {
    title: string
    prompt: string
    response: string
    model: string
    tags?: string[]
  }) {
    return this.saveMarkdown({
      folder: 'ai',
      title: input.title,
      tags: ['ai', ...(input.tags ?? [])],
      metadata: { model: input.model },
      content: [`## Question`, input.prompt, `## Réponse`, input.response].join('\n\n'),
    })
  }

  async mirrorDocument(input: {
    title: string
    sourcePath: string
    originalFilename: string
    tags?: string[]
    category?: string
    description?: string | null
  }) {
    await this.ensureVault()

    const assetName = `${DateTime.now().toFormat('yyyyLLdd-HHmmss')}-${slugify(input.originalFilename)}${extname(input.originalFilename)}`
    const assetPath = join(this.rootPath, 'docs', 'assets', assetName)
    await copyFile(input.sourcePath, assetPath)

    return this.saveMarkdown({
      folder: 'docs',
      title: input.title,
      tags: ['document', input.category, ...(input.tags ?? [])].filter(Boolean) as string[],
      metadata: {
        original_filename: input.originalFilename,
        asset_path: `assets/${assetName}`,
      },
      content: [
        input.description || 'Document local MONAD.',
        '',
        `Fichier: [${input.originalFilename}](assets/${assetName})`,
      ].join('\n'),
    })
  }

  async search(query: string, limit = 20): Promise<VaultSearchResult[]> {
    await this.ensureVault()
    const needle = query.trim().toLowerCase()
    if (!needle) return []

    const files = await this.listMarkdownFiles(this.rootPath)
    const results: VaultSearchResult[] = []

    for (const filePath of files) {
      const markdown = await readFile(filePath, 'utf8')
      const haystack = markdown.toLowerCase()
      const index = haystack.indexOf(needle)
      if (index === -1) continue

      const info = parseFrontmatter(markdown)
      const stats = await stat(filePath)
      const relativePath = relative(this.rootPath, filePath)
      const snippetStart = Math.max(0, index - 80)
      const snippet = markdown.slice(snippetStart, index + needle.length + 140).replace(/\s+/g, ' ')

      results.push({
        title: info.title || basename(filePath, '.md'),
        relativePath,
        folder: relativePath.split(/[\\/]/)[0] || '',
        snippet,
        tags: info.tags,
        updatedAt: stats.mtime.toISOString(),
      })

      if (results.length >= limit) break
    }

    return results
  }

  async list(folder?: VaultFolder, limit = 100): Promise<VaultListItem[]> {
    await this.ensureVault()
    const root = folder ? this.resolveFolder(folder) : this.rootPath
    const files = await this.listMarkdownFiles(root)
    const items = await Promise.all(
      files.map(async (filePath) => {
        const [markdown, stats] = await Promise.all([readFile(filePath, 'utf8'), stat(filePath)])
        const info = parseFrontmatter(markdown)
        const relativePath = relative(this.rootPath, filePath)

        return {
          title: info.title || basename(filePath, '.md'),
          relativePath,
          folder: relativePath.split(/[\\/]/)[0] || '',
          tags: info.tags,
          updatedAt: stats.mtime.toISOString(),
          sizeBytes: stats.size,
        }
      })
    )

    return items
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
      .slice(0, Math.max(1, Math.min(limit, 500)))
  }

  private resolveFolder(folder: VaultFolder): string {
    if (!VAULT_FOLDERS.includes(folder)) {
      throw new Error(`Invalid vault folder: ${folder}`)
    }
    return join(this.rootPath, folder)
  }

  private async listMarkdownFiles(root: string): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true })
    const files: string[] = []

    for (const entry of entries) {
      const fullPath = join(root, entry.name)
      if (entry.isDirectory()) {
        files.push(...(await this.listMarkdownFiles(fullPath)))
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath)
      }
    }

    return files
  }
}
