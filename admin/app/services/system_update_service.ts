import logger from '@adonisjs/core/services/logger'
import { readFileSync, existsSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import KVStore from '#models/kv_store'
import { CACHE_PATH, assertProjectReadPath, assertProjectWritePath } from '../utils/paths.js'

interface UpdateStatus {
  stage: 'idle' | 'starting' | 'pulling' | 'pulled' | 'recreating' | 'complete' | 'error'
  progress: number
  message: string
  timestamp: string
}

export class SystemUpdateService {
  private static SHARED_DIR = assertProjectWritePath(join(CACHE_PATH, 'update-shared'))
  private static REQUEST_FILE = assertProjectWritePath(
    join(SystemUpdateService.SHARED_DIR, 'update-request')
  )
  private static STATUS_FILE = assertProjectReadPath(
    join(SystemUpdateService.SHARED_DIR, 'update-status')
  )
  private static LOG_FILE = assertProjectReadPath(
    join(SystemUpdateService.SHARED_DIR, 'update-log')
  )

  /**
   * Requests a system update by creating a request file that the sidecar will detect
   */
  async requestUpdate(): Promise<{ success: boolean; message: string }> {
    try {
      const currentStatus = this.getUpdateStatus()
      if (currentStatus && !['idle', 'complete', 'error'].includes(currentStatus.stage)) {
        return {
          success: false,
          message: `Update already in progress (stage: ${currentStatus.stage})`,
        }
      }

      // Determine the Docker image tag to install.
      const latestVersion = await KVStore.getValue('system.latestVersion')

      const requestData = {
        requested_at: new Date().toISOString(),
        requester: 'admin-api',
        target_tag: latestVersion ? `v${latestVersion}` : 'latest',
      }

      await mkdir(SystemUpdateService.SHARED_DIR, { recursive: true })
      await writeFile(SystemUpdateService.REQUEST_FILE, JSON.stringify(requestData, null, 2))
      logger.info(
        `[SystemUpdateService]: System update requested (target tag: ${requestData.target_tag}) - sidecar will process shortly`
      )

      return {
        success: true,
        message: 'System update initiated. The admin container will restart during the process.',
      }
    } catch (error) {
      logger.error({ err: error }, '[SystemUpdateService] Failed to request system update')
      return {
        success: false,
        message: 'Failed to request system update. Check server logs for details.',
      }
    }
  }

  getUpdateStatus(): UpdateStatus | null {
    try {
      const statusFile = assertProjectReadPath(SystemUpdateService.STATUS_FILE)
      if (!existsSync(statusFile)) {
        return {
          stage: 'idle',
          progress: 0,
          message: 'No update in progress',
          timestamp: new Date().toISOString(),
        }
      }

      const statusContent = readFileSync(statusFile, 'utf-8')
      return JSON.parse(statusContent) as UpdateStatus
    } catch (error) {
      logger.error('[SystemUpdateService]: Failed to read update status:', error)
      return null
    }
  }

  getUpdateLogs(): string {
    try {
      const logFile = assertProjectReadPath(SystemUpdateService.LOG_FILE)
      if (!existsSync(logFile)) {
        return 'No update logs available'
      }

      return readFileSync(logFile, 'utf-8')
    } catch (error) {
      logger.error('[SystemUpdateService]: Failed to read update logs:', error)
      return `Error reading logs: ${error.message}`
    }
  }

  /**
   * Check if the update sidecar is reachable (i.e. shared volume is mounted)
   */
  isSidecarAvailable(): boolean {
    try {
      return existsSync(assertProjectReadPath(SystemUpdateService.SHARED_DIR))
    } catch (error) {
      return false
    }
  }
}
