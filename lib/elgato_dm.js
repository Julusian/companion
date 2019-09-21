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

const debug = require('debug')('lib/elgato_dm');
const HID = require('node-hid');
const deviceHandler = require('./device');
const usb = require('./usb');

const elgatoEmulator = require('./elgato_emulator');
const elgatoPluginDevice = require('./elgato_plugin');
const satelliteDevice = require('./satellite_device');

// Force libusb mode to allow the original elgato to work on linux
HID.setDriverType('libusb');

debug("module required");

class PanelDeviceManager {
	constructor(system, io) {
		this.system = system;
		this.io = io;

		this.instances = {};

		system.on('elgatodm_remove_device', this.removeDevice.bind(this));
		system.on('devices_list_get', (cb) => cb(this.getDevicesList()));
		system.on('devices_reenumerate', this.refreshDevices.bind(this));

		system.on('io_connect', this.clientConnect.bind(this));

		// Add emulator by default
		this.addDevice({ path: 'emulator' }, 'elgatoEmulator');

		// Initial search for USB devices
		this.refreshDevices();
	}

	clientConnect(socket) {
		socket.on('devices_list_get', () => this.updateDevicesList(socket));
		socket.on('devices_reenumerate', () => {
			this.refreshDevices();
			socket.emit('devices_reenumerate:result', true);
		});
		socket.on('device_config_get', (targetId) => {
			for (const id in this.instances) {
				if (this.instances[id].id == targetId) {
					this.instances[id].getConfig((result) => socket.emit('device_config_get:result', null, result));
					return;
				}
			}
			socket.emit('device_config_get:result', 'device not found');
		});
		socket.on('device_config_set', (targetId, config) => {
			for (const id in this.instances) {
				if (this.instances[id].id == targetId) {
					this.instances[id].setConfig(config);
					socket.emit('device_config_get:result', null, 'ok');
					return;
				}
			}
			socket.emit('device_config_get:result', 'device not found');
		});
	}

	getDevicesList() {
		const devices = [];
		for (const id in this.instances) {
			const instance = this.instances[id];
			devices.push({
				id: instance.id,
				serialnumber: instance.serialnumber,
				type: instance.type,
				config: instance.config
			});
		}
		return devices;
	}
	updateDevicesList(socket) {
		const devices = this.getDevicesList();
		
		this.system.emit('devices_list', devices);
		if (socket) {
			socket.emit('devices_list', devices);
		} else {
			this.io.emit('devices_list', devices);
		}
	}

	refreshDevices() {
		debug("USB: checking devices (blocking call)");
		for (const device of HID.devices()) {
			if (device.vendorId === 0x0fd9 && device.productId === 0x0060 && this.instances[device.path] === undefined) {
				this.addDevice(device, 'elgato');
			}
			if (device.vendorId === 0x0fd9 && device.productId === 0x0063 && this.instances[device.path] === undefined) {
				this.addDevice(device, 'elgato-mini');
			}
			if (device.vendorId === 0x0fd9 && device.productId === 0x006c && this.instances[device.path] === undefined) {
				this.addDevice(device, 'elgato-xl');
			}
			if (device.vendorId === 0xffff && device.productId === 0x1f40 && this.instances[device.path] === undefined) {
				this.addDevice(device, 'infinitton');
			}
			if (device.vendorId === 0xffff && device.productId === 0x1f41 && this.instances[device.path] === undefined) {
				this.addDevice(device, 'infinitton');
			}
		}
		debug("USB: done");
	}

	addDevice(device, type) {
		debug('add device ' + device.path);
		if (type === 'elgatoEmulator') {
			this.instances[device.path] = new elgatoEmulator(this.system, device.path);
			this.instances[device.path].deviceHandler = new deviceHandler(this.system, this.instances[device.path]);
			this.updateDevicesList();
		}
		else if (type === 'streamdeck_plugin') {
			this.instances[device.path] = new elgatoPluginDevice(this.system, device.path);
			this.instances[device.path].deviceHandler = new deviceHandler(this.system, this.instances[device.path]);
			this.updateDevicesList();
		}
		else if (type === 'satellite_device') {
			this.instances[device.path] = new satelliteDevice(this.system, device.path);
			this.instances[device.path].deviceHandler = new deviceHandler(this.system, this.instances[device.path]);
			this.updateDevicesList();
		}
		else {
			// Check if we have access to the device
			try {
				const devicetest = new HID.HID(device.path);
				devicetest.close();
			}
			catch (e) {
				this.system.emit('log', 'USB(' + type + ')', 'error', 'Found device, but no access. Please quit any other applications using the device, and try again.');
				debug('device in use, aborting');
				return;
			}
			this.instances[device.path] = new usb(this.system, type, device.path, () => {
				debug('initializing deviceHandler');
				this.instances[device.path].deviceHandler = new deviceHandler(this.system, this.instances[device.path]);
				this.updateDevicesList();
			});
		}
	}

	removeDevice(devicepath) {
		debug('remove device ' + devicepath);
		const instance = this.instances[devicepath];
		if (instance) {
			try {
				instance.quit();
			}
			catch (e) {
				// Ignore
			}
			instance.deviceHandler.unload();
			delete instance.deviceHandler;
			delete this.instances[devicepath];
		}
		this.updateDevicesList();
	}

	quit() {
		for (const devicepath in this.instances) {
			try {
				this.removeDevice(devicepath);
			}
			catch (e) {
				// Ignore as we are shutting down
			}
		}
	}
}

module.exports = PanelDeviceManager;
