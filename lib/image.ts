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

// Super primitive drawing library!

import { readFileSync } from 'fs';
import { PNG } from 'pngjs';
import { URL } from 'url';
const debug = require('debug')('lib/image');
const font = require('./font')();

export const AutoFont = 'auto';
export const IconFont = 'icon';
export enum SizedFonts {
	Pt7 = 77,
	Pt14 = 14,
	Pt18 = 18,
	Pt24 = 24,
	Pt30 = 30,
	Pt44 = 44,
}

export enum HorizAlign {
	Left = 'left',
	Center = 'center',
	Right = 'right',
}
export enum VertAlign {
	Top = 'top',
	Center = 'center',
	Bottom = 'bottom',
}

/**
 * Convert separate rgb components to a single number
 */
export function rgb(r: number, g: number, b: number): number {
	return (((r & 0xff) << 16) |
		((g & 0xff) << 8) |
		(b & 0xff));
}
/**
 * Convert separate argb components to a single number
 */
function argb(a: number, r: number, g: number, b: number): number {
	// bitwise doesn't work because JS bitwise is working with 32bit signed int
	return a * 0x1000000 + rgb(r, g, b);
}

export class Image {
	public width: number;
	public height: number;

	public lastUpdate: number;
	private canvas: Buffer[];
	private lastBackgroundColor: number;

	constructor(width?: number, height?: number) {
		/* Defaults for custom images from modules */
		if (width === undefined) {
			width = 72;
		}
		if (height === undefined) {
			height = 58;
		}

		this.rgb = rgb;
		this.argb = argb;

		this.lastUpdate = Date.now();
		this.width = width;
		this.height = height;
		this.canvas = [];
		this.lastBackgroundColor = this.rgb(0, 0, 0);
		for (let y = 0; y < this.height; y++) {
			const buf = new Buffer(this.width * 3); // * 3 for RGB.
			this.canvas.push(buf);
		}
		return this;
	}

	public rgb = rgb;
	public argb = argb;

	public backgroundColor(backgroundColor: number): boolean {
		this.lastBackgroundColor = backgroundColor;
		for (let y = 0; y < this.height; y++) {
			for (let x = 0; x < this.width; x++) {
				this.pixel(x, y, backgroundColor);
			}
		}
		return true;
	}

	public pixel(x: number, y: number, color: number): boolean {
		if (x >= this.width || y >= this.height) {
			return false;
		}
		const line = this.canvas[y];
		if (color <= 0xffffff) {
			line.writeUIntBE(color & 0xffffff, x * 3, 3);
		} else {
			const alpha = Math.floor(color / 0x1000000) / 0xff;
			const oldr = line.readUInt8(x * 3);
			const oldg = line.readUInt8(x * 3 + 1);
			const oldb = line.readUInt8(x * 3 + 2);
			const newr = (color >> 16) & 0xff;
			const newg = (color >> 8) & 0xff;
			const newb = color & 0xff;
			line.writeUIntBE(
				rgb(oldr * (1 - alpha) + newr * alpha,
				oldg * (1 - alpha) + newg * alpha,
				oldb * (1 - alpha) + newb * alpha),
				x * 3,
				3,
			);
		}
		this.lastUpdate = Date.now();
		return true;
	}

