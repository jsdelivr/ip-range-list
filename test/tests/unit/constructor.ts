import { assert } from 'chai';
import { describe, it } from 'mocha';
import { IPRangeList } from '../../../src/index.js';
import { snapshot } from '../../utils/shared.js';

describe('IPRangeList constructor', () => {
	it('should export a usable constructor and start empty', () => {
		const ranges = new IPRangeList();

		assert.equal(typeof IPRangeList, 'function');
		assert.equal(ranges.contains('192.0.2.1'), false);
		assert.equal(ranges.check('not an address'), false);
		assert.deepEqual(snapshot(ranges.ranges), []);
	});
});
