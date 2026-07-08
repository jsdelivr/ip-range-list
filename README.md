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

> [!TIP]
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

The package was tested with the included benchmark, comparing `IPRangeList` with Node.js `net.BlockList` against a large
[Manycast](https://manycast.net/) dataset of IPv4 and IPv6 ranges. See the [benchmark notes](benchmark/README.md) for
methodology, data preparation, and reproduction steps. The results are as follows:

| Scenario | Family | Prefixes | `ip-range-list` | `node:net BlockList` | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Full import | IPv4 | 15,349 | 10.28 ms | 11.76 ms | `ip-range-list` 1.14x faster |
| 1,000,000 lookups after import | IPv4 | 15,349 | 364.19 ms | 29,951.53 ms | `ip-range-list` 82.24x faster |
| Interleaved import/lookups | IPv4 | 15,349 | 15.56 ms | 122.22 ms | `ip-range-list` 7.86x faster |
| Full import | IPv6 | 13,214 | 17.49 ms | 10.99 ms | `BlockList` 1.59x faster |
| 1,000,000 lookups after import | IPv6 | 13,214 | 846.15 ms | 27,106.68 ms | `ip-range-list` 32.04x faster |
| Interleaved import/lookups | IPv6 | 13,214 | 28.12 ms | 93.34 ms | `ip-range-list` 3.32x faster |

## Development

Refer to the [contributing guide](CONTRIBUTING.md).
