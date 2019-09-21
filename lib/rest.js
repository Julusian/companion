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

const debug = require('debug')('lib/rest');
const { Client } = require('node-rest-client');

class RestClient {
	constructor(system) {
		this.system = system;

		system.on('rest', this.post.bind(this));
		system.on('rest_get', this.get.bind(this));
	}

	get(url, cb, extraHeaders, extraArgs) {
		debug('making get request:', url);

		const client = new Client(extraArgs);

		const args = {
			headers: { "Content-Type": "application/json" }
		};

		if (extraHeaders !== undefined) {
			for (const header in extraHeaders) {
				args.headers[header] = extraHeaders[header];
			}
		}

		client.get(url, args, function (data, response) {
			cb(null, { data: data, response: response });
		}).on('error', function(error) {
			debug('error response:', error);
			cb(true, { error: error });
		});
	}

	post(url, data, cb, extraHeaders, extraArgs) {
		debug('making post request:', url, data);

		const client = new Client(extraArgs);

		const args = {
			data: data,
			headers: { "Content-Type": "application/json" }
		};

		if (extraHeaders !== undefined) {
			for (var header in extraHeaders) {
				args.headers[header] = extraHeaders[header];
			}
		}

		client.post(url, args, function (data, response) {
			cb(null, { data: data, response: response });
		}).on('error', function(error) {
			debug('error response:', error);
			cb(true, { error: error });
		});
	}
}

module.exports = RestClient;
