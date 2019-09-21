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

const debug   = require('debug')('lib/rest_poll');
const shortid = require('shortid');
const RestClient = require('./rest');

/**
 * A helper that can be used by modules to poll a REST api on an interval
 */
class RestPoller {
	constructor(system) {
		this.system = system;
		this.rest = new RestClient(system);

		this.running = {};

		system.on('rest_poll', (instanceId, interval, url, data, pollObjCb, resultCb) => {
			pollObjCb(null, this.addPostPoll(instanceId, interval, url, data, resultCb));
		});

		system.on('rest_poll_get', (instanceId, interval, url, pollObjCb, resultCb) => {
			pollObjCb(null, this.addGetPoll(instanceId, interval, url, resultCb));
		});

		system.on('rest_poll_destroy', this.destroyInstance.bind(this));
	}

	_addPollInner(instanceId, timeInterval, type, url, data, callback, executeFunc) {
		const pollId = shortid.generate();

		const executeFuncWrapped = () => {
			const obj = this.running[instanceId][pollId];
			if (obj.waiting === true) {
				debug("Skipping this cycle for", pollId);
			} else {
				executeFunc(obj, (err, res) => {
					debug("got reply for", obj.id, obj.url);
					obj.waiting = false;
					obj.result_cb(err, res);
				});
			}
		};

		const poll = this.running[instanceId][pollId] = {
			instance: instanceId,
			id: pollId,
			interval: timeInterval,
			url: url,
			type: type,
			waiting: false,
			data: data,
			result_cb: callback,
			timer: setInterval(executeFuncWrapped.bind(this), timeInterval)
		};

		console.log("Rest poll added", this.running);
		return poll;
	}

	addPostPoll(instanceId, timeInterval, url, data, callback) {
		const executeFunc = (obj, cb) => this.rest.post(obj.url, obj.data, cb);

		return this._addPollInner(instanceId, timeInterval, 'post', url, data, callback, executeFunc);
	}

	addGetPoll(instanceId, timeInterval, url, callback) {
		const executeFunc = (obj, cb) => this.rest.get(obj.url, cb);
		
		return this._addPollInner(instanceId, timeInterval, 'get', url, {}, callback, executeFunc);
	}

	destroyInstance(instanceId) {
		debug("Clearing poll intervals for", instanceId);
		const instancePolls = this.running[instanceId];
		if (instancePolls !== undefined) {
			for (const poll of instancePolls) {
				if (poll.timer !== undefined) {
					debug("Killing interval for", poll.instance, poll.url);
					clearInterval(poll.timer);
				}
			}

			delete this.running[instanceId];
		}
	}
}

module.exports = RestPoller;
