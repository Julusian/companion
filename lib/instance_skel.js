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
const { instance_skel, STATUS, REGEX, CHOICES_YESNO_BOOLEAN } = require('./instance_skel2');

function defineConst (thisArg, name, value) {
	Object.defineProperty(thisArg, name, {
		value:      value,
		enumerable: true
	});
}

/**
 * This file returns a modified instance_skel to be compatible with prototype based modules
 */
instance_skel.extendedBy = function (module) {
	util.inherits(module, instance_skel);
};
instance_skel.apply = function(thisArg, argArray) {

	defineConst(thisArg, 'REGEX_IP',            REGEX.IP);
	defineConst(thisArg, 'REGEX_BOOLEAN',       REGEX.BOOLEAN);
	defineConst(thisArg, 'REGEX_PORT',          REGEX.PORT);
	defineConst(thisArg, 'REGEX_PERCENT',       REGEX.PERCENT);
	defineConst(thisArg, 'REGEX_FLOAT',         REGEX.FLOAT);
	defineConst(thisArg, 'REGEX_FLOAT_OR_INT',  REGEX.FLOAT_OR_INT);
	defineConst(thisArg, 'REGEX_SIGNED_FLOAT',  REGEX.SIGNED_FLOAT);
	defineConst(thisArg, 'REGEX_NUMBER',        REGEX.NUMBER);
	defineConst(thisArg, 'REGEX_SOMETHING',     REGEX.SOMETHING);
	defineConst(thisArg, 'REGEX_SIGNED_NUMBER', REGEX.SIGNED_NUMBER);
	defineConst(thisArg, 'REGEX_TIMECODE',      REGEX.TIMECODE);
	defineConst(thisArg, 'CHOICES_YESNO_BOOLEAN', CHOICES_YESNO_BOOLEAN);

	// Going to be deprecated sometime
	defineConst(thisArg, 'STATE_UNKNOWN', STATUS.UNKNOWN);
	defineConst(thisArg, 'STATE_OK', STATUS.OK);
	defineConst(thisArg, 'STATE_WARNING', STATUS.WARNING);
	defineConst(thisArg, 'STATE_ERROR', STATUS.ERROR);

	// Use these instead
	defineConst(thisArg, 'STATUS_UNKNOWN', STATUS.UNKNOWN);
	defineConst(thisArg, 'STATUS_OK', STATUS.OK);
	defineConst(thisArg, 'STATUS_WARNING', STATUS.WARNING);
	defineConst(thisArg, 'STATUS_ERROR', STATUS.ERROR);

	Object.assign(thisArg, new instance_skel(...argArray));
};

module.exports = instance_skel;