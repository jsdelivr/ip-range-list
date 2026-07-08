import { isIPv4Mapped, parseAddress } from './address.js';
import { Interval } from './types.js';

export function parseSubnet (value: unknown): Interval {
	if (typeof value !== 'string') {
		throw new TypeError(`Invalid subnet: ${String(value)}`);
	}

	const separator = value.indexOf('/');

	if (separator === -1 || value.indexOf('/', separator + 1) !== -1) {
		throw new TypeError(`Invalid subnet: ${value}`);
	}

	const address = value.slice(0, separator);
	const prefixText = value.slice(separator + 1);
	const rawBits = address.includes(':') ? 128 : 32;

	if (!/^\d+$/.test(prefixText)) {
		throw new TypeError(`Invalid subnet prefix: ${prefixText}`);
	}

	const prefix = Number(prefixText);

	if (prefix > rawBits) {
		throw new RangeError(`Subnet prefix must be between 0 and ${rawBits}`);
	}

	const target = parseAddress(address);
	const bits = isIPv4Mapped(target) ? 32 : rawBits;

	if (prefix > bits) {
		throw new RangeError(`Subnet prefix must be between 0 and ${bits}`);
	}

	const size = 1n << BigInt(bits - prefix);
	const start = (target / size) * size;

	return [ start, start + size - 1n ];
}
