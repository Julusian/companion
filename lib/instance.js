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

const debug   = require('debug')('lib/instance');
const shortid = require('shortid');
const fs      = require('fs');
const marked  = require('marked');

const modulesRootPath = require('app-root-path') + '/lib/module';

class InstanceManager {
	constructor(system, io, db) {
		this.system = system;
		this.io = io;

		this.moduleConstructors = {};
		this.moduleNamesByManufacturer = {};
		this.moduleNamesByCategory = {};
		this.moduleNames = {};
		this.modulePackageInfo = {};

		this.activeInstances = {};
		this.instanceStatus = {};
		this.store = {
			module: [],
			db: {}
		};

		system.emit('instance', this);

		system.on('instance_get_package_info', (cb) => {
			debug("getting instance_get_package_info");
			cb(this.getPackageInfo());
		});
		system.on('instance_save', this.save.bind(this));

		// levels: null = unknown, 0 = ok, 1 = warning, 2 = error
		system.on('instance_status_update', this.updateInstanceStatus.bind(this));

		system.on('instance_status_get', (instanceId, cb) => cb(this.getInstanceStatus(instanceId)));
		system.on('instance_get', (instanceId, cb) => cb(this.getInstance[instanceId]));
		system.on('instance_getall', (cb) => cb(this.store.db, this.activeInstances));

		system.on('instance_add', (moduleName, cb) => {
			const instanceId = this.addInstance(moduleName);
			if (typeof cb == 'function') {
				cb(instanceId, this.store.db[instanceId]);
			}
		});
		system.on('instance_delete', this.deleteInstance.bind(this));
		system.on('instance_enable', this.enableInstance.bind(this));
		system.on('instance_config_put', this.updateInstanceConfig.bind(this));
		
		system.on('instance_activate', (instanceId) => this._setupInstance(instanceId));

		system.on('action_run', this.runAction.bind(this));

		system.on('skeleton-power', this.powerStatusChange.bind(this));
		this.system.on('http_req', this.handleHttpRequest.bind(this));

		const dbRes = db.get('instance');
		if (!dbRes) {
			this.store.db = {};
			system.emit('db_set', 'instance', this.store.db);
		} else {
			this.store.db = dbRes;
		}
		setTimeout(() => this._initModules(), 2000);
		
		system.on('io_connect', this.clientConnect.bind(this));
	}

	getPackageInfo() {
		return this.modulePackageInfo;
	}

	save() {
		this.system.emit('db_set', 'instance', this.store.db);
		this.system.emit('db_save');
	}

	updateInstanceStatus(instanceId, level, msg) {
		this.instanceStatus[instanceId] = [level, msg];
		this.system.emit('instance_status', this.instanceStatus);
		this.system.emit('instance_status_set', instanceId, level, msg);

		// Push to clients too
		this.io.emit('instance_status', this.instanceStatus);
	}
	
	getInstanceStatus(instanceId) {
		return this.instanceStatus[instanceId];
	}
	getInstance(instanceId) {
		return this.activeInstances[instanceId];
	}
	getAllInstances() {
		return {
			db: this.store.db,
			instances: this.activeInstances
		};
	}

