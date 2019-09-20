import { EventEmitter } from "events";

export const BUFFER_SIZE = 72 * 72 * 3;

export interface BufferContent {
	type: 'Buffer';
	data: number[];
}

const MAX_BUTTONS = parseInt(process.env.MAX_BUTTONS, 10);
const MAX_BUTTONS_PER_ROW = parseInt(process.env.MAX_BUTTONS_PER_ROW, 10);

export function prepareButtonBuffer(rawBuffer: Buffer | BufferContent, rotation: number) {
	let buffer: Buffer | undefined;
	if (Buffer.isBuffer(rawBuffer)) {
		buffer = rawBuffer;
	} else if (rawBuffer.type === 'Buffer') {
		buffer = new Buffer(rawBuffer.data);
	}

	if (buffer === undefined || buffer.length !== BUFFER_SIZE) {
		this.log("buffer was not 15552, but " + buffer.length);
		return false;
	}

	if (rotation === -90) {
		const buf = new Buffer(BUFFER_SIZE);

		for (let x = 0; x < 72; ++x) {
			for (let y = 0; y < 72; ++y) {
				buf.writeUIntBE(buffer.readUIntBE((x * 72 * 3) + (y * 3), 3), (y * 72 * 3) + ((71 - x) * 3), 3);
			}
		}
		return buf;
	} else if (rotation === 180) {
		const buf = new Buffer(BUFFER_SIZE);

		for (let x = 0; x < 72; ++x) {
			for (let y = 0; y < 72; ++y) {
				buf.writeUIntBE(buffer.readUIntBE((x * 72 * 3) + (y * 3), 3), ((71 - x) * 72 * 3) + ((71 - y) * 3), 3);
			}
		}
		return buf;
	} else if (rotation === 90) {
		const buf = new Buffer(BUFFER_SIZE);

		for (let x = 0; x < 72; ++x) {
			for (let y = 0; y < 72; ++y) {
				buf.writeUIntBE(buffer.readUIntBE((x * 72 * 3) + (y * 3), 3), ((71 - y) * 72 * 3) + (x * 3), 3);
			}
		}
		return buf;
	} else {
		return buffer;
	}
}

export function toDeviceMap(map: number[], key: number) {
	if (key >= 0 && key < map.length) {
		return map[key];
	} else {
		return -1;
	}
}
export function fromDeviceMap(map: number[], key: number) {
	return map.indexOf(key);
}

export interface DriverInfo {
	type: string;
	devicepath: string;
	deviceType: string;
	deviceTypeFull: string;
	config: string[];
	keysPerRow: number;
	keysTotal: number;
	serialnumber?: string;
}

export abstract class SurfaceDriverCommon {
	protected system: EventEmitter;
	protected debug: (...args: any[]) => void;
	protected devicepath: string;
	protected config: { [key: string]: any };

	public info: DriverInfo;
	public type: string;
	public deviceType: string;
	public keysTotal: number;
	public keysPerRow: number;
	public serialnumber: string;

	private buttonState: Array<{ pressed: boolean }>;

	constructor(system: EventEmitter, devicepath: string, debug: (...args: any[]) => void) {
		this.system = system;
		this.debug = debug;
		this.devicepath = devicepath;

		this.info = this.generateInfo(devicepath);

		this.type = this.info.type;
		this.deviceType = this.info.deviceTypeFull;
		this.keysTotal  = this.info.keysTotal;
		this.keysPerRow = this.info.keysPerRow;

		this.config = {
			brightness: 100,
			page: 1,
			rotation: 0,
		};

		debug('Adding ' + this.info.type + ' device', devicepath);

		process.on('uncaughtException', (err) => {
			system.emit('log', 'device' + this.serialnumber + ')', 'debug', 'Exception:' + err);
		});

		this.openDevice();

		this.info.serialnumber = this.serialnumber = this.getSerialNumber();

		this.system.emit('log', 'device(' + this.serialnumber + ')', 'debug', 'Elgato Streamdeck detected');

		// send elgato ready message to devices :)
		setImmediate(() => {
			this.system.emit('elgato_ready', devicepath);
		});

		this.initializeButtonStates();

		this.clearDeck();
	}

	protected abstract generateInfo(devicePath: string): DriverInfo;

	public begin() {
		this.log(this.type + '.begin()');

		this.setBrightness(this.config.brightness);
	}

