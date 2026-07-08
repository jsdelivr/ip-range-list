import { assert } from 'chai';
import { describe, it } from 'mocha';
import { IPRangeList } from '../../../src/index.js';
import { expectRangeError, expectTypeError, maxIPv6, snapshot } from '../../utils/shared.js';

describe('IPRangeList addSubnet', () => {
	it('should normalize host bits and preserve IPv4-mapped equivalence', () => {
		const ranges = new IPRangeList().addSubnet('192.0.2.9/24');

		assert.equal(ranges.contains('192.0.2.0'), true);
		assert.equal(ranges.contains('192.0.2.255'), true);
		assert.equal(ranges.check('::ffff:192.0.2.42'), true);
		assert.equal(ranges.contains('192.0.1.255'), false);
		assert.equal(ranges.contains('192.0.3.0'), false);

		assert.deepEqual(snapshot(ranges.ranges), [{
			start: '::ffff:192.0.2.0',
			end: '::ffff:192.0.2.255',
		}]);
	});

	it('should treat IPv4-mapped subnets as IPv4 CIDRs', () => {
		const ranges = new IPRangeList().addSubnet('::ffff:192.0.2.9/24');

		assert.equal(ranges.contains('192.0.2.0'), true);
		assert.equal(ranges.contains('192.0.2.255'), true);
		assert.equal(ranges.contains('::ffff:192.0.2.42'), true);
		assert.equal(ranges.contains('192.0.1.255'), false);
		assert.equal(ranges.contains('192.0.3.0'), false);

		assert.deepEqual(snapshot(ranges.ranges), [{
			start: '::ffff:192.0.2.0',
			end: '::ffff:192.0.2.255',
		}]);
	});

	it('should handle /0 and host CIDRs', () => {
		const allIPv4 = new IPRangeList().addSubnet('0.0.0.0/0');
		const allIPv6 = new IPRangeList().addSubnet('::/0');
		const hosts = new IPRangeList()
			.addSubnet('203.0.113.8/32')
			.addSubnet('2001:db8::1/128');

		assert.equal(allIPv4.contains('0.0.0.0'), true);
		assert.equal(allIPv4.contains('255.255.255.255'), true);
		assert.equal(allIPv4.contains('::fffe:ffff:ffff'), false);
		assert.equal(allIPv4.contains('::1:0:0:0'), false);
		assert.equal(allIPv6.contains('0.0.0.0'), true);
		assert.equal(allIPv6.contains(maxIPv6), true);
		assert.equal(hosts.contains('203.0.113.8'), true);
		assert.equal(hosts.contains('203.0.113.9'), false);
		assert.equal(hosts.contains('2001:db8::1'), true);
		assert.equal(hosts.contains('2001:db8::2'), false);
	});

	it('should handle non-aligned CIDR prefixes', () => {
		const ranges = new IPRangeList()
			.addSubnet('10.0.0.0/27')
			.addSubnet('8592:757c:efaf::/51');

		for (let host = 0; host <= 31; host++) {
			assert.equal(ranges.contains(`10.0.0.${host}`), true, `10.0.0.${host}`);
		}

		assert.equal(ranges.contains('10.0.0.32'), false);
		assert.equal(ranges.contains('8592:757c:efaf::'), true);
		assert.equal(ranges.contains('8592:757c:efaf:1fff:ffff:ffff:ffff:ffff'), true);
		assert.equal(ranges.contains('8592:757c:efaf:2000::'), false);
	});

	it('should reject malformed subnet values', () => {
		const ranges = new IPRangeList();

		for (const value of [ '192.0.2.1', '192.0.2.1/', '/24', '192.0.2.1/1/2', '192.0.2.1/-1', '192.0.2.1/1.5', '192.0.2.1/ 24', 'bad/24' ]) {
			expectTypeError(() => ranges.addSubnet(value));
		}
	});

	it('should reject out-of-range CIDR prefixes', () => {
		const ranges = new IPRangeList();

		expectRangeError(() => ranges.addSubnet('192.0.2.1/33'));
		expectRangeError(() => ranges.addSubnet('::ffff:192.0.2.1/33'));
		expectRangeError(() => ranges.addSubnet('2001:db8::1/129'));
		expectRangeError(() => ranges.addSubnet('bad/999'));
	});
});
