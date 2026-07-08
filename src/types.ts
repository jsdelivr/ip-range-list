export type AddressFamily = 'ipv4' | 'ipv6';

export interface ParsedAddress {
	value: bigint;
	family: AddressFamily;
}

export type Interval = readonly [ start: bigint, end: bigint ];
