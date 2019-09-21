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

// var debug = require('debug')('lib/instance_skel');
// const { image, rgb } = require('./image');
const image = require('./image');
const rgb = image.rgb;

class instance_skel {
	constructor(system, id, config) {
		this.system = system;
		this.id = id;
		this.config = config;
		this.package_info = {};

		this.Image = image;
        this.rgb = rgb;

		// we need this object from instance, and I don't really know how to get it
		// out of instance.js without adding an argument to instance() for every
		// single module? TODO: håkon: look over this, please.
		system.emit('instance_get_package_info', (obj) => {
			this.package_info = obj[this.config.instance_type];
		});

		this._versionscripts = [];

		this.defineConst('REGEX_IP',            '/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/');
		this.defineConst('REGEX_BOOLEAN',       '/^(true|false|0|1)$/i');
		this.defineConst('REGEX_PORT',          '/^([1-9]|[1-8][0-9]|9[0-9]|[1-8][0-9]{2}|9[0-8][0-9]|99[0-9]|[1-8][0-9]{3}|9[0-8][0-9]{2}|99[0-8][0-9]|999[0-9]|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-4])$/');
		this.defineConst('REGEX_PERCENT',       '/^(100|[0-9]|[0-9][0-9])$/');
		this.defineConst('REGEX_FLOAT',         '/^([0-9]*\\.)?[0-9]+$/');
		this.defineConst('REGEX_FLOAT_OR_INT',  '/^([0-9]+)(\\.[0-9+])?$/');
		this.defineConst('REGEX_SIGNED_FLOAT',  '/^[+-]?([0-9]*\\.)?[0-9]+$/');
		this.defineConst('REGEX_NUMBER',        '/^\\d+$/');
		this.defineConst('REGEX_SOMETHING',     '/^.+$/');
		this.defineConst('REGEX_SIGNED_NUMBER', '/^[+-]?\\d+$/');
		this.defineConst('REGEX_TIMECODE',      '/^(0*[0-9]|1[0-9]|2[0-4]):(0*[0-9]|[1-5][0-9]|60):(0*[0-9]|[1-5][0-9]|60):(0*[0-9]|[12][0-9]|30)$/');
		this.defineConst('CHOICES_YESNO_BOOLEAN', [ { id: 'true', label: 'Yes' }, { id: 'false', label: 'No' } ]);

		// Going to be deprecated sometime
		this.defineConst('STATE_UNKNOWN', null);
		this.defineConst('STATE_OK', 0);
		this.defineConst('STATE_WARNING', 1);
		this.defineConst('STATE_ERROR', 2);

		// Use these instead
		this.defineConst('STATUS_UNKNOWN', null);
		this.defineConst('STATUS_OK', 0);
		this.defineConst('STATUS_WARNING', 1);
		this.defineConst('STATUS_ERROR', 2);

		this.currentStatus = this.STATUS_UNKNOWN;
		this.currentStatusMessage = '';
	}

	defineConst (name, value) {
		Object.defineProperty(this, name, {
			value:      value,
			enumerable: true
		});
	}

	_init () {
		// These two functions needs to be defined after the module has been instanced,
		// as they reference the original constructors static data

		// Debug with module-name prepeded
		this.debug = require('debug')('instance:' + this.package_info.name + ':' + this.id);

		// Log to the skeleton (launcher) log window
		this.log = (level, info) => {
			this.system.emit('log', 'instance(' + this.label + ')', level, info);
		};

		if (typeof this.init == 'function') {
			this.init();
		}
	}

	// Update instance health, levels: null = unknown, 0 = ok, 1 = warning, 2 = error
	status (level, message) {
		this.currentStatus = level;
		this.currentStatusMessage = message;
		this.system.emit('instance_status_update', this.id, level, message);
	}


	upgradeConfig  () {
		let idx = this.config._configIdx;
		if (idx === undefined) {
			idx = -1;
		}

		var debug = require('debug')('instance:' + this.package_info.name + ':' + this.id);

		if (idx + 1 < this._versionscripts.length) {
			debug("upgradeConfig(" + this.package_info.name + "): " + (idx + 1) + ' to ' + this._versionscripts.length);
		}

		for (var i = idx + 1; i < this._versionscripts.length; ++i) {
			debug('UpgradeConfig: Upgrading to version ' + (i + 1));

			// Fetch instance actions
			var actions = [];
			this.system.emit('actions_for_instance', this.id, (_actions) => {
				actions = _actions;
			});
			var release_actions = [];
			this.system.emit('release_actions_for_instance', this.id, (_release_actions) => {
				release_actions = _release_actions;
			});
			var feedbacks = [];
			this.system.emit('feedbacks_for_instance', this.id, (_feedbacks) => {
				feedbacks = _feedbacks;
			});

			var result;
			try {
				result = this._versionscripts[i](this.config, actions, release_actions, feedbacks);
			} catch (e) {
				debug("Upgradescript in " + this.package_info.name + ' failed', e);
			}
			this.config._configIdx = i;

			// If anything was changed, update system and db
			if (result) {
				this.system.emit('config_save');
				this.system.emit('action_save');
				this.system.emit('release_action_save');
				this.system.emit('feedback_save');
				this.system.emit('instance_save');
				this.system.emit('db_save');
			}
		}
		debug('instance save');
		this.system.emit('instance_save');
	}

	saveConfig () {
		// Save config, but do not automatically call this module's updateConfig again
		this.system.emit('instance_config_put', this.id, this.config, true);
	}

	addUpgradeScript (cb) {
		this._versionscripts.push(cb);
	}

	setActions (actions) {
		this.system.emit('instance_actions', this.id, actions);
	}

	setVariableDefinitions (variables) {
		this.system.emit('variable_instance_definitions_set', this, variables);
	}

	setVariable (variable, value) {
		this.system.emit('variable_instance_set', this, variable, value);
	}

	setFeedbackDefinitions (feedbacks) {
		this.system.emit('feedback_instance_definitions_set', this, feedbacks);
	}

	setPresetDefinitions (presets) {
		// Because RegExp.escape did not become a standard somehow
		function escape(str) {
			return str.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&');
		}

		/*
		* Clean up variable references: $(instance:variable)
		* since the name of the instance is dynamic. We don't want to
		* demand that your presets MUST be dynamically generated.
		*/
		for (var i = 0; i < presets.length; ++i) {
			var bank = presets[i].bank;
			var fixtext = bank.text;
			if (bank !== undefined) {
				if (fixtext.match(/\$\(/)) {
					var matches, reg = /\$\(([^:)]+):([^)]+)\)/g;

					while ((matches = reg.exec(fixtext)) !== null) {
						if (matches[1] !== undefined) {
							if (matches[2] !== undefined) {
								const reg2 = new RegExp('\\$\\(' + escape(matches[1]) + ':' + escape(matches[2]) + '\\)');
								bank.text = bank.text.replace(reg2, '$(' + this.label + ':' + matches[2] + ')');
							}
						}
					}
				}
			}
		}

		this.system.emit('preset_instance_definitions_set', this, presets);
	}

	checkFeedbacks (type) {
		this.system.emit('feedback_instance_check', this, type);
	}
}

module.exports = {
    instance_skel
};