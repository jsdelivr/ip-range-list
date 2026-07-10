import { formatAddress, parseAddress } from './address.js';
import { parseSubnet } from './subnet.js';
import { Interval } from './types.js';

/**
 * A mutable IP allowlist/blocklist for IPv4 and IPv6 addresses, ranges, and subnets.
 *
 * IPv4-mapped IPv6 addresses such as `::ffff:192.0.2.1` are treated as
 * equivalent to plain IPv4 addresses such as `192.0.2.1`.
 */
export class IPRangeList {
	private intervals: Interval[] = [];

	/**
	 * Returns a snapshot of the currently stored canonical merged ranges.
	 */
	get ranges (): { start: string; end: string }[] {
		return this.intervals.map(([ start, end ]) => ({
			start: formatAddress(start),
			end: formatAddress(end),
		}));
	}

	/**
	 * Adds one IPv4 or IPv6 address and returns the same list.
	 */
	addAddress (address: string): this {
		const parsed = parseAddress(address);
		return this.addInterval(parsed.value, parsed.value);
	}

	/**
	 * Adds a CIDR subnet and returns the same list.
	 *
	 * Host bits are normalized to the subnet boundary.
	 */
	addSubnet (subnet: string): this {
		const [ start, end ] = parseSubnet(subnet);
		return this.addInterval(start, end);
	}

	/**
	 * Adds the inclusive range between two addresses and returns the same list.
	 */
	addRange (start: string, end: string): this {
		const parsedStart = parseAddress(start);
		const parsedEnd = parseAddress(end);

		if (parsedStart.family !== parsedEnd.family) {
			throw new RangeError('Range start and end must be from the same IP family');
		}

		if (parsedStart.value > parsedEnd.value) {
			throw new RangeError('Range start must not be greater than range end');
		}

		return this.addInterval(parsedStart.value, parsedEnd.value);
	}

	/**
	 * Returns whether an address belongs to a stored range.
	 *
	 * Invalid candidates return false.
	 */
	contains (address: string): boolean {
		let candidate: bigint;

		try {
			candidate = parseAddress(address).value;
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

	/**
	 * Alias for {@link contains}, matching Node.js `net.BlockList` terminology.
	 */
	check (address: string): boolean {
		return this.contains(address);
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
