# ip-range-list

A dependency-free IP allowlist/blocklist. Think Node.js [`net.BlockList`](https://nodejs.org/docs/latest/api/net.html#class-netblocklist), but [faster](./benchmark).
Accepts IPv4 and IPv6 addresses, ranges, and subnets, and uses binary search for fast lookups.

## Install

```sh
npm install ip-range-list
```

In client-side applications, you can import the package directly via [jsDelivr CDN](https://www.jsdelivr.com/package/npm/ip-range-list).

## Usage

Using the package in ESM/CJS applications:

```js
import { IPRangeList } from 'ip-range-list';

let ranges = new IPRangeList()
    .addRange('192.0.1.1', '192.0.1.255')
    .addSubnet('192.0.2.9/24')
    .addAddress('2001:db8::1');

ranges.contains('192.0.2.42'); // => true
ranges.contains('::ffff:192.0.2.42'); // => true
ranges.contains('2001:db8::2'); // => false
```

Using the [UMD build](https://www.jsdelivr.com/package/npm/ip-range-list):

```js
const { IPRangeList } = window.ipRangeList;
let ranges = new IPRangeList();
```

## API

> [!NOTE]
> IPv4-mapped IPv6 addresses such as `::ffff:192.0.2.1` are treated as equivalent to plain IPv4 addresses such as `192.0.2.1` across all methods.

### `new IPRangeList()`

Creates an empty mutable list.

### `.addAddress(address)`

Adds one IPv4 or IPv6 address and returns the same list.

### `.addRange(start, end)`

Adds the inclusive range between two addresses and returns the same list.

### `.addSubnet(cidr)`

Adds a CIDR subnet and returns the same list. Host bits are normalized, so `192.0.2.9/24` adds `192.0.2.0` through `192.0.2.255`.

### `.contains(address)` and `.check(address)`

Return whether an address belongs to a stored range. `.check()` is an alias for `.contains()`. Invalid candidates return `false`.

### `.ranges`

A read-only snapshot of the currently stored canonical merged ranges:

```js
[
    {
        start: '::ffff:192.0.2.0',
        end: '::ffff:192.0.2.255',
    },
]
```

## Normalization and errors

- Overlapping and adjacent ranges merge into one canonical inclusive interval.
- IPv4 is stored as IPv4-mapped IPv6 (`::ffff:0:0/96`), so dotted IPv4 and mapped IPv6 candidates compare identically.
- Public mutation methods reject malformed addresses and unsupported input types with `TypeError`.
- Out-of-range CIDR prefix lengths and reversed ranges throw `RangeError`.

Lookups use binary search over the canonical ranges.

## Benchmark

The package includes a benchmark comparing `IPRangeList` with Node.js `net.BlockList` against
[Manycast](https://manycast.net/) IPv4 and IPv6 prefix data. See the [benchmark notes](benchmark/README.md) for the
data download script, query profiles, methodology, and reproduction steps. The published run used 55,473 prefixes:
41,207 IPv4 prefixes and 14,266 IPv6 prefixes.

The `present` profile checks addresses from the dataset prefixes, the `missing` profile checks generated addresses
outside the loaded ranges, and the `mixed` profile uses 20% present addresses and 80% missing addresses.

| Scenario | Profile | `ip-range-list` | `node:net BlockList` | Result |
| --- | --- | ---: | ---: | --- |
| Full import | - | 54.09 ms | 40.36 ms | `BlockList` 1.34x faster |
| 1,000,000 lookups after import | present | 1,472.24 ms | 184,395.46 ms | `ip-range-list` 125.25x faster |
| 1,000,000 lookups after import | missing | 1,568.54 ms | 394,476.87 ms | `ip-range-list` 251.49x faster |
| 1,000,000 lookups after import | mixed | 1,609.40 ms | 356,680.64 ms | `ip-range-list` 221.62x faster |
| Interleaved import/lookups | present | 71.01 ms | 1,009.32 ms | `ip-range-list` 14.21x faster |
| Interleaved import/lookups | missing | 96.28 ms | 2,023.87 ms | `ip-range-list` 21.02x faster |
| Interleaved import/lookups | mixed | 98.54 ms | 1,818.27 ms | `ip-range-list` 18.45x faster |

## Development

Refer to the [contributing guide](CONTRIBUTING.md).
