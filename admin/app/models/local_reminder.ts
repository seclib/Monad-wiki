import { DateTime } from 'luxon'
import { BaseModel, column, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'

export default class LocalReminder extends BaseModel {
  static namingStrategy = new SnakeCaseNamingStrategy()
  static table = 'local_reminders'

  @column({ isPrimary: true })
  declare id: number

  @column()
  declare title: string

  @column.date()
  declare due_date: DateTime | null

  @column()
  declare completed: boolean

  @column()
  declare notes: string | null

  @column.dateTime({ autoCreate: true })
  declare created_at: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updated_at: DateTime
}
