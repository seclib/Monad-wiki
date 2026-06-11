import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.alterTable('local_documents', (table) => {
      table.string('vault_path').nullable()
    })

    this.schema.alterTable('local_notes', (table) => {
      table.string('vault_path').nullable()
    })

    this.schema.alterTable('local_service_entries', (table) => {
      table.string('vault_path').nullable()
    })
  }

  async down() {
    this.schema.alterTable('local_documents', (table) => {
      table.dropColumn('vault_path')
    })

    this.schema.alterTable('local_notes', (table) => {
      table.dropColumn('vault_path')
    })

    this.schema.alterTable('local_service_entries', (table) => {
      table.dropColumn('vault_path')
    })
  }
}
