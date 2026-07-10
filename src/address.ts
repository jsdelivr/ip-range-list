import type { ParsedAddress } from './types.js';

const IPV4_MAPPED_PREFIX = 0xffff00000000n;

const invalidAddress = (value: unknown): TypeError => new TypeError(`Invalid IP address: ${String(value)}`);

export const isIPv4Mapped = (value: bigint): boolean => (value >> 32n) === 0xffffn;

function parseIPv4 (address: string): bigint | null {
	const parts = address.split('.');

	if (parts.length !== 4) {
		return null;
	}

	let value = 0n;

	for (const part of parts) {
		if (!/^(?:0|[1-9]\d{0,2})$/.test(part)) {
			return null;
		}

		const octet = Number(part);

		if (octet > 255) {
			return null;
		}

		value = (value << 8n) + BigInt(octet);
	}

	return value;
}

function parseIPv6 (address: string): bigint | null {
	if (!address.includes(':') || address.includes('%')) {
		return null;
	}

	const hadIPv4Tail = address.includes('.');

	if (hadIPv4Tail) {
		const separator = address.lastIndexOf(':');
		const ipv4 = separator === -1 ? null : parseIPv4(address.slice(separator + 1));

		if (ipv4 === null) {
			return null;
		}

		const high = (ipv4 >> 16n).toString(16);
		const low = (ipv4 & 0xffffn).toString(16);
		address = `${address.slice(0, separator)}:${high}:${low}`;
	}

	let groups: string[];
	const compression = address.indexOf('::');

	if (compression !== -1) {
		if (address.includes('::', compression + 2)) {
			return null;
		}

		const left = address.slice(0, compression);
		const right = address.slice(compression + 2);
		const leftGroups = left === '' ? [] : left.split(':');
		const rightGroups = right === '' ? [] : right.split(':');

		if ([ ...leftGroups, ...rightGroups ].some(group => group === '')) {
			return null;
		}

		const omitted = 8 - leftGroups.length - rightGroups.length;

		if (omitted < 1) {
			return null;
		}

		groups = [ ...leftGroups, ...Array<string>(omitted).fill('0'), ...rightGroups ];
	} else {
		groups = address.split(':');
	}

	if (groups.length !== 8 || groups.some(group => !/^[\da-f]{1,4}$/i.test(group))) {
		return null;
	}

	return groups.reduce((result, group) => (result << 16n) + BigInt(`0x${group}`), 0n);
}

export function parseAddress (value: unknown): ParsedAddress {
	if (typeof value !== 'string') {
		throw invalidAddress(value);
	}

	const isIPv6 = value.includes(':');
	const parsed = isIPv6 ? parseIPv6(value) : parseIPv4(value);

	if (parsed === null) {
		throw invalidAddress(value);
	}

	const normalized = isIPv6 ? parsed : IPV4_MAPPED_PREFIX + parsed;

	return {
		value: normalized,
		family: isIPv4Mapped(normalized) ? 'ipv4' : 'ipv6',
	};
}

export function formatAddress (value: bigint): string {
	// format IPv4-mapped IPv6
	if (isIPv4Mapped(value)) {
		const ipv4 = value & 0xffffffffn;
		return `::ffff:${Number((ipv4 >> 24n) & 0xffn)}.${Number((ipv4 >> 16n) & 0xffn)}.${Number((ipv4 >> 8n) & 0xffn)}.${Number(ipv4 & 0xffn)}`;
	}

	// format IPv6
	// first extract 16-bit IPv6 groups
	const groups = Array.from({ length: 8 }, (_, index) => Number((value >> BigInt((7 - index) * 16)) & 0xffffn).toString(16));

	// track the longest run of zeroes
	let bestStart = -1;
	let bestLength = 0;

	for (let index = 0; index < groups.length;) {
		if (groups[index] !== '0') {
			index++;
			continue;
		}

		let end = index;

		while (end < groups.length && groups[end] === '0') {
			end++;
		}

		if (end - index > bestLength) {
			bestStart = index;
			bestLength = end - index;
		}

		index = end;
	}

	// join the groups
	if (bestLength < 2) {
		return groups.join(':');
	}

	const left = groups.slice(0, bestStart).join(':');
	const right = groups.slice(bestStart + bestLength).join(':');

	if (left === '' && right === '') {
		return '::';
	}

	if (left === '') {
		return `::${right}`;
	}

	return right === '' ? `${left}::` : `${left}::${right}`;
}
