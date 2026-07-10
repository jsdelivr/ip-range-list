import { assert } from 'chai';
import { describe, it } from 'mocha';
import { IPRangeList } from '../../../src/index.js';
import { expectTypeError, invalidAddresses, maxIPv6, snapshot } from '../../utils/shared.js';

describe('IPRangeList addAddress', () => {
	it('should add a single address', () => {
		const ranges = new IPRangeList();

		assert.strictEqual(ranges.addAddress('192.0.2.1'), ranges);
		assert.equal(ranges.contains('192.0.2.1'), true);
		assert.equal(ranges.contains('192.0.2.2'), false);

		assert.deepEqual(snapshot(ranges.ranges), [{
			start: '::ffff:192.0.2.1',
			end: '::ffff:192.0.2.1',
		}]);
	});

	it('should add supported address extrema', () => {
		const ranges = new IPRangeList()
			.addAddress('0.0.0.0')
			.addAddress('255.255.255.255')
			.addAddress('::')
			.addAddress(maxIPv6);

		assert.equal(ranges.contains('0.0.0.0'), true);
		assert.equal(ranges.contains('255.255.255.255'), true);
		assert.equal(ranges.contains('::'), true);
		assert.equal(ranges.contains(maxIPv6), true);
	});

	it('should accept IPv6 literals with embedded IPv4 tails', () => {
		const ranges = new IPRangeList()
			.addAddress('::192.0.2.1')
			.addAddress('2001:db8::192.0.2.1');

		assert.equal(ranges.contains('::192.0.2.1'), true);
		assert.equal(ranges.contains('::c000:201'), true);
		assert.equal(ranges.contains('2001:db8::192.0.2.1'), true);
		assert.equal(ranges.contains('2001:db8::c000:201'), true);
		assert.equal(ranges.contains('::ffff:192.0.2.1'), false);

		assert.deepEqual(snapshot(ranges.ranges), [
			{ start: '::c000:201', end: '::c000:201' },
			{ start: '2001:db8::c000:201', end: '2001:db8::c000:201' },
		]);
	});

	it('should reject malformed addresses', () => {
		const ranges = new IPRangeList();

		for (const value of invalidAddresses) {
			expectTypeError(() => (ranges.addAddress as (address: unknown) => unknown)(value));
		}
	});
});
