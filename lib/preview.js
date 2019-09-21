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

const debug = require('debug')('lib/preview');

/**
 * Helper to stream images to a client for previewing in the browser
 */
class Preview {
	constructor(system, pages) {
		this.system = system;
		this.pages = pages;
		this.graphics = new require('./graphics')(system);

		this.previewClients = {};

		system.on('io_connect', this.clientConnect.bind(this));

		system.on('graphics_bank_invalidated', this.updateBank.bind(this));
	}

	clientConnect(socket) {
		debug('socket ' + socket.id + ' connected');

		this.previewClients[socket.id] = socket;
		
		// Install preview image handler
		const previewHandler = (...args) => this.handlePreview(socket, ...args);
		const previewPageHandler = (...args) => this.handlePreviewPage(socket, ...args);
		const webButtonsHandler = (...args) => this.handleWebButtons(socket, ...args);
		const webButtonsPageHandler = (...args) => this.handleWebButtonsPage(socket, ...args);

		socket.on('bank_preview', previewHandler);
		socket.on('bank_preview_page', previewPageHandler);
		socket.on('web_buttons', webButtonsHandler);
		socket.on('web_buttons_page', webButtonsPageHandler);

		socket.on('disconnect', () => {
			socket.removeListener('bank_preview', previewHandler);
			socket.removeListener('bank_preview_page', previewPageHandler);
			socket.removeListener('web_buttons', webButtonsHandler);
			socket.removeListener('web_buttons_page', webButtonsPageHandler);

			delete socket.isWebButtons;
			delete this.previewClients[socket.id];
			debug('socket ' + socket.id + ' disconnected');
		});
	}

	handlePreview (socket, page, bank) {
		debug("handlePreview()", page, bank);
	
		if (page === false) {
			debug('socket ' + socket.id + ' removed preview listener');
			socket._preview = undefined;
			return;
		}
		debug('socket ' + socket.id + ' added preview listener for ' + page + ', ' + bank);
	
		socket._preview = { page: page, bank: bank };
	
		const img = this.graphics.getBank(page, bank);
		socket.emit('preview_bank_data', page, bank, img.buffer, img.updated);
	}

	handleWebButtons(socket) {
		debug("handleWebButtons()");
	
		socket.isWebButtons = true;
		socket.emit('pages', this.pages.getPages());
	}

	handleWebButtonsPage(socket, page, lastUpdated) {
		debug("handleWebButtonsPage()",page);
		
		if (lastUpdated === null) return;

		const result = {};
		const images = this.graphics.getImagesForPage(page);
		
		for (let i = 0; i < global.MAX_BUTTONS; ++i) {
			if (lastUpdated === undefined || lastUpdated[i + 1] === undefined || lastUpdated[i + 1] != images[i].updated) {
				result[i + 1] = images[i];
			}
		}
	
		socket.emit('buttons_page_data', page, result);
	}

	handlePreviewPage(socket, page, lastUpdated) {
		socket._previewPage = page;

		const result = {};
		const images = this.graphics.getImagesForPage(page);

		for (let i = 0; i < global.MAX_BUTTONS; ++i) {
			if (lastUpdated === undefined || lastUpdated[i + 1] === undefined || lastUpdated[i + 1] != images[i].updated) {
				result[i + 1] = images[i];
			}
		}
	
		socket.emit('preview_page_data', result);
	}

	updateBank(page, bank) {
		for (let key in this.previewClients) {
			const socket = this.previewClients[key];
	
			if (socket._preview !== undefined && socket._preview.page == page && socket._preview.bank == bank) {
				const img = this.graphics.getBank(page, bank);
				socket.emit('preview_bank_data', page, bank, img.buffer, img.updated);
			}
	
			if (socket.isWebButtons) {
				const result = {};
				result[bank] = this.graphics.getBank(page, bank);
	
				socket.emit('buttons_bank_data', page, result);
	
			} else
			if (socket._previewPage !== undefined && socket._previewPage == page) {
				const result = {};
				result[bank] = this.graphics.getBank(page, bank);

				socket.emit('preview_page_data', result);
			}
		}
	}
}

module.exports = Preview;
