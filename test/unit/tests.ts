import assert from 'node:assert/strict';
import { describe, it } from 'mocha';
import { IPRangeList } from '../../src/index.js';

type RangeSnapshot = { start: string; end: string }[];

const MAX_INT_32 = 2_147_483_647;

interface FixtureCase {
	cidr: string;
	lower: string;
	upper: string;
	before: string;
	after: string;
}

const cidrCases: readonly FixtureCase[] = [
	{
		cidr: '0.0.0.1/32',
		lower: '0.0.0.1',
		upper: '0.0.0.1',
		before: '0.0.0.0',
		after: '0.0.0.2',
	},
	{
		cidr: '0.0.128.0/17',
		lower: '0.0.128.0',
		upper: '0.0.255.255',
		before: '0.0.127.255',
		after: '0.1.0.0',
	},
	{
		cidr: '10.0.0.0/8',
		lower: '10.0.0.0',
		upper: '10.255.255.255',
		before: '9.255.255.255',
		after: '11.0.0.0',
	},
	{
		cidr: '192.0.2.112/29',
		lower: '192.0.2.112',
		upper: '192.0.2.119',
		before: '192.0.2.111',
		after: '192.0.2.120',
	},
	{
		cidr: '192.0.3.0/28',
		lower: '192.0.3.0',
		upper: '192.0.3.15',
		before: '192.0.2.255',
		after: '192.0.3.16',
	},
	{
		cidr: '192.168.1.1/32',
		lower: '192.168.1.1',
		upper: '192.168.1.1',
		before: '192.168.1.0',
		after: '192.168.1.2',
	},
	{
		cidr: '255.255.255.254/32',
		lower: '255.255.255.254',
		upper: '255.255.255.254',
		before: '255.255.255.253',
		after: '255.255.255.255',
	},
	{
		cidr: '100.64.0.0/10',
		lower: '100.64.0.0',
		upper: '100.127.255.255',
		before: '100.63.255.255',
		after: '100.128.0.0',
	},
	{
		cidr: '172.16.0.0/12',
		lower: '172.16.0.0',
		upper: '172.31.255.255',
		before: '172.15.255.255',
		after: '172.32.0.0',
	},
	{
		cidr: '198.18.0.0/15',
		lower: '198.18.0.0',
		upper: '198.19.255.255',
		before: '198.17.255.255',
		after: '198.20.0.0',
	},
	{
		cidr: '203.0.113.128/25',
		lower: '203.0.113.128',
		upper: '203.0.113.255',
		before: '203.0.113.127',
		after: '203.0.114.0',
	},
	{
		cidr: '224.0.0.0/4',
		lower: '224.0.0.0',
		upper: '239.255.255.255',
		before: '223.255.255.255',
		after: '240.0.0.0',
	},
	{
		cidr: '::1/128',
		lower: '::1',
		upper: '::1',
		before: '::',
		after: '::2',
	},
	{
		cidr: '2001:db8::/32',
		lower: '2001:db8::',
		upper: '2001:db8:ffff:ffff:ffff:ffff:ffff:ffff',
		before: '2001:db7:ffff:ffff:ffff:ffff:ffff:ffff',
		after: '2001:db9::',
	},
	{
		cidr: '2001:db8:abcd:1200::/56',
		lower: '2001:db8:abcd:1200::',
		upper: '2001:db8:abcd:12ff:ffff:ffff:ffff:ffff',
		before: '2001:db8:abcd:11ff:ffff:ffff:ffff:ffff',
		after: '2001:db8:abcd:1300::',
	},
	{
		cidr: 'fd00::/8',
		lower: 'fd00::',
		upper: 'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
		before: 'fcff:ffff:ffff:ffff:ffff:ffff:ffff:ffff',
		after: 'fe00::',
	},
];

const cidrs = cidrCases.map(({ cidr }) => cidr);
const cidrCsv = `${cidrs.join('\n')}\n`;
const maxIPv6 = 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff';

