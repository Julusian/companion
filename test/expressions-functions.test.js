import { describe, it } from 'node:test'
import assert from 'node:assert'
import { ExpressionFunctions } from '../lib/Shared/Expression/ExpressionFunctions.js'

describe('functions', () => {
	it('round', () => {
		assert.strictEqual(ExpressionFunctions.round(9.99), 10)
		assert.strictEqual(ExpressionFunctions.round('9.99'), 10)
		assert.strictEqual(ExpressionFunctions.round(-0), -0)

		assert.strictEqual(ExpressionFunctions.round('test'), NaN)
		assert.strictEqual(ExpressionFunctions.round('true'), NaN)
		assert.strictEqual(ExpressionFunctions.round(undefined), NaN)
		assert.strictEqual(ExpressionFunctions.round(true), 1)
		assert.strictEqual(ExpressionFunctions.round(false), 0)
	})

	it('floor', () => {
		assert.strictEqual(ExpressionFunctions.floor(9.99), 9)
		assert.strictEqual(ExpressionFunctions.floor('9.99'), 9)
		assert.strictEqual(ExpressionFunctions.floor(-0), -0)

		assert.strictEqual(ExpressionFunctions.floor('test'), NaN)
		assert.strictEqual(ExpressionFunctions.floor('true'), NaN)
		assert.strictEqual(ExpressionFunctions.floor(undefined), NaN)
		assert.strictEqual(ExpressionFunctions.floor(true), 1)
		assert.strictEqual(ExpressionFunctions.floor(false), 0)
	})

	it('ceil', () => {
		assert.strictEqual(ExpressionFunctions.ceil(9.99), 10)
		assert.strictEqual(ExpressionFunctions.ceil('9.99'), 10)
		assert.strictEqual(ExpressionFunctions.ceil(-0), -0)

		assert.strictEqual(ExpressionFunctions.ceil('test'), NaN)
		assert.strictEqual(ExpressionFunctions.ceil('true'), NaN)
		assert.strictEqual(ExpressionFunctions.ceil(undefined), NaN)
		assert.strictEqual(ExpressionFunctions.ceil(true), 1)
		assert.strictEqual(ExpressionFunctions.ceil(false), 0)
	})

	it('abs', () => {
		assert.strictEqual(ExpressionFunctions.abs(9.99), 9.99)
		assert.strictEqual(ExpressionFunctions.abs('-9.99'), 9.99)
		assert.strictEqual(ExpressionFunctions.abs(-0), 0)

		assert.strictEqual(ExpressionFunctions.abs('test'), NaN)
		assert.strictEqual(ExpressionFunctions.abs('true'), NaN)
		assert.strictEqual(ExpressionFunctions.abs(undefined), NaN)
		assert.strictEqual(ExpressionFunctions.abs(true), 1)
		assert.strictEqual(ExpressionFunctions.abs(false), 0)
	})

	it('fromRadix', () => {
		assert.strictEqual(ExpressionFunctions.fromRadix('11', 16), 17)
		assert.strictEqual(ExpressionFunctions.fromRadix('11', 2), 3)
		assert.strictEqual(ExpressionFunctions.fromRadix('f', 16), 15)
		assert.strictEqual(ExpressionFunctions.fromRadix('11'), 11)
	})

	it('toRadix', () => {
		assert.strictEqual(ExpressionFunctions.toRadix(11, 16), 'b')
		assert.strictEqual(ExpressionFunctions.toRadix(11, 2), '1011')
		assert.strictEqual(ExpressionFunctions.toRadix(9, 16), '9')
		assert.strictEqual(ExpressionFunctions.toRadix(11), '11')
	})

	it('toFixed', () => {
		assert.strictEqual(ExpressionFunctions.toFixed(Math.PI, 3), '3.142')
		assert.strictEqual(ExpressionFunctions.toFixed(Math.PI, 2), '3.14')
		assert.strictEqual(ExpressionFunctions.toFixed(-Math.PI, 2), '-3.14')
		assert.strictEqual(ExpressionFunctions.toFixed(Math.PI), '3')
		assert.strictEqual(ExpressionFunctions.toFixed(5, 2), '5.00')
		assert.strictEqual(ExpressionFunctions.toFixed(Math.PI, -2), '3')
	})

	it('isNumber', () => {
		assert.strictEqual(ExpressionFunctions.isNumber(11), true)
		assert.strictEqual(ExpressionFunctions.isNumber('99'), true)
		assert.strictEqual(ExpressionFunctions.isNumber('true'), false)
		assert.strictEqual(ExpressionFunctions.isNumber(''), true)
		assert.strictEqual(ExpressionFunctions.isNumber(undefined), false)
	})

	it('timestampToSeconds', () => {
		assert.strictEqual(ExpressionFunctions.timestampToSeconds('00:00:11'), 11)
		assert.strictEqual(ExpressionFunctions.timestampToSeconds('00:16:39'), 999)
		assert.strictEqual(ExpressionFunctions.timestampToSeconds('02:46:39'), 9999)
		assert.strictEqual(ExpressionFunctions.timestampToSeconds('342:56:07'), 1234567)

		assert.strictEqual(ExpressionFunctions.timestampToSeconds('00:00_11'), 0)
		assert.strictEqual(ExpressionFunctions.timestampToSeconds(false), 0)
		assert.strictEqual(ExpressionFunctions.timestampToSeconds(99), 0)
	})

	it('trim', () => {
		assert.strictEqual(ExpressionFunctions.trim(11), '11')
		assert.strictEqual(ExpressionFunctions.trim('  99  '), '99')
		assert.strictEqual(ExpressionFunctions.trim('\t aa \n'), 'aa')
		assert.strictEqual(ExpressionFunctions.trim(''), '')
		assert.strictEqual(ExpressionFunctions.trim(undefined), 'undefined')
		assert.strictEqual(ExpressionFunctions.trim(false), 'false')
		assert.strictEqual(ExpressionFunctions.trim(true), 'true')
	})

	it('strlen', () => {
		assert.strictEqual(ExpressionFunctions.strlen(11), 2)
		assert.strictEqual(ExpressionFunctions.strlen('  99  '), 6)
		assert.strictEqual(ExpressionFunctions.strlen('\t aa \n'), 6)
		assert.strictEqual(ExpressionFunctions.strlen(''), 0)
		assert.strictEqual(ExpressionFunctions.strlen(undefined), 9)
		assert.strictEqual(ExpressionFunctions.strlen(false), 5)
		assert.strictEqual(ExpressionFunctions.strlen(true), 4)
	})

	it('substr', () => {
		assert.strictEqual(ExpressionFunctions.substr('abcdef', 2), 'cdef')
		assert.strictEqual(ExpressionFunctions.substr('abcdef', -2), 'ef')
		assert.strictEqual(ExpressionFunctions.substr('abcdef', 2, 4), 'cd')
		assert.strictEqual(ExpressionFunctions.substr('abcdef', 2, -2), 'cd')
		assert.strictEqual(ExpressionFunctions.substr('abcdef', -4, -2), 'cd')
		assert.strictEqual(ExpressionFunctions.substr('abcdef', 0, 0), '')

		assert.strictEqual(ExpressionFunctions.substr(11), '11')
		assert.strictEqual(ExpressionFunctions.substr('', 0, 1), '')
		assert.strictEqual(ExpressionFunctions.substr(undefined), 'undefined')
		assert.strictEqual(ExpressionFunctions.substr(false), 'false')
		assert.strictEqual(ExpressionFunctions.substr(true), 'true')
	})

	it('bool', () => {
		assert.strictEqual(ExpressionFunctions.bool(11), true)
		assert.strictEqual(ExpressionFunctions.bool('99'), true)
		assert.strictEqual(ExpressionFunctions.bool(0), false)
		assert.strictEqual(ExpressionFunctions.bool('0'), false)
		assert.strictEqual(ExpressionFunctions.bool(true), true)
		assert.strictEqual(ExpressionFunctions.bool('true'), true)
		assert.strictEqual(ExpressionFunctions.bool(false), false)
		assert.strictEqual(ExpressionFunctions.bool('false'), false)
		assert.strictEqual(ExpressionFunctions.bool(''), false)
		assert.strictEqual(ExpressionFunctions.bool(undefined), false)
	})

	it('secondsToTimestamp', () => {
		assert.strictEqual(ExpressionFunctions.secondsToTimestamp(11), '00:00:11')
		assert.strictEqual(ExpressionFunctions.secondsToTimestamp(999), '00:16:39')
		assert.strictEqual(ExpressionFunctions.secondsToTimestamp(9999), '02:46:39')
		assert.strictEqual(ExpressionFunctions.secondsToTimestamp(1234567), '342:56:07')

		assert.strictEqual(ExpressionFunctions.secondsToTimestamp('99'), '00:01:39')
		assert.strictEqual(ExpressionFunctions.secondsToTimestamp(false), '00:00:00')
		assert.strictEqual(ExpressionFunctions.secondsToTimestamp(-11), '00:00:00')
	})
})
