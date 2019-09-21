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

const debug = require('debug')('lib/variable');

class VariableController {
	constructor(system, io) {
		this.system = system;
		this.io = io;

		this.variable_definitions = {};
		this.variables = {};

		system.on('io_connect', this.clientConnect.bind(this));

		system.on('variable_get_definitions', (cb) => cb(this.getAllDefinitions()));
		system.on('variable_instance_definitions_set', this.setInstanceDefinitions.bind(this));

		system.on('variable_instance_set', this.setVariable.bind(this));
		system.on('variable_rename_callback', (str, fromlabel, tolabel, cb) => cb(this.renameVariable(str, fromlabel, tolabel)));

		system.on('variable_instance_label_rename', this.instanceLabelRename.bind(this));
		system.on('instance_enable', this.instanceEnable.bind(this));
		system.on('instance_delete', this.instanceDelete.bind(this));

		system.on('variable_parse', (string, cb) => cb(this.parseVariable(string)));

		system.on('variable_get', (label, variable, cb) => cb(this.getVariable(label, variable)));
	}

	clientConnect(socket) {
		socket.on('variable_instance_definitions_get', () => {
			socket.emit('variable_instance_definitions_get:result', null, this.variable_definitions);
		});

		socket.on('variables_get', () => {
			const vars = {};
			for (const label in this.variables) {
				for (const variable in this.variables[label]) {
					vars[label + ':' + variable] = this.variables[label][variable];
				}
			}

			socket.emit('variables_get:result', null, vars);
		});
	}

	getAllDefinitions() {
		return this.variable_definitions;
	}
	setInstanceDefinitions(instance, variables) {
		this.variable_definitions[instance.label] = variables;

		debug('got instance variable definitions for ' + instance.label);
		this.io.emit('variable_instance_definitions_set', instance.label, variables);
	}

	setVariable(instance, variable, value) {
		if (this.variables[instance.label] === undefined) {
			this.variables[instance.label] = {};
		}

		if (this.variables[instance.label][variable] != value) {
			this.variables[instance.label][variable] = value;
	
			this.system.emit('variable_changed', instance.label, variable, value);
			debug('Variable $(' + instance.label + ':' + variable + ') is "' + value + '"');
			this.io.emit('variable_set', instance.label + ':' + variable, value);
		}
	}

	renameVariable(str, fromlabel, tolabel) {
		if (typeof str != 'string') {
			console.log("Warning, variable_rename_callback was called with this: ", str);
			return str;
		}

		let fixtext = str;
		if (fixtext.match(/\$\(/)) {
			const reg = /\$\(([^:)]+):([^)]+)\)/g;

			let matches;
			while ((matches = reg.exec(fixtext)) !== null) {
				if (matches[1] !== undefined && matches[1] == fromlabel) {
					if (matches[2] !== undefined) {
						const reg2 = new RegExp('\\$\\(' + escape(matches[1]) + ':' + escape(matches[2]) + '\\)');
						str = str.replace(reg2, '$(' + tolabel + ':' + matches[2] + ')');
					}
				}
			}
		}

		return str;
	}

	instanceLabelRename(labelFrom, labelTo) {
		if (this.variables[labelTo] === undefined) {
			this.variables[labelTo] = {};
		}
		const oldInstanceVariables = this.variables[labelFrom];
		const newInstanceVariables = this.variables[labelTo];

		if (oldInstanceVariables !== undefined) {
			for (var variable in oldInstanceVariables) {
				this.system.emit('bank_rename_variables', labelFrom, labelTo);
				newInstanceVariables[variable] = oldInstanceVariables[variable];
				delete oldInstanceVariables[variable];
				this.io.emit('variable_set', labelFrom + ':' + variable, undefined);

				// In case variables exists in banks from before
				this.system.emit('variable_changed', labelTo, variable, newInstanceVariables[variable]);
				this.io.emit('variable_set', labelTo + ':' + variable, newInstanceVariables[variable]);
			}
			delete this.variables[labelFrom];
		}

		if (this.variable_definitions[labelFrom] !== undefined) {
			this.variable_definitions[labelTo] = this.variable_definitions[labelFrom];
			delete this.variable_definitions[labelFrom];

			this.io.emit('variable_instance_definitions_set', labelTo, this.variable_definitions[labelTo]);
			this.io.emit('variable_instance_definitions_set', labelFrom, []);
		}
	}

	instanceEnable(instanceId, state) {
		if (state === false) {
			this.system.emit('instance_get', instanceId, function (info) {
				if (info && this.variables[info.label] !== undefined) {
					const keys = Object.keys(this.variables[info.label]);
					delete this.variable_definitions[info.label];
					delete this.variables[info.label];
					this.io.emit('variable_instance_definitions_set', info.label, []);

					// Reset banks
					for (var i = 0; i < keys.length; ++i) {
						// Force update
						this.system.emit('variable_changed', info.label, keys[i], undefined);
					}
				}
			});
		}
	}

	instanceDelete(instanceId, instanceLabel) {
		this.io.emit('variable_instance_definitions_set', instanceLabel, []);

		if (instanceLabel !== undefined) {
			if (this.variables[instanceLabel] !== undefined) {
				const instanceVariables = this.variables[instanceLabel];
				for (var variable in instanceVariables) {
					instanceVariables[variable] = undefined;
					this.system.emit('variable_changed', instanceLabel, variable, undefined);
					this.io.emit('variable_set', instanceLabel + ':' + variable, undefined);
				}
			}

			delete this.variable_definitions[instanceLabel];
			delete this.variables[instanceLabel];

			this.io.emit('variable_instance_definitions_set', instanceLabel, []);
		}
	}

	parseVariable(string) {
		// Everybody stand back. I know regular expressions. - xckd #208 /ck/kc/
		const reg = /\$\([^:$)]+:[^)$]+\)/;

		if (string === undefined) {
			return undefined;
		}

		const escapereg = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

		let vars;
		while ((vars = reg.exec(string)) !== null) {
			const matches = vars[0].match(/\$\(([^:)]+):([^)]+)\)/);
			if (this.variables[matches[1]] !== undefined) {
				if (this.variables[matches[1]][matches[2]] !== undefined) {
					string = string.replace(new RegExp(escapereg(matches[0])), this.variables[matches[1]][matches[2]]);
				} else {
					string = string.replace(new RegExp(escapereg(matches[0])), '$NA');
				}
			} else {
				string = string.replace(new RegExp(escapereg(matches[0])), '$NA');
			}
		}
		return string;
	}

	getVariable(instanceLabel, variable) {
		if (this.variables[instanceLabel] !== undefined) {
			return this.variables[instanceLabel][variable];
		} else {
			return undefined;
		}
	}
}

exports = module.exports = VariableController;
