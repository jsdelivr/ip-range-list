import { formatAddress, parseAddress } from './address.js';
import { parseSubnet } from './subnet.js';
import { Interval } from './types.js';

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
