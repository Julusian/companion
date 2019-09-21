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

const socketIo     = require('socket.io');
const debug   = require('debug')('lib/io');

class IoServer extends socketIo {
	constructor(system, http) {
		super(http);

		this.system = system;

		this.system.on('io_get', (cb) => {
			if (typeof cb == 'function') {
				cb(this);
			}
		});
		
		this.on('connect', (client) => {
			debug('io-connect');
			this.system.emit('skeleton-info-info', (hash) => client.emit('skeleton-info', hash));
			this.system.emit('io_connect', client);
		});
	}
}

module.exports = IoServer;
