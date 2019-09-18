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

import { EventEmitter } from 'events';
import { Image, rgb } from './image';
import {
	CompanionActionEvent,
	CompanionFeedbackEvent,
	CompanionFeedbackResult,
	CompanionInputField,
	CompanionSystem,
	CompanionPreset,
	CompanionFeedbacks,
	CompanionVariable,
	CompanionActions,
} from "./types";
// var debug = require('debug')('lib/instance_skel');

export const REGEX_IP =             '/^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/';
export const REGEX_BOOLEAN =        '/^(true|false|0|1)$/i';
export const REGEX_PORT =           '/^([1-9]|[1-8][0-9]|9[0-9]|[1-8][0-9]{2}|9[0-8][0-9]|99[0-9]|[1-8][0-9]{3}|9[0-8][0-9]{2}|99[0-8][0-9]|999[0-9]|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-4])$/';
export const REGEX_PERCENT =        '/^(100|[0-9]|[0-9][0-9])$/';
export const REGEX_FLOAT =          '/^([0-9]*\\.)?[0-9]+$/';
export const REGEX_FLOAT_OR_INT =   '/^([0-9]+)(\\.[0-9+])?$/';
export const REGEX_SIGNED_FLOAT =   '/^[+-]?([0-9]*\\.)?[0-9]+$/';
export const REGEX_NUMBER =         '/^\\d+$/';
export const REGEX_SOMETHING =      '/^.+$/';
export const REGEX_SIGNED_NUMBER =  '/^[+-]?\\d+$/';
export const REGEX_TIMECODE =       '/^(0*[0-9]|1[0-9]|2[0-4]):(0*[0-9]|[1-5][0-9]|60):(0*[0-9]|[1-5][0-9]|60):(0*[0-9]|[12][0-9]|30)$/';
export const CHOICES_YESNO_BOOLEAN = [ { id: 'true', label: 'Yes' }, { id: 'false', label: 'No' } ];

export enum InstanceStatus {
	UNKNOWN = null,
	OK = 0,
	WARNING = 1,
	ERROR = 2,
}

export interface InstanceConfigBase {
	[key: string]: string | undefined;
	label?: string;
	_configIdx?: string;
}

export abstract class InstanceSkel<TConfig extends InstanceConfigBase> {
	public id: string;
	public label: string;
	protected system: EventEmitter;
	protected config: TConfig;
	protected package_info: any;

	public _versionscripts: any[];
	public currentStatus: InstanceStatus;
	public currentStatusMessage?: string;

	protected debug: (msg: string, ...args: string[]) => void;
	protected log: (msg: string, ...args: string[]) => void;

	public Image: typeof Image;
	public rgb: typeof rgb;

	constructor(system: CompanionSystem, id: string, config: TConfig) {
		this.system = system;
		this.id = id;
		this.config = config;
		this.label = this.config.label || '';
		this.package_info = {};

		this.Image = Image;
		this.rgb = rgb;

		// TODO - should these do something?
		this.debug = () => {};
		this.log = () => {};

		// we need this object from instance, and I don't really know how to get it
		// out of instance.js without adding an argument to instance() for every
		// single module? TOD;O: håkon: look over this, please.
		system.emit('instance_get_package_info', (obj) => {
			this.package_info = obj[this.config.instance_type];
		});

		this._versionscripts = [];

		this.currentStatus = InstanceStatus.UNKNOWN;
		this.currentStatusMessage = '';
	}

	/**
	 * Main initialization function called once the module
	 * is OK to start doing things.
	 * @since 1.0.0
	 */
	public abstract init(): void;

	/**
	 * Clean up the instance before it is destroyed.
	 * @since 1.0.0
	 */
	public abstract destroy(): void;

	/**
	 * Process an updated configuration array.
	 * @since 1.0.0
	 */
	public abstract updateConfig(config: TConfig): void;

