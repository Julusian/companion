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


import debug = require('debug');
import StreamDeck = require('elgato-stream-deck-clean-xl');
import { EventEmitter } from 'events';
import { SurfaceDriverCommon } from './common';

class SurfaceDriverElgatoXL extends SurfaceDriverCommon {
	private device: StreamDeck;

	constructor(system: EventEmitter, devicepath: string) {
		super(system, devicepath, debug('lib/usb/elgato_xl'));
	}

	public generateInfo(devicepath: string) {
		return {
			type: 'Elgato Streamdeck XL device',
			devicepath,
			deviceType: 'StreamDeck',
			deviceTypeFull: 'StreamDeck XL',
			config: [ 'brightness', 'orientation', 'page' ],
			keysPerRow: 8,
			keysTotal: 32,
		};
	}

	public openDevice() {
		this.device = new StreamDeck(this.devicepath);

		this.device.on('down', (key) => this.keyDown(key));
		this.device.on('up', (key) => this.keyUp(key));
		this.device.on('error', (error) => this.removeDevice(error));
	}

	public closeDevice() {
		if (this.device && this.device.device) {
			this.device.device.close();
		}
		this.device = undefined;
	}

	public setBrightness(brightness: number) {
		if (this.device) {
			this.device.setBrightness(brightness);
		}
	}

	protected getSerialNumber(): string {
		if (this.device && this.device.device) {
			return this.device.device.getDeviceInfo().serialNumber;
		} else {
			return '';
		}
	}

	public clearKey(key: number) {
		if (this.device) {
			this.device.clearKey(key);
		}
	}

	public clearDeck() {
		// Override given driver has a built-in clearAll
		this.log(this.type + '.clearDeck()');
		if (this.device) {
			this.device.clearAllKeys();
		}
	}

	public fillImage(key: number, buffer: Buffer) {
		if (this.device) {
			this.device.fillImage(key, buffer);
		}
	}
}

exports = module.exports = SurfaceDriverElgatoXL;
