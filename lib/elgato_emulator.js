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

const debug = require('debug')('lib/elgato_emulator');
const SurfaceDriverCommon = require('./usb/common');

const KEY_MAP = [ 4, 3, 2, 1, 0, 9, 8, 7, 6, 5, 14, 13, 12, 11, 10 ];

class ElgatoEmulator extends SurfaceDriverCommon {
	constructor(system, io, devicepath) {
		super(system, devicepath, debug);
		
		this.io = io;
		
		this.keyCache = [];

		system.on('io_connect', this.clientConnect.bind(this));
	}

	clientConnect(socket) {
		socket.on('emul_startup', () => {
			for (const key in this.keyCache) {
				socket.emit('emul_fillImage', key, this.keyCache[key]);
			}
		});

		socket.on('emul_down', (keyIndex) => this.keyDown(ElgatoEmulator.fromDeviceMap(KEY_MAP, parseInt(keyIndex, 10))));
		socket.on('emul_up', (keyIndex) => this.keyUp(ElgatoEmulator.fromDeviceMap(KEY_MAP, parseInt(keyIndex, 10))));
	}

	generateInfo(devicepath) {
		return {
			type: 'Elgato Streamdeck Emulator',
			devicepath: devicepath,
			deviceType: 'StreamDeck',
			deviceTypeFull: 'StreamDeck Emulator',
			config: [ /*'page'*/ ],
			keysPerRow: 5,
			keysTotal: 15
		};
	}

	openDevice() {}
	closeDevice() {}

	setBrightness(brightness) {}

	getSerialNumber() {
		return 'emulator';
	}

	clearKey(keyIndex) {
		if (!this.keyCache) {
			this.keyCache = [];
		}

		this.keyCache[keyIndex] = Buffer.alloc(15552);

		if (this.io) {
			this.io.emit('clearKey', keyIndex);
		}
	}

	clearDeck() {
		if (!this.keyCache) {
			this.keyCache = [];
		}
		
		// Override for more optimal buffer allocs
		const buffer = Buffer.alloc(15552);

		for (var i = 0; i < global.MAX_BUTTONS; ++i) {
			this.keyCache[i] = buffer;
			if (this.io) {
				this.io.emit('clearKey', i);
			}
		}
	}

	fillImage(key, imageBuffer) {
		if (!this.keyCache) {
			this.keyCache = [];
		}
		
		if (imageBuffer.length !== 15552) {
			throw new RangeError('Expected image buffer of length 15552, got length ' + imageBuffer.length);
		}

		const keyIndex = ElgatoEmulator.toDeviceMap(KEY_MAP, key);
		
		this.keyCache[keyIndex] = imageBuffer;
		if (this.io) {
			this.io.emit('emul_fillImage', keyIndex, imageBuffer);
		}
	}
}

module.exports = ElgatoEmulator;
