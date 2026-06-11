import axios, { type InternalAxiosRequestConfig } from 'axios'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CONFIG_PATH,
  MONAD_SECURITY_VIOLATION,
  assertProjectReadPath,
} from './paths.js'

type PermissionRule = {
  id: string
  description?: string
  allowedOrigins?: string[]
  allowedHosts?: string[]
  allowedPorts?: number[]
  allowPrivateNetwork?: boolean
  allowUserData?: boolean
}

type PermissionsFile = {
  version: 1
  outbound: PermissionRule[]
}

let installed = false
let cachedPermissions: PermissionsFile | null = null

function violation(): never {
  throw new Error(MONAD_SECURITY_VIOLATION)
}

function loadPermissions(): PermissionsFile {
  if (cachedPermissions) return cachedPermissions

  const permissionsPath = assertProjectReadPath(join(CONFIG_PATH, 'permissions.json'))
  const raw = readFileSync(permissionsPath, 'utf8')
  const parsed = JSON.parse(raw) as PermissionsFile

  if (parsed.version !== 1 || !Array.isArray(parsed.outbound)) {
    violation()
  }

  cachedPermissions = parsed
  return parsed
}

function normalizeOrigin(value: string) {
  return new URL(value).origin
}

function isPrivateNetworkHost(hostname: string) {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host === 'host.docker.internal' || host === '::1') return true
  if (host.startsWith('127.')) return true
  if (host.startsWith('10.')) return true
  if (host.startsWith('192.168.')) return true

  const parts = host.split('.').map((part) => Number(part))
  if (parts.length === 4 && parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true

  return host.startsWith('fd') || host.startsWith('fe80:')
}

function methodMaySendUserData(method?: string) {
  const normalized = (method || 'GET').toUpperCase()
  return !['GET', 'HEAD', 'OPTIONS'].includes(normalized)
}

export function assertNetworkAllowed(
  rawUrl: string,
  options: { sendsUserData?: boolean } = {}
) {
  if (!rawUrl || rawUrl.startsWith('/')) return

  let url: URL
  try {
    url = new URL(rawUrl)
  } catch {
    violation()
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    violation()
  }

  const permissions = loadPermissions()
  const port = Number(url.port || (url.protocol === 'https:' ? 443 : 80))

  const matchingRule = permissions.outbound.find((rule) => {
    const origins = rule.allowedOrigins?.map(normalizeOrigin) ?? []
    if (origins.includes(url.origin)) return true

    const hosts = rule.allowedHosts?.map((host) => host.toLowerCase()) ?? []
    if (hosts.includes(url.hostname.toLowerCase())) {
      return !rule.allowedPorts || rule.allowedPorts.includes(port)
    }

    if (rule.allowPrivateNetwork && isPrivateNetworkHost(url.hostname)) {
      return !rule.allowedPorts || rule.allowedPorts.includes(port)
    }

    return false
  })

  if (!matchingRule) {
    violation()
  }

  if (options.sendsUserData && !matchingRule.allowUserData) {
    violation()
  }
}

function fullAxiosUrl(config: InternalAxiosRequestConfig) {
  if (!config.url) return ''
  if (/^https?:\/\//i.test(config.url)) return config.url
  if (config.baseURL) return new URL(config.url, config.baseURL).toString()
  return config.url
}

export function installNetworkSecurity() {
  if (installed) return
  installed = true

  axios.interceptors.request.use((config) => {
    assertNetworkAllowed(fullAxiosUrl(config), {
      sendsUserData: methodMaySendUserData(config.method),
    })
    return config
  })

  const nativeFetch = globalThis.fetch?.bind(globalThis)
  if (nativeFetch) {
    globalThis.fetch = ((input: any, init?: RequestInit) => {
      const rawUrl =
        typeof input === 'string' || input instanceof URL ? input.toString() : input.url
      assertNetworkAllowed(rawUrl, {
        sendsUserData: methodMaySendUserData(init?.method),
      })
      return nativeFetch(input, init)
    }) as typeof fetch
  }
}
