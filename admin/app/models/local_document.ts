import { DateTime } from 'luxon'
import { BaseModel, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import { parseJsonArray, prepareJsonArray } from '../utils/json_columns.js'

export default class LocalDocument extends BaseModel {
  static namingStrategy = new SnakeCaseNamingStrategy()
  static table = 'local_documents'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare category: string

  @column()
  declare description: string | null

  @column({
    consume: parseJsonArray,
    prepare: prepareJsonArray,
  })
  declare tags: string[]

  @column()
  declare original_filename: string

  @column()
  declare stored_filename: string

  @column()
  declare mime_type: string | null

  @column()
  declare size_bytes: number

  @column()
  declare vault_path: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime
}