	addInstance(moduleName) {
		const instanceId = shortid.generate();
		const instanceConfig = this.store.db[instanceId] = {};
		this.system.emit('log', 'instance(' + instanceId + ')', 'info', 'instance add ' + moduleName);
		instanceConfig.instance_type = moduleName;

		const defaultLabel = this.modulePackageInfo[moduleName].shortname;
		let label = defaultLabel;
		let i = 1;
		for (let isLabelFree = false; !isLabelFree; isLabelFree = true) {
			// Check other instances to ensure the label is unique
			for (const key in this.store.db) {
				if (this.store.db[key].label == label) {
					i++;
					label = defaultLabel + i;
					isLabelFree = false;
					break;
				}
			}
		}

		instanceConfig.label = label;
		if (this.activeInstances[instanceId] !== undefined) {
			this.activeInstances[instanceId].label = instanceConfig.label;
		}

		this._setupInstance(instanceId, this.moduleConstructors[moduleName]);
		this.io.emit('instance_add:result', instanceId, this.store.db);
		debug('instance_add', instanceId);
		this.system.emit('instance_save');
		this.system.emit('actions_update');

		return instanceId;
	}
	deleteInstance(instanceId) {
		this.system.emit('log', 'instance(' + instanceId + ')', 'info', 'instance deleted');
		if (this.activeInstances[instanceId]) {
			this.activeInstances[instanceId].destroy();
			delete this.activeInstances[instanceId];
		}
		delete this.instanceStatus[instanceId];
		delete this.store.db[instanceId];
		this.system.emit('instance_save');
	}
	enableInstance(instanceId, state) {
		this.system.emit('log', 'instance(' + instanceId + ')', 'info', (state ? 'Enable' : 'Disable') + ' instance ' + this.store.db[instanceId].label);
		this.store.db[instanceId].enabled = state;
		this.instanceStatus[instanceId] = [-1, 'Disabled'];
		if (state === false) {
			if (this.activeInstances[instanceId]) {
				try {
					this.activeInstances[instanceId].destroy();
				}
				catch (e) {
					this.system.emit('log', 'instance(' + instanceId + ')', 'warn', 'Error disabling instance: ' + e.message);
				}
				delete this.activeInstances[instanceId];
			}
		}
		else {
			this._setupInstance(instanceId);
		}
		this.system.emit('instance_save');
	}
	_setupInstance(instanceId, modin) {
		const instanceConfig = this.store.db[instanceId];
		const moduleConstructor = modin !== undefined ? modin : this.moduleConstructors[instanceConfig.instance_type];

		try {
			const instance = this.activeInstances[instanceId] = new moduleConstructor(this.system, instanceId, Object.assign({}, instanceConfig));

			if (instance._versionscripts !== undefined && instance._versionscripts.length > 0) {
				// New instances do not need to be upgraded
				instanceConfig._configIdx = instance._versionscripts.length - 1;
			}
			
			if (instance.label === undefined) {
				instance.label = instanceConfig.label;
			}
			
			if (typeof instance._init == 'function') {
				instance._init();
			}
		}
		catch (e) {
			this.system.emit('log', 'instance(' + instanceId + ')', 'error', 'module failed');
			debug("INSTANCE ADD EXCEPTION:", e);
		}
	}
	updateInstanceConfig(instanceId, updatedConfig, skipNotifyInstance) {
		// Write config change to store
		const instanceConfig = this.store.db[instanceId];
		Object.assign(instanceConfig, updatedConfig);

		const instance = this.activeInstances[instanceId];
		if (instance) {
			if (instance.label != instanceConfig.label) {
				this.system.emit('variable_instance_label_rename', instance.label, instanceConfig.label, instanceId);
			}
			instance.label = instanceConfig.label;
		}
		this.system.emit('instance_save');

		this.io.emit('instance_db_update', this.store.db);

		// Push new config to instance
		if (!skipNotifyInstance && instance) {
			if (typeof instance.updateConfig == 'function') {
				instance.updateConfig(Object.assign({}, updatedConfig));
			}
		}

		this.system.emit('log', 'instance(' + instanceId + ')', 'debug', 'instance configuration updated');
	}

	powerStatusChange(event) {
		if (event == 'resume') {
			this.system.emit('log', 'system(power)', 'info', 'Resuming');
			for (const instanceId in this.activeInstances) {
				this.system.emit('log', 'instance(' + this.activeInstances[instanceId].label + ')', 'debug', 'Bringing back instance from sleep');
				this._setupInstance(instanceId);
			}
		}
		else if (event == 'suspend') {
			this.system.emit('log', 'system(power)', 'info', 'Suspending');
			for (const instanceId in this.activeInstances) {
				if (this.activeInstances[instanceId]) {
					try {
						this.activeInstances[instanceId].destroy();
					}
					catch (e) {
						this.system.emit('log', 'instance(' + this.activeInstances[instanceId].label + ')', 'debug', 'Error suspending instance: ' + e.message);
					}
				}
			}
		}
	}
	handleHttpRequest(req, res, done) {
		const match = req.url.match(/^\/help\/([^/]+)\/(.+?)(\?.+)?$/);
		if (match) {
			const moduleName = match[1].replace(/\.\.+/g, '');
			const filename = match[2].replace(/\.\.+/g, '');
			if (filename.match(/\.(jpe?g|gif|png|pdf)$/) && fs.existsSync(modulesRootPath + '/' + moduleName + '/' + filename)) {
				done();
				res.sendFile(modulesRootPath + '/' + moduleName + '/' + filename);
			}
		}
	}

