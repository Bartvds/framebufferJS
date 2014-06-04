/// <reference path="../../typings/tsd.d.ts" />

'use strict';

import IShader = require('../types/IShader');
import IRGB = require('../types/IRGB');
import RGBA = require('./RGBA');

import Font = require('./Font');
import Char = require('./Char');
import font = require('../font/micro');
import color = require('./color');

import util = require('./util');
import rand = util.rand;
import clamp = util.clamp;

var alpha = new RGBA(0, 0, 0, 0);
var black = new RGBA(0, 0, 0);
var magenta = new RGBA(255, 0, 255);

// TODO split to alpha and non-alpha version

// TODO profile element access
// TODO profile loop order
// TODO profile fast-mode

class Bitmap {

	public width: number;
	public height: number;
	public useAlpha: boolean;
	public channels: number;
	public buffer: ArrayBuffer;
	public data: Uint8ClampedArray;

	constructor(width: number, height: number, useAlpha: boolean = true) {
		this.width = width;
		this.height = height;
		this.channels = (useAlpha ? 4 : 3);
		this._resetData();
	}

	private _resetData(): void {
		// keep reference to raw buffer for aliasing as Uint8Array
		this.buffer = new ArrayBuffer(this.width * this.height * this.channels);

		// work on a clamped array for safety
		this.data = new Uint8ClampedArray(this.buffer);
	}

	resizeTo(width: number, height: number): void {
		if (width === this.width && height === this.height) {
			return;
		}
		this.width = width;
		this.height = height;
		this._resetData();
	}

