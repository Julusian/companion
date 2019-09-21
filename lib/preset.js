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

const debug   = require('debug')('lib/preset');
const shortid = require('shortid');

class Presets {
	constructor(system, io) {
		this.system = system;
		this.io = io;

		this.presets = {};

		system.on('io_connect', this.clientConnect.bind(this));

		system.on('instance_enable', this.instanceEnable.bind(this));
		system.on('instance_delete', this.instanceDelete.bind(this));

		system.on('preset_instance_definitions_set', this.instanceDefinitionsSet.bind(this));

		system.on('variable_instance_label_rename', this.variableInstanceLabelRename.bind(this));
	}

	instanceEnable(instanceId, state) {
		if (state === false) {
			delete this.presets[instanceId];
			this.io.emit('presets_delete', instanceId);
		}
	}

	instanceDelete(instanceId) {
		delete this.presets[instanceId];
		this.io.emit('presets_delete', instanceId);
	}

	instanceDefinitionsSet(instance, presets) {
		this.presets[instance.id] = presets;
		this.io.emit('presets_update', instance.id, presets);
	}

	variableInstanceLabelRename(labelFrom, labelTo, instanceId) {
		if (this.presets[instanceId] !== undefined) {
			this.system.emit('instance_get', instanceId, (instance) => {
				if (instance !== undefined) {
					instance.label = labelTo;
					debug('Updating presets for instance ' + labelTo);
					instance.setPresetDefinitions(this.presets[instanceId]);
				}
			});
		}
	}

	clientConnect(client) {
		client.on('get_presets', () => {
			client.emit('get_presets:result', this.presets);
		});

		client.on('preset_drop', (instance, config, page, bank) => {

			if (config.actions !== undefined) {
				for (var i = 0; i < config.actions.length; ++i) {
					config.actions[i].id = shortid.generate();
					config.actions[i].instance = instance;
					config.actions[i].label = instance + ':' + config.actions[i].action;
				}
			} else {
				config.actions = [];
			}

			if (config.release_actions !== undefined) {
				for (var i = 0; i < config.release_actions.length; ++i) {
					config.release_actions[i].id = shortid.generate();
					config.release_actions[i].instance = instance;
					config.release_actions[i].label = instance + ':' + config.release_actions[i].action;
				}
			} else {
				config.release_actions = [];
			}

			if (config.feedbacks !== undefined) {
				for (var i = 0; i < config.feedbacks.length; ++i) {
					config.feedbacks[i].id = shortid.generate();
					config.feedbacks[i].instance_id = instance;
				}
			} else {
				config.feedbacks = [];
			}

			config.config = config.bank;
			delete config.bank;

			this.system.emit('import_bank', page, bank, config, () => {
				client.emit('preset_drop:result', null, 'ok');
			});
		});
	}
}

module.exports = Presets;
