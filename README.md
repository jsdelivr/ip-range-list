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
data download script, query profiles, methodology, and reproduction steps.

## Development

Refer to the [contributing guide](CONTRIBUTING.md).
