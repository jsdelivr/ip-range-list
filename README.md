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

## Development

Refer to the [contributing guide](CONTRIBUTING.md).
