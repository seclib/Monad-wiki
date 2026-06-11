import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('local_documents', (table) => {
      table.increments('id')
      table.string('title').notNullable()
      table.string('category', 40).notNullable()
      table.text('description').nullable()
      table.json('tags').nullable()
      table.string('original_filename').notNullable()
      table.string('stored_filename').notNullable().unique()
      table.string('mime_type').nullable()
      table.bigInteger('size_bytes').notNullable().defaultTo(0)
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.index(['category'])
    })

    this.schema.createTable('local_notes', (table) => {
      table.increments('id')
      table.string('title').notNullable()
      table.text('content').notNullable()
      table.json('tags').nullable()
      table.boolean('pinned').notNullable().defaultTo(false)
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.index(['pinned'])
    })

    this.schema.createTable('local_service_entries', (table) => {
      table.increments('id')
      table.string('name').notNullable()
      table.string('category', 60).notNullable()
      table.string('phone').nullable()
      table.string('email').nullable()
      table.text('address').nullable()
      table.string('commune').nullable()
      table.double('latitude').nullable()
      table.double('longitude').nullable()
      table.text('notes').nullable()
      table.json('tags').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.index(['category'])
      table.index(['commune'])
    })

    this.schema.createTable('local_reminders', (table) => {
      table.increments('id')
      table.string('title').notNullable()
      table.date('due_date').nullable()
      table.boolean('completed').notNullable().defaultTo(false)
      table.text('notes').nullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
      table.index(['completed'])
      table.index(['due_date'])
    })
  }

  async down() {
    this.schema.dropTable('local_reminders')
    this.schema.dropTable('local_service_entries')
    this.schema.dropTable('local_notes')
    this.schema.dropTable('local_documents')
  }
}
