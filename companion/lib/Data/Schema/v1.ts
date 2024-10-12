import { Database as SQLiteDB } from 'better-sqlite3'
import { Logger } from '../../Log/Controller.js'

export function createTables(store: SQLiteDB | undefined, defaultTable: string, logger: Logger) {
	if (store) {
		try {
			const create = store.prepare(`CREATE TABLE IF NOT EXISTS ${defaultTable} (id STRING UNIQUE, value STRING);`)
			create.run()
		} catch (e) {
			logger.warn(`Error creating table ${defaultTable}`)
		}
	}
}
