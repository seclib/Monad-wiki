export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value !== 'string' || value.trim() === '') return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

export function prepareJsonArray(value: unknown): string {
  if (!Array.isArray(value)) return JSON.stringify([])
  return JSON.stringify(value.map(String))
}