	public buttonClear(key) {
		this.log(this.type + '.buttonClear(' + key + ')');
		key = this.toDeviceKey(key);

		if (key >= 0 && !isNaN(key)) {
			this.clearKey(key);
		}
	}

	public clearDeck() {
		this.log(this.type + '.clearDeck()');

		for (let x = 0; x < this.keysTotal; x++) {
			this.clearKey(x);
		}
	}

	public draw(key: number, buffer, attempts = 0) {

		if (attempts === 0) {
			buffer = prepareButtonBuffer(buffer, this.config.rotation);
		}

		attempts++;

		const drawKey = this.toDeviceKey(key);

		try {

			if (drawKey !== undefined && drawKey >= 0 && drawKey < this.keysTotal) {
				this.fillImage(drawKey, buffer);
			}

			return true;
		} catch (e) {
			this.log(this.deviceType + ' USB Exception: ' + e.message);

			if (attempts > 2) {
				this.log('Giving up USB device ' + this.devicepath);
				this.system.emit('elgatodm_remove_device', this.devicepath);

				return false;
			}

			// alternatively a setImmediate() or nextTick()
			setTimeout(this.draw.bind(this), 20, key, buffer, attempts);
		}
	}

	public getConfig() {
		this.log('getConfig');

		return this.config;
	}

	protected abstract setBrightness(brightness: number): void;

	protected abstract openDevice(): void;

	protected abstract closeDevice(): void;

	protected abstract getSerialNumber(): string;

	protected abstract clearKey(key: number): void;

	protected abstract fillImage(key: number, buffer: Buffer): void;

	private initializeButtonStates() {
		this.buttonState = [];

		for (let button = 0; button < MAX_BUTTONS; button++) {
			this.buttonState[button] = {
				pressed: false,
			};
		}
	}

	public isPressed(key) {
		key = this.toDeviceKey(key);
		this.log(this.type + '.isPressed(' + key + ')');

		if (key >= 0 && this.buttonState[key] !== undefined) {
			return this.buttonState[key].pressed;
		} else {
			return false;
		}
	}

	protected keyDown(keyIndex) {
		const key = this.toGlobalKey(keyIndex);

		if (key === undefined) {
			return;
		}

		this.buttonState[key].pressed = true;
		this.system.emit('elgato_click', this.devicepath, key, true, this.buttonState);
	}

	protected keyUp(keyIndex) {
		const key = this.toGlobalKey(keyIndex);

		if (key === undefined) {
			return;
		}

		this.buttonState[key].pressed = false;
		this.system.emit('elgato_click', this.devicepath, key, false, this.buttonState);
	}

	protected log(...args: any[]) {
		console.log(...args);
	}

	public quit() {
		try {
			this.clearDeck();

			this.closeDevice();
		} catch (e) {
			// Device already closed/broken
		}
	}

	protected removeDevice(error) {
		console.error(error);
		this.system.emit('elgatodm_remove_device', this.devicepath);
	}

	public setConfig(config) {

		if (this.config.brightness !== config.brightness && config.brightness !== undefined) {
			this.setBrightness(config.brightness);
		}

		if (this.config.rotation !== config.rotation && config.rotation !== undefined) {
			this.config.rotation = config.rotation;
			this.system.emit('device_redraw', this.devicepath);
		}

		if (this.config.page !== config.page && config.page !== undefined) {
			this.config.page = config.page;

			// also handeled in usb.js
			this.system.emit('device_redraw', this.devicepath);
		}

		this.config = config;
	}

	// From Global key number 0->31, to Device key f.ex 0->14
	// 0-4 would be 0-4, but 5-7 would be -1
	// and 8-12 would be 5-9
	private toDeviceKey(key: number) {

		if (this.keysTotal === MAX_BUTTONS) {
			return key;
		}

		if (key % MAX_BUTTONS_PER_ROW > this.keysPerRow) {
			return -1;
		}

		const row = Math.floor(key / MAX_BUTTONS_PER_ROW);
		const col = key % MAX_BUTTONS_PER_ROW;

		if (row >= (this.keysTotal / this.keysPerRow) || col >= this.keysPerRow) {
			return -1;
		}

		return (row * this.keysPerRow) + col;
	}

	// From device key number to global key number
	// Reverse of toDeviceKey
	private toGlobalKey(key: number) {
		const rows = Math.floor(key / this.keysPerRow);
		const col = key % this.keysPerRow;

		return (rows * MAX_BUTTONS_PER_ROW) + col;
	}
}
