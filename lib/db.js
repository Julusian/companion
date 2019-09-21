/*
 * This file is part of the Companion project
 * Copyright (c) 2018 Bitfocus AS
 * Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
 *
 * This program is free software.
 * You should have received a copy of the MIT licence as well as the Bitfocus
 * Individual Contributor License Agreement for companion along with
 * this program.
 *
 * You can be released from the requirements of the license by purchasing
 * a commercial license. Buying such a license is mandatory as soon as you
 * develop commercial activities involving the Companion software without
 * disclosing the source code of your own applications.
 *
 */


const debug = require('debug')('lib/db');
const fs    = require('fs-extra');

/**
	Simpel KVS som forventer at all data har plass i ram.

	Events: (system objektet)
		* db_loaded(data) - Alle data
		* db_saved(err) - kommandoen db_save ble fullført (eller feilet)

	Svarer på events: (system objektet)
		* db_set(key, value) - Sett key til value
		* db_get(key, cb) - Hent verdi til key i store, emitter svar til 'cb'
		* db_get_multiple([key1,key2], cb) - Henter verdier til flere keys, returnerer som array til 'cb'
		* db_save - Lagrer db fra minne til fil. Svarer med db_saved. (se over)
*/

const SAVE_INTERVAL = 4000; // Minimum 4 seconds between each save

class Db {
	constructor(system, cfgDir) {
		debug('new(db)');
		this.system = system;
		this.db = {};
		this.cfgDir = cfgDir;

		this.dirty = false;
		this.lastsave = 0;

		try {
			const data = fs.readFileSync(cfgDir + '/db');

			this.db = JSON.parse(data);
			debug('db loaded');

			let changed_after_load = false;
			// db defaults
			if (this.db.userconfig === undefined) {
				this.db.userconfig = {};
				changed_after_load = true;
			}

			// is page up 1->2 or 2->1?
			if (this.db.userconfig.page_direction_flipped === undefined) {
				this.db.userconfig.page_direction_flipped = false;
				changed_after_load = true;
			}

			system.emit('db_loaded', this.db);

			if (changed_after_load === true) {
				debug('config changed by default values after load, saving.');
				system.emit('db_save');
			}

		} catch (err) {

			if (err.code == 'ENOENT') {
				debug("readFile(db)","Couldnt read db, loading {}");
				system.emit('db_loaded', {});
			} else {
				throw err;
			}
		}

		system.on("db_all", (cb) => cb && cb(this.all()));
		
		system.on('db_del', this.del.bind(this));
		
		system.on('db_set', this.set.bind(this));
		system.on('db_set_multiple', this.setMultiple.bind(this));

		system.on('db_get', (keys, cb) => cb(this.get(keys)));
		system.on('db_get_multiple', (keys, cb) => cb(this.getMultiple(keys)));

		system.on('db_save', this.save.bind(this));
		system.on('db_dirty', this.setDirty.bind(this));

		// If last db_save was not handeled because of throttling, do it now
		setInterval(() => {
			if (Date.now() - this.lastsave > SAVE_INTERVAL && this.dirty) {
				system.emit('db_save');
			}
		}, 4000);
	}

	all() {
		debug("db_all(): returning all database values");
		return this.db;
	}

	del(key) {
		debug('db_del(' + key + ')');
		delete this.db[key];
	}

	set(key, value) {
		debug('db_set(' + key + ', ' + value + ')');
		this.db[key] = value;
	}
	setMultiple(keyvalueobj) {
		debug('db_set_multiple:');
		for (let key in keyvalueobj) {
			debug('db_set(' + key + ',' + keyvalueobj[key] + ')');
			this.db[key] = keyvalueobj[key];
		}
	}

	get(key) {
		debug('db_get(' + key + ')');
		return this.db[key];
	}
	getMultiple(keys) {
		if (typeof keys != 'object' || typeof keys.length == 'undefined') {
			throw new Error('keys is not an array');
		}
		return keys.map((key) => this.db[key]);
	}

	save() {
		if (Date.now() - this.lastsave > SAVE_INTERVAL) {
			debug("db_save","begin");

			this.dirty = false;
			this.lastsave = Date.now();

			fs.copy(this.cfgDir + '/db', this.cfgDir + '/db.bak', (err) => {
				if (err) {
					debug('db_save', 'Error making backup of config: ' + err);
				}

				fs.writeFile(this.cfgDir + '/db.tmp', JSON.stringify(this.db), (err) => {
					if (err) {
						debug('db_save', 'Error saving: ' + err);
						this.system.emit('db_saved', err);
						return;
					}

					debug("db_save", "written");

					fs.rename(this.cfgDir + '/db.tmp', this.cfgDir + '/db', (err) => {

						if (err) {
							this.system.emit('log', 'CORE(cb)', 'error', 'db.tmp->db failed: ' + err);
						}
						else {
							debug('db_save','renamed');
							this.system.emit('db_saved', null);
						}

					});

				});

			});

		} else {
			// Rate limited, so schedule for later
			this.dirty = true;
		}
	}

	setDirty() {
		// Do a save sometime within the next 10 seconds
		this.dirty = true;
	}
}

module.exports = Db;
