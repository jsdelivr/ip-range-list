import { assert } from 'chai';
import { describe, it } from 'mocha';
import { IPRangeList } from '../../../src/index.js';

describe('IPRangeList check', () => {
	it('should alias contains', () => {
		const ranges = new IPRangeList().addSubnet('192.0.2.9/24');

		assert.equal(ranges.check('192.0.2.42'), ranges.contains('192.0.2.42'));
		assert.equal(ranges.check('192.0.3.0'), ranges.contains('192.0.3.0'));
		assert.equal(ranges.check('not an address'), ranges.contains('not an address'));
	});
});
