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

const debug = require('debug')('lib/page');

class Pages {
	constructor(system, io, db) {
		this.system = system;
		this.io = io;

		this.pages = db.get('page');
		// Default values
		if (this.pages === undefined) {
			this.pages = {};
			for (let n = 1; n <= 99; n++) {
				if (this.pages[''+n] === undefined) {
					this.pages[''+n] = {
						name: 'PAGE'
					};
				}
			}
		}
	
		system.on('page_set_noredraw',this.setPageNoredraw.bind(this));
		system.on('page_set', this.setPage.bind(this));
		system.on('get_page', (cb) => cb(this.getPages()));
	
		system.on('io_connect', this.clientConnect.bind(this));
	}

	setPageNoredraw(index, value) {
		debug('NR: Set page ' + index + ' to ', value);
		this.pages[index] = value;
		this.io.emit('set_page', index, value);
	}

	setPage(index, value, socket) {
		debug('Set page ' + index + ' to ', value);
		this.pages[index] = value;

		if (socket !== undefined) {
			socket.broadcast.emit('set_page', index, value);
		} else {
			this.io.emit('set_page', index, value);
		}

		this.system.emit('db_set', 'page', this.pages);
		this.system.emit('page_update', index, value);
		this.system.emit('db_save');
	}

	getPages()  {
		return this.pages;
	}

	clientConnect(socket) {
		debug('socket ' + socket.id + ' connected');
		socket.on('set_page', (key, value) => {
			debug('socket: set_page ' + key, value);
			this.system.emit('page_set', key, value, socket);
		});

		socket.on('get_page_all', () => {
			debug("socket: get_page_all");
			socket.emit('get_page_all', this.pages);
		});

		socket.on('disconnect', () => {
			debug('socket ' + socket.id + ' disconnected');
		});
	}
}

module.exports = Pages;
