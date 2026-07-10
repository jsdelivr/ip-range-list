import { assert } from 'chai';
import { describe, it } from 'mocha';
import { IPRangeList } from '../../../src/index.js';
import { expectRangeError, expectTypeError, snapshot } from '../../utils/shared.js';

describe('IPRangeList addRange', () => {
	it('should add an inclusive range', () => {
		const ranges = new IPRangeList();

		assert.strictEqual(ranges.addRange('192.0.2.2', '192.0.2.3'), ranges);
		assert.equal(ranges.contains('192.0.2.1'), false);
		assert.equal(ranges.contains('192.0.2.2'), true);
		assert.equal(ranges.contains('192.0.2.3'), true);
		assert.equal(ranges.contains('192.0.2.4'), false);
	});

	it('should add an inclusive IPv6 range', () => {
		const ranges = new IPRangeList().addRange('::1', '::f');

		assert.equal(ranges.contains('::'), false);

		for (let address = 1; address <= 0xf; address++) {
			const candidate = `::${address.toString(16)}`;

			assert.equal(ranges.contains(candidate), true, candidate);
		}

		assert.equal(ranges.contains('::10'), false);
	});

	it('should match IPv4-mapped IPv6 addresses against IPv4 ranges', () => {
		const ranges = new IPRangeList().addRange('10.0.0.2', '10.0.0.10');

		assert.equal(ranges.contains('10.0.0.2'), true);
		assert.equal(ranges.contains('10.0.0.10'), true);
		assert.equal(ranges.contains('192.168.0.3'), false);
		assert.equal(ranges.contains('2.2.2.2'), false);
		assert.equal(ranges.contains('255.255.255.255'), false);
		assert.equal(ranges.contains('::ffff:0a00:0002'), true);
		assert.equal(ranges.contains('::ffff:0a00:000a'), true);
		assert.equal(ranges.contains('::ffff:c0a8:0003'), false);
		assert.equal(ranges.contains('::ffff:0202:0202'), false);
		assert.equal(ranges.contains('::ffff:ffff:ffff'), false);
	});

	it('should merge unsorted, duplicate, nested, overlapping, and adjacent ranges', () => {
		const ranges = new IPRangeList()
			.addRange('198.51.100.30', '198.51.100.40')
			.addRange('198.51.100.10', '198.51.100.20')
			.addRange('198.51.100.21', '198.51.100.29')
			.addRange('198.51.100.15', '198.51.100.35')
			.addAddress('198.51.100.40')
			.addRange('198.51.100.0', '198.51.100.9');

		assert.deepEqual(snapshot(ranges.ranges), [{
			start: '::ffff:198.51.100.0',
			end: '::ffff:198.51.100.40',
		}]);

		assert.equal(ranges.contains('198.51.100.0'), true);
		assert.equal(ranges.contains('198.51.100.40'), true);
		assert.equal(ranges.contains('198.51.100.41'), false);
	});

	it('should reject reversed ranges', () => {
		const ranges = new IPRangeList();

		expectRangeError(() => ranges.addRange('192.0.2.2', '192.0.2.1'));
	});

	it('should reject ranges with mixed IP families', () => {
		const ranges = new IPRangeList();

		assert.strictEqual(ranges.addRange('192.0.2.1', '::ffff:192.0.2.2'), ranges);
		expectRangeError(() => ranges.addRange('192.0.2.1', '2001:db8::1'));
		expectRangeError(() => ranges.addRange('2001:db8::1', '192.0.2.1'));
	});

	it('should reject malformed range bounds', () => {
		const ranges = new IPRangeList();

		expectTypeError(() => ranges.addRange('192.0.2.1', 'not an address'));
		expectTypeError(() => (ranges.addRange as (start: unknown, end: unknown) => unknown)(null, '192.0.2.1'));
	});
});
