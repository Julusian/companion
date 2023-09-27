import { describe, test } from 'node:test'
import assert from 'node:assert'
import { parseVariablesInString } from '../lib/Instance/Variable.js'

describe('variable parsing', () => {
	test('undefined string', () => {
		assert.deepEqual(parseVariablesInString(undefined, {}), { text: undefined, variableIds: [] })
	})

	test('empty string', () => {
		assert.deepEqual(parseVariablesInString('', {}), { text: '', variableIds: [] })
	})

	test('simple unknown variable', () => {
		assert.deepEqual(parseVariablesInString('$(abc:def)', {}), { text: '$NA', variableIds: ['abc:def'] })
	})
	test('malformed variable', () => {
		assert.deepEqual(parseVariablesInString('$(abc)', {}), { text: '$(abc)', variableIds: [] })
		assert.deepEqual(parseVariablesInString('$(abc:f', {}), { text: '$(abc:f', variableIds: [] })
		assert.deepEqual(parseVariablesInString('$(abc:)', {}), { text: '$(abc:)', variableIds: [] })
		assert.deepEqual(parseVariablesInString('$(:abc)', {}), { text: '$(:abc)', variableIds: [] })
	})

	test('unknown variable', () => {
		const variables = {
			abc: {
				def: 'val1',
			},
		}
		assert.deepEqual(parseVariablesInString('$(abc:def2) $(abc2:def)', variables), {
			text: '$NA $NA',
			variableIds: ['abc:def2', 'abc2:def'],
		})
		assert.deepEqual(parseVariablesInString('$(abc2:def)', variables), { text: '$NA', variableIds: ['abc2:def'] })
	})

	test('basic variable', () => {
		const variables = {
			abc: {
				def: 'val1',
				v2: 'val2',
				3: 'val3',
			},
			another: {
				str: 'vvvv',
			},
		}
		assert.deepEqual(parseVariablesInString('$(abc:def)', variables), { text: 'val1', variableIds: ['abc:def'] })
		assert.deepEqual(parseVariablesInString('$(abc:def) $(abc:v2) $(another:str) $(abc:3)', variables), {
			text: 'val1 val2 vvvv val3',
			variableIds: ['abc:def', 'abc:v2', 'another:str', 'abc:3'],
		})
	})

	test('simple inter variable references', () => {
		const variables = {
			abc: {
				def: 'val1',
				v2: 'val2',
				3: 'val3',
			},
			another: {
				str: '$(abc:def) $(abc:3)',
				str2: '$(abc:v2)',
			},
		}
		assert.deepEqual(parseVariablesInString('$(another:str) $(abc:v2) $(another:str2)', variables), {
			text: 'val1 val3 val2 val2',
			variableIds: ['another:str', 'abc:def', 'abc:3', 'abc:v2', 'another:str2', 'abc:v2'],
		})
	})

	test('self referencing variable', () => {
		const variables = {
			abc: {
				def: '$(abc:def) + 1',
			},
		}
		assert.deepEqual(parseVariablesInString('$(abc:def)', variables), {
			text: '$RE + 1',
			variableIds: ['abc:def', 'abc:def'],
		})
	})

	test('infinite referencing variable', () => {
		const variables = {
			abc: {
				def: '$(abc:second)_1',
				second: '$(abc:def)_2',
			},
		}
		assert.deepEqual(parseVariablesInString('$(abc:def)', variables), {
			text: '$RE_2_1',
			variableIds: ['abc:def', 'abc:second', 'abc:def'],
		})
		assert.deepEqual(parseVariablesInString('$(abc:second)', variables), {
			text: '$RE_1_2',
			variableIds: ['abc:second', 'abc:def', 'abc:second'],
		})
	})

	test('variable name from variable name', () => {
		const variables = {
			abc: {
				def: 'second',
				second: 'val2',
				third: 'nope',
			},
		}
		assert.deepEqual(parseVariablesInString('$(abc:def)', variables), {
			text: 'second',
			variableIds: ['abc:def'],
		})
		assert.deepEqual(parseVariablesInString('$(abc:$(abc:def))', variables), {
			text: 'val2',
			variableIds: ['abc:def', 'abc:second'],
		})
		assert.deepEqual(parseVariablesInString('$(abc:$(abc:third))', variables), {
			text: '$NA',
			variableIds: ['abc:third', 'abc:nope'],
		})
	})
})