	runAction(action, extras) {
		const instance = this.activeInstances[action.instance];
		if (instance) {
			instance.action(action, extras);
		} else {
			debug("trying to run action on a deleted instance.", action);
		}
	}

	_initModules() {
		debug('instance_init', this.store.db);
		
		const moduleRenames = {}; // Modules that have been renamed and need fixing at startup

		for (const moduleName of fs.readdirSync(modulesRootPath)) {
			try {
				const packagefile = fs.readFileSync(modulesRootPath + '/' + moduleName + '/package.json');
				const moduleConfig = JSON.parse(packagefile);
				moduleConfig.help = fs.existsSync(modulesRootPath + '/' + moduleName + '/HELP.md');

				const moduleConstructor = require(modulesRootPath + '/' + moduleName + '/' + moduleConfig.main);

				this.store.module.push(moduleConfig);
				this.moduleConstructors[moduleName] = moduleConstructor;
				this.modulePackageInfo[moduleName] = moduleConfig;

				// Generate keywords list
				if (moduleConfig.keywords) {
					for (const kw of moduleConfig.keywords) {
						if (!this.moduleNamesByCategory[kw]) {
							this.moduleNamesByCategory[kw] = [];
						}
						this.moduleNamesByCategory[kw].push(moduleName);
					}
				} else {
					console.log(moduleName, "- uh, no keywords?");
					process.exit();
				}

				// Generate manufacturer list
				if (moduleConfig.manufacturer && moduleConfig.manufacturer != 'Bitfocus') {
					if (this.moduleNamesByManufacturer[moduleConfig.manufacturer] === undefined) {
						this.moduleNamesByManufacturer[moduleConfig.manufacturer] = [];
					}
					this.moduleNamesByManufacturer[moduleConfig.manufacturer].push(moduleName);
				} else if (moduleConfig.manufacturer != 'Bitfocus') {
					console.log(moduleName, "- uh, no manufacturer?");
					process.exit();
				}

				// Add legacy names to the redirect list
				if (moduleConfig.legacy) {
					for (const from of moduleConfig.legacy) {
						moduleRenames[from] = moduleConfig.name;
					}
				}

				// Generate label
				if (moduleConfig.name && moduleConfig.manufacturer != 'Bitfocus') {
					if (typeof moduleConfig.product == 'string') {
						moduleConfig.label = moduleConfig.manufacturer + ":" + moduleConfig.product;
					} else {
						moduleConfig.label = moduleConfig.manufacturer + ":" + moduleConfig.product.join(";");
					}
					this.moduleNames[moduleName] = moduleConfig.label;
				}

				// Sanity check
				if (moduleConfig.name != moduleName) {
					debug('ERROR: Module ' + moduleName + ' identifies itself as ' + moduleConfig.name);
					console.log('ERROR: Module ' + moduleName + ' identifies itself as ' + moduleConfig.name);
					process.exit();
				}

				debug('loaded module ' + moduleName + '@' + moduleConfig.version + ' by ' + moduleConfig.author);
				this.system.emit('log', 'loaded', 'debug', moduleName + '@' + moduleConfig.version + ": " + moduleConfig.label + ' by ' + moduleConfig.author);
			}
			catch (e) {
				debug("Error loading module " + moduleName, e);
				this.system.emit('log', 'module(' + moduleName + ')', 'error', 'Error loading module: ' + e);
			}
		}
		
		// Ensure the internal module is defined
		if (this.store.db['bitfocus-companion'] === undefined) {
			this.store.db['bitfocus-companion'] = {
				instance_type: 'bitfocus-companion',
				label: 'internal',
				id: 'bitfocus-companion'
			};
		}
		// Bugfix of corrupted configs
		else if (this.store.db['bitfocus-companion'] !== undefined) {
			if (this.store.db['bitfocus-companion'].id === undefined) {
				this.store.db['bitfocus-companion'].id = 'bitfocus-companion';
			}
		}

		for (const instanceId in this.store.db) {
			const instanceConfig = this.store.db[instanceId];
			if (moduleRenames[instanceConfig.instance_type] !== undefined) {
				instanceConfig.instance_type = moduleRenames[instanceConfig.instance_type];
			}

			const moduleConstructor = this.moduleConstructors[instanceConfig.instance_type];
			if (moduleConstructor) {
				try {
					if (instanceConfig.enabled === false) {
						debug("Won't load disabled module " + instanceId + " (" + instanceConfig.instance_type + ")");
						continue;
					}

					const instance = this.activeInstances[instanceId] = new moduleConstructor(this.system, instanceId, Object.assign({}, instanceConfig));
					instance.label = instanceConfig.label;
					if (typeof instance.upgradeConfig == 'function') {
						instance.upgradeConfig();
					}
					if (typeof instance._init == 'function') {
						debug("Running _init of " + instanceId);
						instance._init();
					}
				} catch (e) {
					this.system.emit('log', 'instance(' + instanceId + ')', 'error', 'module failed');
					debug("INSTANCE ADD EXCEPTION:", e);
				}
			} else {
				debug("Configured instance " + instanceConfig.instance_type + " could not be loaded, unknown module");
				if (instanceConfig.instance_type != 'bitfocus-companion') {
					this.system.emit('log', 'instance(' + instanceConfig.instance_type + ')', 'error', "Configured instance " + instanceConfig.instance_type + " could not be loaded, unknown module");
				}
			}
		}

		// this.system.emit('instances_loaded');
	}

