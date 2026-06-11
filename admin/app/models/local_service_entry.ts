import { DateTime } from 'luxon'
import { BaseModel, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import { parseJsonArray, prepareJsonArray } from '../utils/json_columns.js'

export default class LocalServiceEntry extends BaseModel {
  static namingStrategy = new SnakeCaseNamingStrategy()
  static table = 'local_service_entries'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare name: string

  @column()
  declare category: string

  @column()
  declare phone: string | null

  @column()
  declare email: string | null

  @column()
  declare address: string | null

  @column()
  declare commune: string | null

  @column()
  declare latitude: number | null

  @column()
  declare longitude: number | null

  @column()
  declare notes: string | null

  @column({
    consume: parseJsonArray,
    prepare: prepareJsonArray,
  })
  declare tags: string[]

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime
}
