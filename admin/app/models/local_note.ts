import { DateTime } from 'luxon'
import { BaseModel, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import { parseJsonArray, prepareJsonArray } from '../utils/json_columns.js'

export default class LocalNote extends BaseModel {
  static namingStrategy = new SnakeCaseNamingStrategy()
  static table = 'local_notes'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column()
  declare content: string

  @column({
    consume: parseJsonArray,
    prepare: prepareJsonArray,
  })
  declare tags: string[]

  @column()
  declare pinned: boolean

  @column()
  declare vault_path: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime
}
