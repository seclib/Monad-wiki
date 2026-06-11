import env from '#start/env'
import { defineConfig, targets } from '@adonisjs/core/logger'
import { LOGS_PATH } from '../app/utils/paths.js'

const loggerConfig = defineConfig({
  default: 'app',

  /**
   * The loggers object can be used to define multiple loggers.
   * By default, we configure only one logger (named "app").
   */
  loggers: {
    app: {
      enabled: true,
      name: env.get('APP_NAME'),
      level: env.get('NODE_ENV') === 'production' ? env.get('LOG_LEVEL') : 'debug',
      transport: {
        targets: targets()
          .push(targets.file({ destination: `${LOGS_PATH}/app.log`, mkdir: true }))
          .toArray(),
      },
    },
  },
})

export default loggerConfig

/**
 * Inferring types for the list of loggers you have configured
 * in your application.
 */
declare module '@adonisjs/core/types' {
  export interface LoggersList extends InferLoggers<typeof loggerConfig> {}
}