	setPixel(x: number, y: number, col: IRGB): void {
		x = Math.floor(x);
		y = Math.floor(y);

		if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
			return;
		}
		var p = (x + y * this.width) * this.channels;
		this.data[p] = col.r;
		this.data[p + 1] = col.g;
		this.data[p + 2] = col.b;
	}

	getPixel(x: number, y: number, col?: IRGB): IRGB {
		x = Math.floor(x);
		y = Math.floor(y);

		if (x < 0 || y < 0 || x >= this.width || y >= this.height) {
			return null;
		}
		col = (col || new RGBA());

		var p = (x + y * this.width) * this.channels;
		col.r = this.data[p];
		col.g = this.data[p + 1];
		col.b = this.data[p + 2];
		return col;
	}

	fillRect(x: number, y: number, w: number, h: number, col: IRGB): void {
		x = Math.floor(x);
		y = Math.floor(y);
		w = Math.floor(w);
		h = Math.floor(h);

		for (var iy = y; iy < y + h; iy++) {
			for (var ix = x; ix < x + w; ix++) {
				// TODO move this outside the loop
				if (ix < 0 || iy < 0 || ix >= this.width || iy >= this.height) {
					continue;
				}
				var p = (ix + iy * this.width) * this.channels;
				this.data[p] = col.r;
				this.data[p + 1] = col.g;
				this.data[p + 2] = col.b;
			}
		}
	}

	drawLineH(x: number, y: number, size: number, col: IRGB): void {
		var right = clamp(Math.floor(x + size), 0, this.width);
		x = clamp(Math.floor(x), 0, this.width);
		y = clamp(Math.floor(y), 0, this.height);

		for (; x < right; x++) {
			var p = (x + y * this.width) * this.channels;
			this.data[p] = col.r;
			this.data[p + 1] = col.g;
			this.data[p + 2] = col.b;
		}
	}

	drawLineV(x: number, y: number, size: number, col: IRGB): void {
		var bottom = clamp(Math.floor(y + size), 0, this.height);
		x = clamp(Math.floor(x), 0, this.width);
		y = clamp(Math.floor(y), 0, this.height);

		for (; y < bottom; y++) {
			var p = (x + y * this.width) * this.channels;
			this.data[p] = col.r;
			this.data[p + 1] = col.g;
			this.data[p + 2] = col.b;
		}
	}

	drawRect(x: number, y: number, width: number, height: number, col: IRGB): void {
		x = Math.floor(x);
		y = Math.floor(y);
		width = Math.floor(width);
		height = Math.floor(height);

		this.drawLineH(x, y, width, col);
		this.drawLineH(x, y + height - 1, width, col);
		this.drawLineV(x, y, height, col);
		this.drawLineV(x + width - 1, y, height, col);
	}

	fillCircle(x: number, y: number, r: number, col: IRGB): void {
		x = Math.floor(x);
		y = Math.floor(y);
		r = Math.floor(r);
		for (var iy = -r; iy <= r; iy++) {
			for (var ix = -r; ix <= r; ix++) {
				if (x + ix < 0 || y + iy < 0 || x + ix >= this.width || y + iy >= this.height) {
					continue;
				}
				if (ix * ix + iy * iy <= r * r) {
					var p = (x + ix + (y + iy) * this.width) * this.channels;
					this.data[p] = col.r;
					this.data[p + 1] = col.g;
					this.data[p + 2] = col.b;
				}
			}
		}
	}

	drawCircle(x: number, y: number, r: number, col: IRGB): void {
		x = Math.floor(x);
		y = Math.floor(y);
		r = Math.floor(r);
		for (var i = 0; i < 360; i++) {
			var cx = Math.round(Math.cos(i * (Math.PI / 180)) * r) + x;
			var cy = Math.round(Math.sin(i * (Math.PI / 180)) * r) + y;

			if (cx < 0 || cy < 0 || cx >= this.width || cy >= this.height) {
				continue;
			}
			var p = (cx + cy * this.width) * this.channels;
			this.data[p] = col.r;
			this.data[p + 1] = col.g;
			this.data[p + 2] = col.b;
		}
	}

	shader(f: IShader): void {
		var rgb = new RGBA();
		for (var iy = 0; iy < this.height; iy++) {
			for (var ix = 0; ix < this.width; ix++) {
				var p = (ix + iy * this.width) * this.channels;
				rgb.r = this.data[p];
				rgb.g = this.data[p + 1];
				rgb.b = this.data[p + 2];

				var col = f(ix, iy, rgb);

				this.data[p] = col.r;
				this.data[p + 1] = col.g;
				this.data[p + 2] = col.b;
			}
		}
	}

	text(x: number, y: number, txt: string, col: IRGB): void {
		txt = String(txt);
		for (var i = 0; i < txt.length; i++) {
			x += this.drawChar(x, y, txt.charAt(i), col) + 1;
		}
	}

	private drawChar(x: number, y: number, chr: string, col: IRGB): number {
		var char: Char = font.chars[chr.toUpperCase()];
		if (!char) {
			return 0;
		}
		for (var iy = 0; iy < font.height; iy++) {
			for (var ix = 0; ix < char.width; ix++) {
				if (char.map[iy * char.width + ix]) {
					this.setPixel(x + ix, y + iy, col);
				}
			}
		}
		return char.width;
	}

	blit(sprite: Bitmap, x: number, y: number, w?: number, h?: number, sx?: number, sy?: number): void {
		x = Math.floor(x);
		y = Math.floor(y);
		w = (!w ? sprite.width : Math.floor(w));
		h = (!h ? sprite.height : Math.floor(h));
		sx = (!sx ? 0 : Math.floor(sx));
		sy = (!sy ? 0 : Math.floor(sy));

		for (var iy = sy; iy < sy + h; iy++) {
			for (var ix = sx; ix < sx + w; ix++) {
				if (ix < 0 || iy < 0 || ix >= sprite.width || iy >= sprite.height) {
					continue;
				}
				// TODO support alpha in sprite
				var read = (ix + iy * sprite.width) * sprite.channels;
				var write = (x + ix - sx + (y + iy - sy) * this.width) * this.channels;

				this.data[write] = sprite.data[read];
				this.data[write + 1] = sprite.data[read + 1];
				this.data[write + 2] = sprite.data[read + 2];
			}
		}
	}

	clear(color?: IRGB): void {
		color = color || black;
		var lim: number, i: number;
		if (this.useAlpha) {
			lim = this.width * this.height * 4;
			for (i = 0; i < lim; i += 4) {
				this.data[i] = color.r;
				this.data[i + 1] = color.g;
				this.data[i + 2] = color.b;
				this.data[i + 3] = 255;
			}
		} else {
			lim = this.width * this.height * 3;
			for (i = 0; i < lim; i += 3) {
				this.data[i] = color.r;
				this.data[i + 1] = color.g;
				this.data[i + 2] = color.b;
			}
		}
	}

	clearDisco(): void {
		var lim: number, i: number;
		if (this.useAlpha) {
			lim = this.width * this.height * 4;
			for (i = 0; i < lim; i += 4) {
				this.data[i] = rand(256);
				this.data[i + 1] = rand(256);
				this.data[i + 2] = rand(256);
				this.data[i + 3] = 255;
			}
		} else {
			lim = this.width * this.height * 3;
			for (i = 0; i < lim; i += 3) {
				this.data[i] = rand(256);
				this.data[i + 1] = rand(256);
				this.data[i + 2] = rand(256);
			}
		}
	}

	clearAlpha(alpha: number = 0): void {
		if (!this.useAlpha) {
			return;
		}
		var lim: number = this.width * this.height * 4;
		for (var i = 3; i < lim; i += 4) {
			this.data[i] = alpha;
		}
	}
}

export = Bitmap;