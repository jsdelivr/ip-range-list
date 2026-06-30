const IPV4_MAPPED_PREFIX = 0xffff00000000n;
const textDecoder = new TextDecoder();

type Interval = readonly [ start: bigint, end: bigint ];

const invalidAddress = (value: unknown): TypeError => new TypeError(`Invalid IP address: ${String(value)}`);

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
		if (address.indexOf('::', compression + 2) !== -1) {
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

	const value = groups.reduce((result, group) => (result << 16n) + BigInt(`0x${group}`), 0n);

	if (hadIPv4Tail && (value >> 32n) !== 0xffffn) {
		return null;
	}

	return value;
}

function parseAddress (value: unknown): bigint {
	if (typeof value !== 'string') {
		throw invalidAddress(value);
	}

	const parsed = value.includes(':') ? parseIPv6(value) : parseIPv4(value);

	if (parsed === null) {
		throw invalidAddress(value);
	}

	return value.includes(':') ? parsed : IPV4_MAPPED_PREFIX + parsed;
}

function parseSubnet (value: unknown): Interval {
	if (typeof value !== 'string') {
		throw new TypeError(`Invalid subnet: ${String(value)}`);
	}

	const separator = value.indexOf('/');

	if (separator === -1 || value.indexOf('/', separator + 1) !== -1) {
		throw new TypeError(`Invalid subnet: ${value}`);
	}

	const address = value.slice(0, separator);
	const prefixText = value.slice(separator + 1);
	const bits = address.includes(':') ? 128 : 32;

	if (!/^\d+$/.test(prefixText)) {
		throw new TypeError(`Invalid subnet prefix: ${prefixText}`);
	}

	const prefix = Number(prefixText);

	if (prefix > bits) {
		throw new RangeError(`Subnet prefix must be between 0 and ${bits}`);
	}

	const target = parseAddress(address);
	const size = 1n << BigInt(bits - prefix);
	const start = (target / size) * size;

	return [ start, start + size - 1n ];
}

function parseCsvEntry (value: string): Interval {
	if (value.includes('/')) {
		return parseSubnet(value);
	}

	const address = parseAddress(value);
	return [ address, address ];
}

function mergeIntervals (intervals: Interval[]): Interval[] {
	const sorted = [ ...intervals ].sort((left, right) => left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0);
	const merged: Interval[] = [];

	for (const [ start, end ] of sorted) {
		const previous = merged.at(-1);

		if (previous === undefined || start > previous[1] + 1n) {
			merged.push([ start, end ]);
			continue;
		}

		if (end > previous[1]) {
			merged[merged.length - 1] = [ previous[0], end ];
		}
	}

	return merged;
}

function formatAddress (value: bigint): string {
	// format IPv4-mapped IPv6
	if ((value >> 32n) === 0xffffn) {
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

/**
 * A mutable, canonical list of IPv4 and IPv6 ranges.
 *
 * IPv4 values are stored as IPv4-mapped IPv6 addresses, so a dotted IPv4
 * candidate and its `::ffff:` representation always have identical membership.
 */
export class IPRangeList {
	private intervals: Interval[] = [];

	/** A detached snapshot of canonical inclusive ranges, rendered as IPv6 strings. */
	get ranges (): { start: string; end: string }[] {
		return this.intervals.map(([ start, end ]) => ({
			start: formatAddress(start),
			end: formatAddress(end),
		}));
	}

	/** Adds one address to the list. */
	addAddress (address: string): this {
		const value = parseAddress(address);
		return this.addInterval(value, value);
	}

	/** Adds a CIDR subnet, normalizing its host bits to the network boundary. */
	addSubnet (subnet: string): this {
		const [ start, end ] = parseSubnet(subnet);
		return this.addInterval(start, end);
	}

	/** Adds an inclusive range from start through end. */
	addRange (start: string, end: string): this {
		const parsedStart = parseAddress(start);
		const parsedEnd = parseAddress(end);

		if (parsedStart > parsedEnd) {
			throw new RangeError('Range start must not be greater than range end');
		}

		return this.addInterval(parsedStart, parsedEnd);
	}

	/** Returns whether an address belongs to any stored range. Invalid candidates return false. */
	contains (address: string): boolean {
		let candidate: bigint;

		try {
			candidate = parseAddress(address);
		} catch {
			return false;
		}

		let low = 0;
		let high = this.intervals.length - 1;

		while (low <= high) {
			const middle = Math.floor((low + high) / 2);
			const [ start, end ] = this.intervals[middle]!;

			if (candidate < start) {
				high = middle - 1;
			} else if (candidate > end) {
				low = middle + 1;
			} else {
				return true;
			}
		}

		return false;
	}

	/** Alias for {@link contains}, matching Node's BlockList terminology. */
	check (address: string): boolean {
		return this.contains(address);
	}

	/** Creates a list from headerless CSV rows containing addresses or CIDR prefixes. */
	static fromCSV (csv: string | Uint8Array): IPRangeList {
		if (typeof csv !== 'string' && !(csv instanceof Uint8Array)) {
			throw new TypeError('CSV input must be a string or Uint8Array');
		}

		const content = typeof csv === 'string' ? csv : textDecoder.decode(csv);
		const rows = content.split(/\r?\n/);
		const intervals: Interval[] = [];

		for (const row of rows) {
			const value = row.trim();

			if (value === '' || value.startsWith('#')) {
				continue;
			}

			if (value.includes(',')) {
				throw new TypeError(`CSV rows must contain one address or CIDR: ${value}`);
			}

			intervals.push(parseCsvEntry(value));
		}

		const list = new IPRangeList();
		list.intervals = mergeIntervals(intervals);
		return list;
	}

	private addInterval (start: bigint, end: bigint): this {
		let low = 0;
		let high = this.intervals.length;

		while (low < high) {
			const middle = Math.floor((low + high) / 2);
			const interval = this.intervals[middle]!;

			if (interval[0] < start) {
				low = middle + 1;
			} else {
				high = middle;
			}
		}

		let index = low;

		const previous = index > 0 ? this.intervals[index - 1] : undefined;

		if (previous !== undefined && previous[1] + 1n >= start) {
			index--;
			start = previous[0];
			end = end > previous[1] ? end : previous[1];
		}

		let stop = index;

		while (stop < this.intervals.length) {
			const interval = this.intervals[stop]!;

			if (interval[0] > end + 1n) {
				break;
			}

			end = end > interval[1] ? end : interval[1];
			stop++;
		}

		this.intervals.splice(index, stop - index, [ start, end ]);
		return this;
	}
}
