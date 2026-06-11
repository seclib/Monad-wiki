import { defineConfig } from '@adonisjs/core/bodyparser'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { CACHE_PATH, ensureProjectDirectory } from '../app/utils/paths.js'

const bodyParserConfig = defineConfig({
  /**
   * The bodyparser middleware will parse the request body
   * for the following HTTP methods.
   */
  allowedMethods: ['POST', 'PUT', 'PATCH', 'DELETE'],

  /**
   * Config for the "application/x-www-form-urlencoded"
   * content-type parser
   */
  form: {
    convertEmptyStringsToNull: true,
    types: ['application/x-www-form-urlencoded'],
  },

  /**
   * Config for the JSON parser
   */
  json: {
    convertEmptyStringsToNull: true,
    types: [
      'application/json',
      'application/json-patch+json',
      'application/vnd.api+json',
      'application/csp-report',
    ],
  },

  /**
   * Config for the "multipart/form-data" content-type parser.
   * File uploads are handled by the multipart parser.
   */
  multipart: {
    /**
     * Enabling auto process allows bodyparser middleware to
     * move uploaded files into MONAD's project-local cache before
     * controllers encrypt final copies into storage.
     */
    autoProcess: true,
    convertEmptyStringsToNull: true,
    processManually: [],
    tmpFileName: () => join(ensureProjectDirectory(join(CACHE_PATH, 'uploads')), randomUUID()),

    /**
     * Maximum limit of data to parse including all files
     * and fields
     */
    limit: '110mb', // Set to 110MB to allow for some overhead beyond the 100MB file size limit
    types: ['multipart/form-data'],
  },
})

export default bodyParserConfig
