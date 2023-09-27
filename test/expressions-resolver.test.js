import { describe, it } from 'node:test'
import assert from 'node:assert'
import { ParseExpression as parse } from '../lib/Shared/Expression/ExpressionParse.js'
import { ResolveExpression as resolve } from '../lib/Shared/Expression/ExpressionResolve.js'
import jsep from 'jsep'

describe('resolver', function () {
	describe('ensure each binary operator is implemented', function () {
		for (const op of Object.keys(jsep.binary_ops)) {
			if (op) {
				it(`should handle "${op}" operator`, function () {
					const result = resolve(parse(`1 ${op} 2`))
					assert.match(typeof result, /^number|boolean$/)
				})
			}
		}
	})

	describe('ensure each unary operator is implemented', function () {
		for (const op of Object.keys(jsep.unary_ops)) {
			if (op) {
				it(`should handle "${op}" operator`, function () {
					const result = resolve(parse(`${op}2`))
					assert.match(typeof result, /^number|boolean$/)
				})
			}
		}
	})

	describe('expressions with literal operand', function () {
		it('should handle addition', function () {
			const result = resolve(parse('1 + 2'))
			assert.strictEqual(result, 3)
		})

		it('should handle addition', function () {
			const result = resolve(parse('3 - 4'))
			assert.strictEqual(result, -1)
		})

		it('should handle multiplication', function () {
			const result = resolve(parse('5 * 6'))
			assert.strictEqual(result, 30)
		})

		it('should handle division', function () {
			const result = resolve(parse('7 / 8'))
			assert.strictEqual(result, 0.875)
		})

		// it('should handle exponentiation', function () {
		// 	const result = resolve(parse('2 ^ 8'))
		// 	assert.strictEqual(result,256)
		// })

		it('should handle unary negation', function () {
			const result = resolve(parse('-1 + -2'))
			assert.strictEqual(result, -3)
		})

		it('should handle consecutive unary negation', function () {
			const result = resolve(parse('--1 + 1'))
			assert.strictEqual(result, 2)
		})

		it('should handle consecutive unary negation with parenthesis', function () {
			const result = resolve(parse('-(-1) + 1'))
			assert.strictEqual(result, 2)
		})

		it('should handle negation of expression within parenthesis', function () {
			const result = resolve(parse('-(-1 + -1)'))
			assert.strictEqual(result, 2)
		})

		it('should handle multiple operators', function () {
			const result = resolve(parse('((2 + 2) * 3 / 4) ^ 3 % 2'))
			assert.strictEqual(result, 2)
		})

		it('should handle floating point literals', function () {
			const result = resolve(parse('1.234 * 2'))
			assert.strictEqual(result, 2.468)
		})

		it('should handle division by zero', function () {
			const result = resolve(parse('1 / 0'))
			assert.strictEqual(result, Infinity)
		})
	})

	describe('expressions with symbol/variable operands', function () {
		it('should handle symbol and literal operands', function () {
			const postfix = parse('$(internal:a) + 1')
			const getVariable = (id) => {
				switch (id) {
					case 'internal:a':
						return 2
				}
			}
			assert.strictEqual(resolve(postfix, getVariable), 3)
		})

		it('should handle multiple symbol operands', function () {
			const postfix = parse('$(internal:a) + $(test:c)')
			const getVariable = (id) => {
				switch (id) {
					case 'internal:a':
						return '3'
					case 'test:c':
						return '1'
				}
			}
			assert.strictEqual(resolve(postfix, getVariable), 4)
		})

		it('handle string variables', function () {
			const postfix = parse('$(internal:a) ^ 2 + 2 * $(internal:b) + $(test:c)')
			const getVariable = (id) => {
				switch (id) {
					case 'internal:a':
						return 3
					case 'internal:b':
						return 2
					case 'test:c':
						return 1
				}
			}
			assert.strictEqual(resolve(postfix, getVariable), 4)
		})

		it('should handle duplicate symbol operands', function () {
			const postfix = parse('$(internal:a) / $(internal:a)')
			const getVariable = (id) => {
				switch (id) {
					case 'internal:a':
						return 10
				}
			}
			assert.strictEqual(resolve(postfix, getVariable), 1)
		})
	})

	describe('expressions with errors', function () {
		it('should detect missing symbol values', function () {
			const getVariable = () => undefined
			const fn = () => resolve(parse('$(internal:a) + 1'), getVariable)
			assert.throws(fn, /Missing variable value/)
		})

		it('should detect missing operands', function () {
			const fn = () => resolve(parse('1 +'))
			assert.throws(fn, /Expected expression after/)
		})

		it('should detect extraneous operands', function () {
			const fn = () => resolve(parse('10 + 10 20 30'))
			assert.throws(fn, /Unknown node "Compound"/)
		})
	})

	describe('functions', function () {
		it('should parse and execute provided functions', function () {
			const result = resolve(parse('round(10.1)'), {}, { round: (v) => Math.round(v) })
			assert.strictEqual(result, 10)
		})

		it('should fail on an unknown function', function () {
			const fn = () => resolve(parse('round2(10.1)'), {}, { round: (v) => Math.round(v) })
			assert.throws(fn, /Unsupported function "round2"/)
		})

		it('should handle multiple function arguments', function () {
			const result = resolve(
				parse('round(10.1111) + round(10.1111, 0.1)'),
				{},
				{ round: (v, accuracy = 1) => Math.round(v / accuracy) * accuracy }
			)
			assert.strictEqual(result, 20.1)
		})
	})

	describe('ternaries', function () {
		it('should parse and execute ternary', function () {
			const result = resolve(parse('(1 > 2) ? 3 : 4'))
			assert.strictEqual(result, 4)
		})
	})

	describe('templates', function () {
		it('handle template', () => {
			const result = resolve(parse('`val: ${1 + 2}dB`'))
			assert.strictEqual(result, 'val: 3dB')
		})

		it('handle template at start', () => {
			const result = resolve(parse('`${1 + 2}dB`'))
			assert.strictEqual(result, '3dB')
		})

		it('handle template at end', () => {
			const result = resolve(parse('`val: ${1 + 2}`'))
			assert.strictEqual(result, 'val: 3')
		})

		it('handle complex templates', () => {
			const getVariable = (id) => {
				switch (id) {
					case 'some:var':
						return 'var1'
					case 'another:var':
						return 99
				}
			}
			const result = resolve(parse('`val: ${1 + 2}dB or ${$(some:var)} and ${$(another:var)}`'), getVariable)
			assert.strictEqual(result, 'val: 3dB or var1 and 99')
		})
	})
})
