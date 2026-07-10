import { assert } from 'chai';

export type RangeSnapshot = { start: string; end: string }[];

const MAX_INT_32 = 2 ** 31 - 1;

interface FixtureCase {
	cidr: string;
	lower: string;
	upper: string;
	before: string;
	after: string;
}

export const cidrCases: readonly FixtureCase[] = [
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

export const cidrs = cidrCases.map(({ cidr }) => cidr);
export const maxIPv6 = 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff';

export const invalidAddresses: readonly unknown[] = [
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

export function expectTypeError (callback: () => unknown): void {
	assert.throws(callback, TypeError);
}

export function expectRangeError (callback: () => unknown): void {
	assert.throws(callback, RangeError);
}

export function snapshot (ranges: RangeSnapshot): unknown {
	return JSON.parse(JSON.stringify(ranges));
}

export function containsReference (intervals: readonly (readonly [ number, number ])[], candidate: number): boolean {
	return intervals.some(([ start, end ]) => candidate >= start && candidate <= end);
}

export function createSeededRandom (seed: number): () => number {
	let state = seed;

	return () => {
		state = (state * 48_271) % MAX_INT_32;
		return state / MAX_INT_32;
	};
}