	/**
	 * Creates the configuration fields for web config.
	 * @since 1.0.0
	 */
	public abstract config_fields(): CompanionInputField[];

	/**
	 * Executes the provided action.
	 * @since 1.0.0
	 */
	public abstract action(action: CompanionActionEvent): void;

	/**
	 * Processes a feedback state.
	 * @since 1.0.0
	 */
	public abstract feedback(feedback: CompanionFeedbackEvent): CompanionFeedbackResult;

	public _init() {
		// These two functions needs to be defined after the module has been instanced,
		// as they reference the original constructors static data

		// Debug with module-name prepeded
		this.debug = require('debug')('instance:' + this.package_info.name + ':' + this.id);

		// Log to the skeleton (launcher) log window
		this.log = (level, info) => {
			this.system.emit('log', 'instance(' + this.label + ')', level, info);
		};

		if (typeof this.init === 'function') {
			this.init();
		}
	}

	// Update instance health, levels: null = unknown, 0 = ok, 1 = warning, 2 = error
	public status(level: InstanceStatus, message?: string) {
		this.currentStatus = level;
		this.currentStatusMessage = message;
		this.system.emit('instance_status_update', this.id, level, message);
	}


	public upgradeConfig() {
		const idx = this.config._configIdx === undefined ? -1 : parseInt(this.config._configIdx, 10);

		const debug = require('debug')('instance:' + this.package_info.name + ':' + this.id);

		if (idx + 1 < this._versionscripts.length) {
			debug("upgradeConfig(" + this.package_info.name + "): " + (idx + 1) + ' to ' + this._versionscripts.length);
		}

		for (let i = idx + 1; i < this._versionscripts.length; ++i) {
			debug('UpgradeConfig: Upgrading to version ' + (i + 1));

			// Fetch instance actions
			let actions = [];
			this.system.emit('actions_for_instance', this.id, (_actions) => {
				actions = _actions;
			});
			let release_actions = [];
			this.system.emit('release_actions_for_instance', this.id, (_release_actions) => {
				release_actions = _release_actions;
			});
			let feedbacks = [];
			this.system.emit('feedbacks_for_instance', this.id, (_feedbacks) => {
				feedbacks = _feedbacks;
			});

			let result;
			try {
				result = this._versionscripts[i](this.config, actions, release_actions, feedbacks);
			} catch (e) {
				debug("Upgradescript in " + this.package_info.name + ' failed', e);
			}
			this.config._configIdx = i + '';

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

	public saveConfig() {
		// Save config, but do not automatically call this module's updateConfig again
		this.system.emit('instance_config_put', this.id, this.config, true);
	}

	public addUpgradeScript(cb) {
		this._versionscripts.push(cb);
	}

	public setActions(actions: CompanionActions) {
		this.system.emit('instance_actions', this.id, actions);
	}

	public setVariableDefinitions(variables: CompanionVariable[]) {
		this.system.emit('variable_instance_definitions_set', this, variables);
	}

	public setVariable(variable: string, value: string) {
		this.system.emit('variable_instance_set', this, variable, value);
	}

	public setFeedbackDefinitions(feedbacks: CompanionFeedbacks) {
		this.system.emit('feedback_instance_definitions_set', this, feedbacks);
	}

	public setPresetDefinitions(presets: CompanionPreset[]) {
		// Because RegExp.escape did not become a standard somehow
		function escape(str) {
			return str.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&');
		}

		/*
		* Clean up variable references: $(instance:variable)
		* since the name of the instance is dynamic. We don't want to
		* demand that your presets MUST be dynamically generated.
		*/
		for (const { bank } of presets) {
			const fixtext = bank.text;
			if (bank !== undefined && fixtext !== undefined) {
				if (fixtext.match(/\$\(/)) {
					const reg = /\$\(([^:)]+):([^)]+)\)/g;

					let matches: RegExpExecArray | null;
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

	public checkFeedbacks(type) {
		this.system.emit('feedback_instance_check', this, type);
	}
}
