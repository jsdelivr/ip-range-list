# ip-range-list

`ip-range-list` is a dependency-free, mutable IP allow/block-list primitive for Node.js 20.6.0+. It stores IPv4 and IPv6
inputs as canonical, merged inclusive ranges and searches them with binary search.

## Install

```sh
npm install ip-range-list
```

In client-side applications, you can import the package directly via [jsDelivr CDN](https://www.jsdelivr.com/package/npm/ip-range-list).

## Use

ES modules:

```js
import { IPRangeList } from 'ip-range-list';

let ranges = new IPRangeList()
    .addSubnet('192.0.2.9/24')
    .addAddress('2001:db8::1');

ranges.contains('192.0.2.42'); // true
ranges.check('::ffff:192.0.2.42'); // true
ranges.contains('2001:db8::2'); // false
```

CommonJS:

```js
const { IPRangeList } = require('ip-range-list');
```

Browser ESM:

```html
<script type="module">
    import { IPRangeList } from 'https://cdn.jsdelivr.net/npm/ip-range-list/+esm';

    let ranges = new IPRangeList();
</script>
```

Browser UMD:

```html
<script src="https://cdn.jsdelivr.net/npm/ip-range-list/dist/umd/bundle.min.js"></script>
<script>
    const { IPRangeList } = window.ipRangeList;
    let ranges = new IPRangeList();
</script>
```

## API

### `new IPRangeList()`

Creates an empty mutable list.

### `.addAddress(address)`

Adds one IPv4 or IPv6 address and returns the same list. Valid IPv4-mapped IPv6 input such as `::ffff:192.0.2.1` is
equivalent to `192.0.2.1`. Other valid IPv6 literals with dotted IPv4 tails, such as `::192.0.2.1`, are accepted as
IPv6 addresses.

### `.addSubnet(cidr)`

Adds a CIDR subnet and returns the same list. Host bits are normalized, so `192.0.2.9/24` adds `192.0.2.0` through
`192.0.2.255`. Prefixes for dotted IPv4 and IPv4-mapped IPv6 text use `/0` through `/32`; other IPv6 prefixes use
`/0` through `/128`.

### `.addRange(start, end)`

Adds the inclusive range between two addresses and returns the same list. The endpoints may use either address family
after IPv4 normalization, but `start` must not be after `end`.

### `.contains(address)` and `.check(address)`

Return whether an address belongs to a stored range. `.check()` is an alias for `.contains()`. Invalid candidates return
`false`.

### `.ranges`

Returns a detached snapshot of canonical merged ranges:

```js
[
    {
        start: '::ffff:192.0.2.0',
        end: '::ffff:192.0.2.255',
    },
]
```

Range endpoints always render as IPv6 strings. Mutating a returned snapshot cannot mutate the list.

## Normalization and errors

- Overlapping and adjacent ranges merge into one canonical inclusive interval.
- IPv4 is stored as IPv4-mapped IPv6 (`::ffff:0:0/96`), so dotted IPv4 and mapped IPv6 candidates compare identically.
- Public mutation methods reject malformed addresses and unsupported input types with `TypeError`.
- Out-of-range CIDR prefix lengths and reversed ranges throw `RangeError`.
- Direct public address input is strict: it does not trim whitespace, zone identifiers are rejected, and dotted IPv4
  tails are accepted only in valid IPv6 tail position.

Lookups use binary search over the canonical ranges.

## Benchmark

The following benchmark compares `IPRangeList` with Node.js `net.BlockList` on [Manycast](https://manycast.net/) LACES
anycast prefix CSV data. CSV loading and query preparation were done before timing; the measured work is only adding
subnets to the list and checking candidate addresses.

To reproduce it, download the raw LACES data from jsDelivr and filter it into CSV files with a `prefix` header and one
CIDR per row:

- `https://download.jsdelivr.com/LACES_ANYCAST_IPV4.csv.gz`
- `https://download.jsdelivr.com/LACES_ANYCAST_IPV6.csv.gz`

The source files contain multiple columns. The benchmark data used below keeps only `row[0]` prefixes that match the
[Manycast](https://manycast.net/) recommendation: `max(row[1], row[2], row[3]) > 3 || max(row[4], row[5]) > 1`.

After placing the filtered files into `benchmark/`, build the package, then run the benchmark once per IP family:

```sh
npm run build
node --expose-gc benchmark/benchmark.mjs --family ipv4 --file benchmark/LACES_ANYCAST_IPV4.csv
node --expose-gc benchmark/benchmark.mjs --family ipv6 --file benchmark/LACES_ANYCAST_IPV6.csv
```

Useful options include `--package <all|ip-range-list|blocklist>`, `--runs`, `--warmups`, `--large-checks`, `--chunks`,
and `--checks-per-chunk`.

Settings:

- Node.js v24.6.0 on Windows 11 x64, Intel Core Ultra 9 275HX.
- 7 measured runs after 2 warmup runs; table values are averages in milliseconds.
- Large lookup scenario: import the full dataset once, then run 1,000,000 `contains()`/`check()` calls using addresses
  derived from the dataset prefixes.
- Interleaved scenario: import the dataset in 100 chunks, running 100 `contains()`/`check()` calls after each chunk.

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
