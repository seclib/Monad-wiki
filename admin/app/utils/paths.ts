import { existsSync, mkdirSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

export const MONAD_SECURITY_VIOLATION = 'MONAD_SECURITY_VIOLATION: external storage attempt blocked'

const rawProjectRoot = resolve(process.env.MONAD_PROJECT_ROOT || process.cwd())
export const PROJECT_ROOT = realpathSync.native(rawProjectRoot)

function isInsideProject(path: string) {
  const rel = relative(PROJECT_ROOT, path)
  return rel === '' || (!rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel))
}

function securityViolation(): never {
  throw new Error(MONAD_SECURITY_VIOLATION)
}

function nearestExistingPath(path: string) {
  let current = path
  while (!existsSync(current)) {
    const parent = dirname(current)
    if (parent === current) securityViolation()
    current = parent
  }

  return current
}

export function assertInsideProject(path: string) {
  const resolved = resolve(path)

  if (!isInsideProject(resolved)) {
    securityViolation()
  }

  const nearestExisting = nearestExistingPath(resolved)
  const realNearestExisting = realpathSync.native(nearestExisting)

  if (!isInsideProject(realNearestExisting)) {
    securityViolation()
  }

  if (existsSync(resolved)) {
    const realResolved = realpathSync.native(resolved)
    if (!isInsideProject(realResolved)) {
      securityViolation()
    }
  }

  return resolved
}

export function assertProjectWritePath(path: string) {
  const resolved = assertInsideProject(path)
  assertInsideProject(dirname(resolved))
  return resolved
}

export function assertProjectReadPath(path: string) {
  return assertInsideProject(path)
}

export function ensureProjectDirectory(path: string) {
  const resolved = assertProjectWritePath(path)
  mkdirSync(resolved, { recursive: true })
  return resolved
}

export function projectPath(...segments: string[]) {
  return assertInsideProject(resolve(PROJECT_ROOT, ...segments))
}

export function projectScopedPath(value: string | undefined, fallback: string) {
  const raw = value?.trim() || fallback
  const resolved = isAbsolute(raw) ? resolve(raw) : resolve(PROJECT_ROOT, raw)
  return assertInsideProject(resolved)
}

export const STORAGE_PATH = projectScopedPath(process.env.MONAD_STORAGE_PATH, 'storage')
export const LOGS_PATH = projectScopedPath(process.env.MONAD_LOGS_PATH, 'logs')
export const CACHE_PATH = projectScopedPath(process.env.MONAD_CACHE_PATH, 'cache')
export const CONFIG_PATH = projectScopedPath(process.env.MONAD_CONFIG_PATH, 'config')
export const MODELS_PATH = projectScopedPath(process.env.MONAD_MODELS_PATH, 'models')
export const DATA_PATH = projectScopedPath(process.env.MONAD_DATA_PATH, 'data')
export const VAULT_ROOT_PATH = projectScopedPath(process.env.VAULT_PATH, join('storage', 'vault'))

export function relativeProjectPath(path: string) {
  return relative(PROJECT_ROOT, assertInsideProject(path)) || '.'
}

;[STORAGE_PATH, LOGS_PATH, CACHE_PATH, CONFIG_PATH, MODELS_PATH, DATA_PATH].forEach((path) => {
  ensureProjectDirectory(path)
})