	clientConnect(client) {
		client.on('instance_get', () => this._clientGetModulesAndInstancesInformation(client));
		client.on('instance_edit', (instanceId) => this._clientGetInstanceConfigFields(client, instanceId));
		client.on('instance_config_put', (instanceId, config) => this._clientUpdateInstanceConfig(client, instanceId, config));
		client.on('instance_status_get', () => client.emit('instance_status', this.instanceStatus));
		client.on('instance_enable', (instanceId, state) => this._clientEnableInstance(client, instanceId, state));
		client.on('instance_delete', this._clientDeleteInstance.bind(this));
		client.on('instance_add', (moduleName) => this.addInstance(moduleName));
		client.on('instance_get_help', (moduleName) => this._clientGetHelp(client, moduleName));
	}

	_clientGetModulesAndInstancesInformation(client) {
		client.emit('instance', this.store, {
			manufacturer: this.moduleNamesByManufacturer,
			category: this.moduleNamesByCategory,
			name: this.moduleNames
		});
	}

	_clientDeleteInstance(instanceId) {
		const instance = this.activeInstances[instanceId];
		this.system.emit('instance_delete', instanceId, instance ? instance.label : undefined);
	}

	_clientEnableInstance(client, instanceId, state) {
		this.system.emit('instance_enable', instanceId, state);

		client.emit('instance_status', this.instanceStatus);
		this._clientGetModulesAndInstancesInformation(client);
	}

	_clientGetInstanceConfigFields(client, instanceId) {
		const instance = this.activeInstances[instanceId]; 
			
		// TODO - undefined check
		const fields = instance.config_fields();
		fields.unshift({
			type: 'textinput',
			id: 'label',
			label: 'Label',
			width: 12
		});
		client.emit('instance_edit:result', instanceId, this.store, fields, this.store.db[instanceId]);
		// TODO - The below looks unnecessary
		// if (instance !== undefined) {
		// 	instance.label = this.store.db[instanceId].label;
		// }
		// this.system.emit('instance_save');
	}

	_clientUpdateInstanceConfig(client, instanceId, config) {
		for (const key in this.store.db) {
			if (key != instanceId && this.store.db[key].label == config.label) {
				client.emit('instance_config_put:result', 'duplicate label');
				return;
			}
		}
		this.updateInstanceConfig(instanceId, config);
		client.emit('instance_config_put:result', null, 'ok');
	}

	_clientGetHelp(client, moduleName) {
		if (this.moduleConstructors[moduleName]) {
			if (fs.existsSync(modulesRootPath + '/' + moduleName + '/HELP.md')) {
				try {
					let help = fs.readFileSync(modulesRootPath + '/' + moduleName + '/HELP.md');
					help = marked(help.toString(), { baseUrl: '/int/help/' + moduleName + '/' });
					client.emit('instance_get_help:result', null, help);
				}
				catch (e) {
					debug('Error loading help for ' + moduleName, modulesRootPath + '/' + moduleName + '/HELP.md');
					debug(e);
					client.emit('instance_get_help:result', 'nofile');
				}
			}
		}
	}
}

module.exports = InstanceManager;
