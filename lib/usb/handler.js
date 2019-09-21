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

 /*
	This is written with the idea that it might only handle one device, or more than one device
	for future compatibility. Currently each handler instance only handles one device though.
*/

const { EventEmitter } = require('events');
const drivers = {
	'elgato': require('./elgato'),
	'elgato-mini': require('./elgato-mini'),
	'elgato-xl': require('./elgato-xl'),
	'infinitton': require('./infinitton')
};

global.MAX_BUTTONS = parseInt(process.env.MAX_BUTTONS);
global.MAX_BUTTONS_PER_ROW = parseInt(process.env.MAX_BUTTONS_PER_ROW);

const driver_instances = {};

class LinkedSystem extends EventEmitter {
	constructor() {
		super();
	}
	emit(...args) {
		process.send({ cmd: 'system', args: args });
		super.emit(...args);
	}
}
const system = new LinkedSystem();

process.on('message', function (data) {
	if (data.cmd == 'add') {
		try {
			const type = drivers[data.type];
			const instance = driver_instances[data.id] = new type(system, data.devicepath);
			instance.log = (...args) => process.send({ cmd: 'debug', id: data.id, args: args });

			process.send({ cmd: 'publish', id: data.id, info: instance.info });
			process.send({ cmd: 'add', id: data.id });
		} catch (e) {
			process.send({ cmd: 'error', id: data.id, error: e.message + ' AND GOT: ' + JSON.stringify(data) });
		}
	}
	else if (data.cmd == 'execute') {
		try {
			const result = driver_instances[data.id][data.function](...data.args);
			if (data.returnId !== undefined) {
				process.send({ cmd: 'return', id: data.id, returnId: data.returnId, result: result });
			}
		} catch (e) {
			process.send({ cmd: 'error', id: data.id, error: e.message });
		}
	}
	else if (data.cmd == 'system') {
		system.emit(...data.args);
	}
	else if (data.cmd == 'remove') {
		try {
			driver_instances[data.id].quit();
			delete driver_instances[data.id]; // TODO - verify this
			process.send({ cmd: 'remove', id: data.id });
		} catch (e) {
			process.send({ cmd: 'error', id: data.id, error: e.message });
		}
	}
});