const invalidAddresses: readonly unknown[] = [
	'',
	' 192.0.2.1 ',
	'01.2.3.4',
	'192.0.2',
	'192.0.2.1.5',
	'192.0.2.256',
	'192.0.-1.1',
	'2001:db8::1::1',
	'2001:db8:0:0:0:0:0',
	'2001:db8:00000::1',
	'2001:db8::gggg',
	'fe80::1%eth0',
	42,
	null,
	undefined,
	{},
];

function expectTypeError (callback: () => unknown): void {
	assert.throws(callback, error => error instanceof TypeError);
}

function expectRangeError (callback: () => unknown): void {
	assert.throws(callback, error => error instanceof RangeError);
}

function snapshot (ranges: RangeSnapshot): unknown {
	return JSON.parse(JSON.stringify(ranges));
}

function containsReference (intervals: readonly (readonly [ number, number ])[], candidate: number): boolean {
	return intervals.some(([ start, end ]) => candidate >= start && candidate <= end);
}

function createSeededRandom (seed: number): () => number {
	let state = seed;

	return () => {
		state = (state * 48_271) % MAX_INT_32;
		return state / MAX_INT_32;
	};
}

describe('IPRangeList', () => {
	describe('constructor', () => {
		it('should export a usable constructor and start empty', () => {
			const ranges = new IPRangeList();

			assert.equal(typeof IPRangeList, 'function');
			assert.equal(ranges.contains('192.0.2.1'), false);
			assert.equal(ranges.check('not an address'), false);
			assert.deepEqual(snapshot(ranges.ranges), []);
		});
	});

	describe('addAddress', () => {
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

	describe('addSubnet', () => {
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

	describe('addRange', () => {
		it('should add an inclusive range', () => {
			const ranges = new IPRangeList();

			assert.strictEqual(ranges.addRange('192.0.2.2', '192.0.2.3'), ranges);
			assert.equal(ranges.contains('192.0.2.1'), false);
			assert.equal(ranges.contains('192.0.2.2'), true);
			assert.equal(ranges.contains('192.0.2.3'), true);
			assert.equal(ranges.contains('192.0.2.4'), false);
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

		it('should reject malformed range bounds', () => {
			const ranges = new IPRangeList();

			expectTypeError(() => ranges.addRange('192.0.2.1', 'not an address'));
			expectTypeError(() => (ranges.addRange as (start: unknown, end: unknown) => unknown)(null, '192.0.2.1'));
		});
	});

	describe('contains', () => {
		it('should find addresses across merged intervals', () => {
			const ranges = IPRangeList.fromCSV(cidrCsv);

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
				const ranges = IPRangeList.fromCSV(cidr);

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

	describe('check', () => {
		it('should alias contains', () => {
			const ranges = new IPRangeList().addSubnet('192.0.2.9/24');

			assert.equal(ranges.check('192.0.2.42'), ranges.contains('192.0.2.42'));
			assert.equal(ranges.check('192.0.3.0'), ranges.contains('192.0.3.0'));
			assert.equal(ranges.check('not an address'), ranges.contains('not an address'));
		});
	});

	describe('ranges', () => {
		it('should return detached canonical snapshots', () => {
			const ranges = new IPRangeList();

			assert.strictEqual(ranges.addAddress('192.0.2.1'), ranges);
			assert.strictEqual(ranges.addSubnet('2001:db8::1/128'), ranges);
			assert.strictEqual(ranges.addRange('192.0.2.2', '192.0.2.3'), ranges);

			const previous = ranges.ranges;
			previous.push({ start: 'changed', end: 'changed' });
			previous[0]!.start = 'changed';
			ranges.addAddress('192.0.2.4');

			assert.deepEqual(snapshot(previous), [
				{ start: 'changed', end: '::ffff:192.0.2.3' },
				{ start: '2001:db8::1', end: '2001:db8::1' },
				{ start: 'changed', end: 'changed' },
			]);

			assert.deepEqual(snapshot(ranges.ranges), [
				{ start: '::ffff:192.0.2.1', end: '::ffff:192.0.2.4' },
				{ start: '2001:db8::1', end: '2001:db8::1' },
			]);
		});

		it('should render canonical IPv6 output', () => {
			const ranges = new IPRangeList()
				.addAddress('2001:0DB8:0:0:0:0:0:1')
				.addAddress('2001:0:0:1:0:0:1:1')
				.addAddress('2001:db8:0:1:2:3:4:5');

			assert.equal(ranges.contains('2001:db8::1'), true);

			assert.deepEqual(snapshot(ranges.ranges), [
				{ start: '2001::1:0:0:1:1', end: '2001::1:0:0:1:1' },
				{ start: '2001:db8::1', end: '2001:db8::1' },
				{ start: '2001:db8:0:1:2:3:4:5', end: '2001:db8:0:1:2:3:4:5' },
			]);
		});
	});

	describe('fromCSV', () => {
		it('should load headerless addresses and CIDRs', () => {
			const ranges = IPRangeList.fromCSV('192.0.2.1/24\n198.51.100.9\n2001:db8::1\n');

			assert.equal(ranges.contains('192.0.2.255'), true);
			assert.equal(ranges.contains('198.51.100.9'), true);
			assert.equal(ranges.contains('198.51.100.10'), false);
			assert.equal(ranges.contains('2001:db8::1'), true);
			assert.equal(ranges.contains('2001:db8::2'), false);
		});

		it('should ignore empty rows and comments', () => {
			const ranges = IPRangeList.fromCSV('\n# comment\n 192.0.2.1/24 \n 198.51.100.9 \n');

			assert.equal(ranges.contains('192.0.2.255'), true);
			assert.equal(ranges.contains('198.51.100.9'), true);
			assert.equal(ranges.contains('198.51.100.10'), false);
		});

		it('should accept Buffer input', () => {
			const ranges = IPRangeList.fromCSV(Buffer.from('192.0.2.128/26\r\n192.0.2.0/26\r\n'));

			assert.equal(ranges.contains('192.0.2.0'), true);
			assert.equal(ranges.contains('192.0.2.127'), false);
			assert.equal(ranges.contains('192.0.2.128'), true);
			assert.equal(ranges.contains('192.0.2.191'), true);
		});

		it('should accept Uint8Array input', () => {
			const csv = new TextEncoder().encode('192.0.2.128/26\r\n192.0.2.0/26\r\n');
			const ranges = IPRangeList.fromCSV(csv);

			assert.equal(ranges.contains('192.0.2.0'), true);
			assert.equal(ranges.contains('192.0.2.127'), false);
			assert.equal(ranges.contains('192.0.2.128'), true);
			assert.equal(ranges.contains('192.0.2.191'), true);
		});

		it('should merge unsorted CSV ranges', () => {
			const ranges = IPRangeList.fromCSV('192.0.2.128/26\r\n192.0.2.0/26\r\n192.0.2.192/26\r\n192.0.2.64/26\r\n');

			assert.deepEqual(snapshot(ranges.ranges), [{
				start: '::ffff:192.0.2.0',
				end: '::ffff:192.0.2.255',
			}]);
		});

		it('should not retain caller state', () => {
			const csv = '192.0.2.128/26\r\n192.0.2.0/26\r\n192.0.2.192/26\r\n192.0.2.64/26\r\n';
			const ranges = IPRangeList.fromCSV(Buffer.from(csv));
			const second = IPRangeList.fromCSV(csv);

			ranges.addAddress('192.0.3.1');
			assert.equal(second.contains('192.0.3.1'), false);
		});

		it('should reject invalid input types', () => {
			for (const value of [ null, 42, {}]) {
				expectTypeError(() => (IPRangeList.fromCSV as (csv: unknown) => unknown)(value));
			}
		});

		it('should reject comma-containing rows', () => {
			for (const value of [ 'prefix,unexpected\n192.0.2.0/24', '192.0.2.0/24,ignored' ]) {
				expectTypeError(() => IPRangeList.fromCSV(value));
			}
		});

		it('should reject header rows and quoted rows', () => {
			for (const value of [ 'prefix\n192.0.2.0/24', 'not an address', '"192.0.2.0/24"' ]) {
				expectTypeError(() => IPRangeList.fromCSV(value));
			}
		});
	});
});
