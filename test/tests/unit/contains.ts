import { assert } from 'chai';
import { describe, it } from 'mocha';
import { IPRangeList } from '../../../src/index.js';
import { cidrCases, cidrs, containsReference, createSeededRandom, invalidAddresses } from '../../utils/shared.js';

describe('IPRangeList contains', () => {
	it('should find addresses across merged intervals', () => {
		const ranges = new IPRangeList();

		for (const cidr of cidrs) {
			ranges.addSubnet(cidr);
		}

		assert.deepEqual(cidrs, cidrCases.map(({ cidr }) => cidr));

		for (const { lower, upper } of cidrCases) {
			assert.equal(ranges.contains(lower), true);
			assert.equal(ranges.contains(upper), true);
		}

		assert.equal(ranges.contains('0.0.0.0'), false);
		assert.equal(ranges.contains('11.0.0.0'), false);
		assert.equal(ranges.contains('192.0.2.120'), false);
		assert.equal(ranges.contains('2001:db7::1'), false);
	});

	it('should check every CIDR case at both boundaries and immediately outside', () => {
		for (const { cidr, lower, upper, before, after } of cidrCases) {
			const ranges = new IPRangeList().addSubnet(cidr);

			assert.equal(ranges.contains(lower), true, `${cidr} lower boundary`);
			assert.equal(ranges.contains(upper), true, `${cidr} upper boundary`);
			assert.equal(ranges.contains(before), false, `${cidr} address before range`);
			assert.equal(ranges.contains(after), false, `${cidr} address after range`);
		}
	});

	it('should return false for malformed lookup candidates', () => {
		const ranges = new IPRangeList().addAddress('192.0.2.1');

		for (const value of invalidAddresses) {
			assert.equal((ranges.contains as (address: unknown) => boolean)(value), false, String(value));
			assert.equal((ranges.check as (address: unknown) => boolean)(value), false, String(value));
		}
	});

	it('should agree with a seeded linear reference across many intervals', () => {
		const separated = new IPRangeList();

		for (let index = 0; index < 32; index++) {
			separated.addAddress(`198.18.0.${index * 4}`);
		}

		assert.equal(separated.contains('198.18.0.0'), true);
		assert.equal(separated.contains('198.18.0.64'), true);
		assert.equal(separated.contains('198.18.0.124'), true);
		assert.equal(separated.contains('198.18.0.63'), false);
		assert.equal(separated.contains('198.18.0.125'), false);

		const random = createSeededRandom(123_456_789);
		const intervals: Array<readonly [ number, number ]> = [];
		const generated = new IPRangeList();

		for (let index = 0; index < 40; index++) {
			const start = Math.floor(random() * 240);
			const length = Math.floor(random() * 8);
			const end = Math.min(255, start + length);

			intervals.push([ start, end ]);
			generated.addRange(`203.0.113.${start}`, `203.0.113.${end}`);
		}

		for (let candidate = 0; candidate < 256; candidate++) {
			assert.equal(generated.contains(`203.0.113.${candidate}`), containsReference(intervals, candidate));
		}
	});
});
