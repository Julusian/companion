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

const util = require('util');
const {
	InstanceSkel,
	InstanceStatus,
	REGEX_IP,
	REGEX_BOOLEAN,
	REGEX_PORT,
	REGEX_PERCENT,
	REGEX_FLOAT,
	REGEX_FLOAT_OR_INT,
	REGEX_SIGNED_FLOAT,
	REGEX_NUMBER,
	REGEX_SOMETHING,
	REGEX_SIGNED_NUMBER,
	REGEX_TIMECODE,
	CHOICES_YESNO_BOOLEAN,
} = require('./instance_skel2');

function defineConst(thisArg, name, value) {
	Object.defineProperty(thisArg, name, {
		value:      value,
		enumerable: true
	});
}

/**
 * This file returns a modified instance_skel to be compatible with prototype based modules
 */
InstanceSkel.extendedBy = function (module) {
	util.inherits(module, InstanceSkel);
};
InstanceSkel.apply = function(thisArg, argArray) {
	Object.assign(thisArg, new InstanceSkel(...argArray));


	defineConst(thisArg, 'REGEX_IP', REGEX_IP);
	defineConst(thisArg, 'REGEX_BOOLEAN', REGEX_BOOLEAN);
	defineConst(thisArg, 'REGEX_PORT', REGEX_PORT);
	defineConst(thisArg, 'REGEX_PERCENT', REGEX_PERCENT);
	defineConst(thisArg, 'REGEX_FLOAT', REGEX_FLOAT);
	defineConst(thisArg, 'REGEX_FLOAT_OR_INT', REGEX_FLOAT_OR_INT);
	defineConst(thisArg, 'REGEX_SIGNED_FLOAT', REGEX_SIGNED_FLOAT);
	defineConst(thisArg, 'REGEX_NUMBER', REGEX_NUMBER);
	defineConst(thisArg, 'REGEX_SOMETHING', REGEX_SOMETHING);
	defineConst(thisArg, 'REGEX_SIGNED_NUMBER', REGEX_SIGNED_NUMBER);
	defineConst(thisArg, 'REGEX_TIMECODE', REGEX_TIMECODE);
	defineConst(thisArg, 'CHOICES_YESNO_BOOLEAN', CHOICES_YESNO_BOOLEAN);

	// Going to be deprecated sometime
	defineConst(thisArg, 'STATE_UNKNOWN', InstanceStatus.UNKNOWN);
	defineConst(thisArg, 'STATE_OK', InstanceStatus.OK);
	defineConst(thisArg, 'STATE_WARNING', InstanceStatus.WARNING);
	defineConst(thisArg, 'STATE_ERROR', InstanceStatus.ERROR);

	// Use these instead
	defineConst(thisArg, 'STATUS_UNKNOWN', InstanceStatus.UNKNOWN);
	defineConst(thisArg, 'STATUS_OK', InstanceStatus.OK);
	defineConst(thisArg, 'STATUS_WARNING', InstanceStatus.WARNING);
	defineConst(thisArg, 'STATUS_ERROR', InstanceStatus.ERROR);
};

module.exports = InstanceSkel;