	public horizontalLine(y: number, color: number): boolean {
		for (let x = 0; x < this.width; x++) {
			this.pixel(x, y, color);
		}
		return true;
	}
	public verticalLine(x: number, color: number): boolean {
		for (let y = 0; y < this.height; y++) {
			this.pixel(x, y, color);
		}
		return true;
	}
	public boxFilled(x1: number, y1: number, x2: number, y2: number, color: number): boolean {
		for (let y = y1; y <= y2; y++) {
			for (let x = x1; x <= x2; x++) {
				this.pixel(x, y, color);
			}
		}
		return true;
	}
	public boxLine(x1: number, y1: number, x2: number, y2: number, color: number): boolean {
		for (let y = y1; y <= y2; y++) {
			// draw horizontal lines
			if (y === y1 || y === y2) {
				for (let x = x1; x <= x2; x++) {
					this.pixel(x, y, color);
				}
			}
			// draw vertical lines
			if (y > y1 || y < y2) {
				this.pixel(x1, y, color);
				this.pixel(x2, y, color);
			}
		}
		return true;
	}
	public drawFromPNGdata(
		data: Buffer,
		xStart = 0,
		yStart = 0,
		width = 72,
		height = 58,
		halign: HorizAlign = HorizAlign.Center,
		valign: VertAlign = VertAlign.Center,
	) {
		// tslint:disable-next-line: one-variable-per-declaration
		let xouter: number, xinner: number, youter: number, yinner: number, wouter: number, houter: number;

		if (xStart + width > this.width) {
			width = this.width - xStart;
		}
		if (yStart + height > this.height) {
			height = this.height - yStart;
		}
		const png = PNG.sync.read(data);
		if (png.width > width) { // image is broader than drawing pane
			switch (halign) {
				case 'left':
					xouter = 0;
					xinner = 0;
					wouter = width;
					break;
				case 'center':
					xouter = 0;
					xinner = Math.round((png.width - width) / 2);
					wouter = width;
					break;
				case 'right':
					xouter = 0;
					xinner = png.width - width;
					wouter = width;
					break;
			}
		} else { // image is narrower than drawing pane
			switch (halign) {
				case 'left':
					xouter = 0;
					xinner = 0;
					wouter = png.width;
					break;
				case 'center':
					xouter = Math.round((width - png.width) / 2);
					xinner = 0;
					wouter = png.width;
					break;
				case 'right':
					xouter = width - png.width;
					xinner = 0;
					wouter = png.width;
					break;
			}
		}
		if (png.height > height) { // image is taller than drawing pane
			switch (valign) {
				case 'top':
					youter = 0;
					yinner = 0;
					houter = height;
					break;
				case 'center':
					youter = 0;
					yinner = Math.round((png.height - height) / 2);
					houter = height;
					break;
				case 'bottom':
					youter = 0;
					yinner = png.height - height;
					houter = height;
					break;
			}
		} else {
			switch (valign) { // image is smaller than drawing pane
				case 'top':
					youter = 0;
					yinner = 0;
					houter = png.height;
					break;
				case 'center':
					youter = Math.round((height - png.height) / 2);
					yinner = 0;
					houter = png.height;
					break;
				case 'bottom':
					youter = height - png.height;
					yinner = 0;
					houter = png.height;
					break;
			}
		}
		for (let y = 0; y < houter; y++) {
			for (let x = 0; x < wouter; x++) {
				const idx = (png.width * (y + yinner) + x + xinner) << 2;
				const r = png.data[idx];
				const g = png.data[idx + 1];
				const b = png.data[idx + 2];
				const a = png.data[idx + 3];
				if (png.data[idx + 3] > 0) {
					if (png.data[idx + 3] === 256) {
						this.pixel(xStart + xouter + x, yStart + youter + y, this.rgb(r, g, b));
					} else {
						this.pixel(xStart + xouter + x, yStart + youter + y, this.argb(a, r, g, b));
					}
				}
			}
		}
	}
	public drawFromPNG(file: string | URL, xStart: number, yStart: number) {
		try {
			const data = readFileSync(file);
			this.drawFromPNGdata(data, xStart, yStart);
		} catch (e) {
			debug("Error opening image file: " + file, e);
			return;
		}
	}
	public drawText(
		x: number,
		y: number,
		text: string,
		color: number,
		fontindex: SizedFonts,
		spacing: number,
		double?: boolean,
		dummy?: boolean,
	): number {
        /*
            DEPRECATED
            This function has several problems
            Use drawTextLine or drawAlignedText instead
        */
		if (text === undefined || text.length === 0) {
			return 0;
		}
		if (spacing === undefined) {
			spacing = 2;
		}

		const chars = text.split("");
		let max_x = 0;
		let x_pos = 0;
		let y_pos = y;
		let just_wrapped = true;
		for (let c of chars) {
			if ((x + x_pos > this.width - (double ? 16 : 8)) && !dummy) {
				x_pos = 0;
				y_pos += (double ? 18 : 9);
				just_wrapped = true;
			}
			if (!(c === " " && just_wrapped === true)) {
				x_pos += (double ? 4 : 2) + this.drawLetter(x + x_pos, y_pos, c, color, fontindex, double, dummy);
			}
			just_wrapped = false;
			if (x_pos > max_x) {
				max_x = x_pos;
			}
		}
		return max_x;
	}
	public drawTextLine(
		x: number,
		y: number,
		text: string,
		color: number,
		fontindex: SizedFonts,
		spacing: number = 2,
		double?: boolean,
		dummy?: boolean,
	) {
		if (text === undefined || text.length === 0) {
			return 0;
		}
		const chars = text.split("");
		let max_x = 0;
		let x_pos = 0;
		const y_pos = y;
		for (let i = 0; i < chars.length; i++) {
			let charcode = chars[i].charCodeAt(0);
			// check if this is the start of a surrogate pair
			if (charcode >= 0xD800 && charcode <= 0xDBFF && chars.length - 1 > i) {
				const lead = charcode;
				const tail = chars[i + 1].charCodeAt(0);
				if (tail >= 0xDC00 && tail <= 0xDFFF) { // low surrogate
					charcode = (lead - 0xD800) * 0x400 + tail - 0xDC00 + 0x10000;
					i++;
				}
			}
			const width = this.drawChar(x + x_pos, y_pos, charcode, color, fontindex, double, dummy);
			x_pos += width ? width : 0;
			if (i < chars.length - 1) {
				x_pos += width ? (double ? spacing * 2 : spacing) : 0;
			}
			if (x_pos > max_x) {
				max_x = x_pos;
			}
		}
		return max_x;
	}
	// TODO: there is still something fuckedup with this library. Rewrite pending!
	public drawCenterText(
		x: number,
		y: number,
		text: string,
		color: number,
		fontindex: SizedFonts,
		spacing: number,
		double?: boolean,
	) {
        /*
            DEPRECATED
            This Function doesn't work with UTF16 text.
            Use drawAlignedText instead
        */
		if (text === undefined || text === '') {
			return 0;
		}
		const xCenter = x;
		let maxWidth = x * 2; // maximum line width is only correct if text center position is left of image center
		if (maxWidth > this.width) {
			maxWidth = (this.width - x) * 2; // correction of line width if text center is right of image center
		}
		let displayText = text.trim(); // remove leading and trailing spaces for display
		// do we have more then one line?
		let xSize = this.drawText(0, 0, displayText, color, fontindex, spacing, double, true);
		if (xSize > maxWidth) {
			// breakup text in pieces
			// const breakChars = '\s-~,';
			const breakPos = [0];
			let lastBreakPos = 0;
			for (let i = 0; i < displayText.length; i++) {
				if (
					displayText.charCodeAt(i) === 32 ||
					displayText.charCodeAt(i) === 45 ||
					displayText.charCodeAt(i) === 95 ||
					displayText.charCodeAt(i) === 58 ||
					displayText.charCodeAt(i) === 126
				) {
					lastBreakPos = i; // remember the latest position where break is possible
				}

				const textStr = displayText.substr(breakPos[breakPos.length - 1], i + 1);
				if (this.drawText(0, 0, textStr, color, fontindex, spacing, double, true) > maxWidth) {
					if (lastBreakPos > 0) { // if line is getting too long and there was a good wrap position, wrap it at that position
						if (displayText.charCodeAt(lastBreakPos) === 32) { // if the break position was a space we want to get rid of it
							displayText = displayText.slice(0, lastBreakPos) + displayText.slice(lastBreakPos + 1);
						} else {
							if (i - lastBreakPos > 0) {
								// if we can afford we want to have the breaking charakter in the top line,
								// otherwise it gets wrapped (ugly, but better for space usage)
								lastBreakPos += 1;
							}
						}
						breakPos.push(lastBreakPos);
					} else {
						breakPos.push(i - 1); // if there has been no good break position, just wrap it anyway
						lastBreakPos = 0;
					}
				}
			}
			breakPos.push(displayText.length);
			for (let lines = 1; lines < breakPos.length; lines++) {
				const textStr = displayText.substr(breakPos[lines - 1], breakPos[lines]);
				xSize = this.drawText(0, 0, textStr, color, fontindex, spacing, double, true);
				const xStart = Math.floor(xCenter - xSize / 2);
				const yStart = y - Math.floor(((breakPos.length - 1) * (double ? 14 : 7) + (breakPos.length - 2) * (double ? 4 : 2)) / 2) + (lines - 1) * (double ? 18 : 9);
				this.drawText(xStart, yStart, textStr, color, fontindex, spacing, double);
			}
		} else {
			// just draw one line
			const xStart2 = Math.floor(xCenter - xSize / 2);
			return this.drawText(xStart2, y - (double ? 7 : 4), displayText, color, fontindex, spacing, double);
		}
	}
    /*
        Draws aligned text in an boxed area.
        int x: bounding box top left horizontal value
        int y: bounding box top left vertical value
        int w: bounding box width
        int h: bounding box height
        string text: the text to drawBank
        rgb-array color: color of the text
        string fontindex: index of font, either 'icon' or something else
        int spacing: how much space should be between letters, leave undefined for spacing of font
        int size: font size multiplier
        string halign: horizontal alignment left, center, right
        string valign: vertical alignment top, center, bottom
        bool dummy: don't actually draw anything if true, just return if the text fits

        returns true if text fits
    */
	public drawAlignedText(
		x = 0,
		y = 0,
		w = 72,
		h = 72,
		text: string,
		color: number,
		fontindex: SizedFonts | 'auto',
		spacing: any,
		size = 1,
		halign = 'center',
		valign = 'center',
		dummy = false,
	) {
		let textFits = true;
		let lineheight: number;
		let linespacing: number;
		let charspacing: any;
		const double = size === 2;

		if (fontindex === 'auto') {
			fontindex = 0;
			for (const checksize of [44, 30, 24, 18, 14]) {
				if (this.drawAlignedText(x, y, w, h, text, color, checksize, spacing, size, halign, valign, true)) {
					fontindex = checksize;
					break;
				}
			}
		}
		lineheight = font[fontindex].lineheight;
		linespacing = font[fontindex].linespacing;
		if (spacing !== undefined) {
			charspacing = spacing;
		} else {
			charspacing = font[fontindex].charspacing;
		}
		let displayText = text.trim(); // remove leading and trailing spaces for display
		let xSize = this.drawTextLine(0, 0, displayText, color, fontindex, charspacing, double, true);
		// breakup text in pieces
		const breakPos = [0];
		let lastBreakPos = 0;
		for (let i = 0; i < displayText.length; i++) {
			if (
				displayText.charCodeAt(i) === 32 ||
				displayText.charCodeAt(i) === 45 ||
				displayText.charCodeAt(i) === 95 ||
				displayText.charCodeAt(i) === 58 ||
				displayText.charCodeAt(i) === 126
			) {
				lastBreakPos = i; // remember the latest position where break is possible
			}
			// Support \n as line breaker
			if (displayText.substr(i, 2) === '\\n') {
				lastBreakPos = i;
				displayText = displayText.slice(0, lastBreakPos) + displayText.slice(lastBreakPos + 2);
				i--;
				breakPos.push(lastBreakPos);
				lastBreakPos = 0;
			}

			const textStr = displayText.slice(breakPos[breakPos.length - 1], i + 1);
			if (this.drawTextLine(0, 0, textStr, color, fontindex, charspacing, double, true) > w) {
				if (lastBreakPos > 0) { // if line is getting too long and there was a good wrap position, wrap it at that position
					if (displayText.charCodeAt(lastBreakPos) === 32) { // if the break position was a space we want to get rid of it
						displayText = displayText.slice(0, lastBreakPos) + displayText.slice(lastBreakPos + 1);
						i--;
					} else {
						if ((i - lastBreakPos) > 0) {
							// if we can afford we want to have the breaking character in the top line,
							// otherwise it gets wrapped (ugly, but better for space usage)
							lastBreakPos += 1;
						}
					}
					breakPos.push(lastBreakPos);
					lastBreakPos = 0;
				} else {
					breakPos.push(i); // if there has been no good break position, just wrap it anyway
					lastBreakPos = 0;
				}
			}
		}
		breakPos.push(displayText.length);
		let lines = breakPos.length - 1;
		if ((lines * lineheight * (double ? 2 : 1) + (lines - 1) * linespacing * (double ? 2 : 1)) > h) {
			lines = Math.floor((h + linespacing * (double ? 2 : 1)) / ((lineheight + linespacing) * (double ? 2 : 1)));
			textFits = false;
		}
		if (lines === 0) {
			return true;
		}
		if (!dummy) {
			for (let line = 1; line <= lines; line++) {
				const textStr = displayText.slice(breakPos[line - 1], breakPos[line]);
				xSize = this.drawTextLine(0, 0, textStr, color, fontindex, charspacing, double, true);
				let xStart: number;
				let yStart: number;
				switch (halign) {
					case 'left':
						xStart = x;
						break;
					case 'center':
						xStart = (x + Math.floor((w - xSize) / 2));
						break;
					case 'right':
						xStart = x + w - xSize;
						break;
				}
				switch (valign) {
					case 'top':
						yStart = y + (line - 1) * (lineheight + linespacing) * (double ? 2 : 1);
						break;
					case 'center':
						yStart = y + Math.floor((h - (lines * lineheight * (double ? 2 : 1) + (lines - 1) * linespacing * (double ? 2 : 1))) / 2) + (line - 1) * (lineheight + linespacing) * (double ? 2 : 1);
						break;
					case 'bottom':
						yStart = y + h - (lines - line + 1) * (lineheight + linespacing) * (double ? 2 : 1);
						break;
				}
				const linetext = displayText.slice(breakPos[line - 1], breakPos[line]);
				this.drawTextLine(xStart, yStart, linetext, color, fontindex, charspacing, double);
			}
		}
		return textFits;
	}
	public drawLetter(
		x: number,
		y: number,
		letter: string,
		color: number,
		fontindex: SizedFonts | 'icon',
		double?: boolean,
		dummy?: boolean,
	) {
        /*
            DEPRECATED
            This Function doesn't work with UTF16 chars
            Use drawChar instead
        */
		if (letter === undefined || ((letter.length > 1 || letter.length === 0) && letter === 'icon')) {
			return 0;
		}
		// dummy is for not drawing any actual pixels. just calculate the font size
		let num: any;
		if (fontindex !== 'icon') {
			num = letter.charCodeAt(0);
		} else {
			num = letter;
		}
		return this.drawChar(x, y, num, color, fontindex, double, dummy);
	}
    /**
     * drawPixeBuffer(x, y, width, height, buffer[, type])
     *
     * Buffer can be either a buffer, or base64 encoded string.
     * Type can be set to either 'buffer' or 'base64' according to your input data.
     * Width and height is information about your buffer, not scaling.
     *
     * The buffer data is expected to be RGB or ARGB data, 1 byte per color,
     * horizontally. Top left is first three bytes.
     */
	public drawPixelBuffer(x: number, y: number, width: number, height: number, buffer: string | Buffer, type: string) {
		if (type === undefined && typeof buffer === 'object' && buffer instanceof Buffer) {
			type = 'buffer';
		} else if ((type === undefined || type === 'base64') && typeof buffer === 'string') {
			type = 'base64';
			buffer = new Buffer(buffer, 'base64');
		}

		if (buffer.length < width * height * 3) {
			throw new Error(`Pixelbuffer of ${buffer.length} bytes is less than expected ${width * height * 3} bytes`);
		}
		if (typeof buffer === 'string') {
			throw new Error(`Pixelbuffer of ${buffer.length} bytes must be a buffer and not a string`);
		}

		if (buffer.length === width * height * 4) { // ARGB
			let counter = 0;
			for (let y2 = 0; y2 < height; ++y2) {
				for (let x2 = 0; x2 < width; ++x2) {
					const color = buffer.readUInt32BE(counter);
					this.pixel(x + x2, y + y2, color);
					counter += 4;
				}
			}
		} else if (buffer.length === width * height * 3) { // RGB
			let counter2 = 0;
			for (let y3 = 0; y3 < height; ++y3) {
				for (let x3 = 0; x3 < width; ++x3) {
					const color2 = buffer.readUIntBE(counter2, 3);
					this.pixel(x + x3, y + y3, color2);
					counter2 += 3;
				}
			}
		} else {
			throw new Error('Pixelbuffer for a ' + width + 'x' + height + ' image should be either ' + (width * height * 3) + ' or ' + (width * height * 4) + ' bytes big. Not ' + buffer.length);
		}
	}
	public drawChar(
		x: number,
		y: number,
		char: string | number,
		color: number,
		fontindex: SizedFonts | 'icon',
		double?: boolean,
		dummy?: boolean, // dummy is for not drawing any actual pixels. just calculate the font size
	) {
		if (char === undefined) {
			return 0;
		}
		if (char === 32 || char === 160) {
			return 2; // return blanks for space
		}
		if (font[fontindex] === undefined) {
			return 0;
		}
		if (char >= 0xD800 && char <= 0xDBFF) { // most likely a lead surrogate of an UTF16 pair
			return 0;
		}
		if (font[fontindex][char] === undefined) {
			const charStr = String.fromCharCode(parseInt(char + '', 10));
			debug("trying to draw a character that doesnt exist in the font:", char, charStr);
			return 0;
		}
		const gfx = font[fontindex][char];
		let maxX = 0;
		for (const pixel in gfx) {
			if (double) {
				if ((gfx[pixel][0] + 1) * 2 > maxX) {
					maxX = (gfx[pixel][0] + 1) * 2;
				}
				if (!dummy) {
					for (let len = 0; len < gfx[pixel][2]; len++) {
						this.pixel(x + (gfx[pixel][0] * 2), y + (gfx[pixel][1] * 2 + len * 2), color);
						this.pixel(x + (gfx[pixel][0] * 2) + 1, y + (gfx[pixel][1] * 2 + len * 2), color);
						this.pixel(x + (gfx[pixel][0] * 2), y + (gfx[pixel][1] * 2) + len * 2 + 1, color);
						this.pixel(x + (gfx[pixel][0] * 2) + 1, y + (gfx[pixel][1] * 2) + len * 2 + 1, color);
					}
				}
			} else {
				if (gfx[pixel][0] + 1 > maxX) {
					maxX = gfx[pixel][0] + 1;
				}
				if (!dummy) {
					for (let len2 = 0; len2 < gfx[pixel][2]; len2++) {
						this.pixel(x + gfx[pixel][0], y + gfx[pixel][1] + len2, color);
					}
				}
			}
		}
		return maxX;
	}
	public toBase64(): string {
		return Buffer.concat(this.canvas).toString('base64');
	}
	public buffer(): Buffer {
		return Buffer.concat(this.canvas);
	}
	public bufferAndTime() {
		return { updated: this.lastUpdate, buffer: this.buffer() };
	}
}
