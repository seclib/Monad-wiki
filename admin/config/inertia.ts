import KVStore from '#models/kv_store'
import { SystemService } from '#services/system_service'
import { defineConfig } from '@adonisjs/inertia'
import type { InferSharedProps } from '@adonisjs/inertia/types'

let assistantNameCache: { value: string; expiresAt: number } | null = null

export function invalidateAssistantNameCache() {
  assistantNameCache = null
}

const inertiaConfig = defineConfig({
  /**
   * Path to the Edge view that will be used as the root view for Inertia responses
   */
  rootView: 'inertia_layout',

  /**
   * Data that should be shared with all rendered pages
   */
  sharedData: {
    appVersion: () => SystemService.getAppVersion(),
    environment: process.env.NODE_ENV || 'production',
    projectName: () => process.env.PROJECT_NAME || 'MONAD',
    projectRegion: () => process.env.PROJECT_REGION || 'Reunion',
    projectTagline: () => process.env.PROJECT_TAGLINE || 'Optimisé pour La Réunion',
    projectDescription: () =>
      process.env.PROJECT_DESCRIPTION || 'Système local de gestion et de connaissance',
    defaultLanguage: () => process.env.DEFAULT_LANGUAGE || 'fr',
    appLocale: () => process.env.APP_LOCALE || 'fr_FR',
    dateFormat: () => process.env.DATE_FORMAT || 'DD/MM/YYYY',
    aiAssistantName: async () => {
      const now = Date.now()
      if (assistantNameCache && now < assistantNameCache.expiresAt) {
        return assistantNameCache.value
      }
      const customName = await KVStore.getValue('ai.assistantCustomName')
      const value = customName && customName.trim() ? customName : 'Assistant IA MONAD'
      assistantNameCache = { value, expiresAt: now + 60_000 }
      return value
    },
  },

  /**
   * Options for the server-side rendering
   */
  ssr: {
    enabled: false,
    entrypoint: 'inertia/app/ssr.tsx',
  },
})

export default inertiaConfig

declare module '@adonisjs/inertia/types' {
  export interface SharedProps extends InferSharedProps<typeof inertiaConfig> {}
}
