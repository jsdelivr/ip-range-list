# Benchmark

This benchmark compares `IPRangeList` with Node.js `net.BlockList` using a CSV file of IPv4 or IPv6 CIDR ranges.

CSV parsing and lookup address setup happen before timing starts. The benchmark measures three workloads:

- importing the full dataset into a new list;
- checking addresses after the full dataset has been imported;
- importing the dataset in batches, with checks between batches.

## Data

The input file must be a CSV with a header row and one CIDR range per row. The benchmark reads the first column only,
so both of these formats work:

```csv
prefix
192.0.2.0/24
198.51.100.0/24
```

```csv
prefix,source
2001:db8::/32,example
2001:db8:abcd::/48,example
```

Use `--family ipv4` for IPv4 ranges and `--family ipv6` for IPv6 ranges. Do not mix address families in one run.

## Run

Build the package before running the benchmark. The script imports the built ESM entry point from `dist/`.

```sh
npm run build
node --expose-gc benchmark/benchmark.mjs --family ipv4 --file path/to/ipv4-ranges.csv
node --expose-gc benchmark/benchmark.mjs --family ipv6 --file path/to/ipv6-ranges.csv
```

Options:

- `--package <all|ip-range-list|blocklist>` selects which implementation to run. The default is `all`.
- `--runs <number>` sets the number of measured runs. The default is `7`.
- `--warmups <number>` sets the number of warmup runs before measurement. The default is `2`.
- `--large-checks <number>` sets the number of lookups after full import. The default is `1000000`.
- `--chunks <number>` sets the number of import batches for the interleaved workload. The default is `100`.
- `--checks-per-chunk <number>` sets the number of lookups after each import batch. The default is `100`.

The script prints JSON with the settings, hit counts, and average, minimum, and p95 timings for each implementation.
Use `--expose-gc` so the script can trigger garbage collection between runs.

## Scenarios

Full import measures how long it takes to add every prefix from the CSV file to a new list.

Large lookup imports the full dataset, then checks addresses derived from the dataset prefixes. With the default
settings, this runs 1,000,000 checks.

Interleaved import/lookups splits the dataset into batches, imports one batch at a time, and runs lookups after each
batch. With the default settings, this uses 100 batches and 100 lookups after each batch.

## Published Results

The published results were collected with Node.js v24.6.0 on Windows 11 x64, Intel Core Ultra 9 275HX. The input data
was filtered [Manycast](https://manycast.net/) LACES anycast prefix data: `row[0]` was kept when
`max(row[1], row[2], row[3]) > 3 || max(row[4], row[5]) > 1`. The benchmark used the default settings: 7 measured runs
after 2 warmup runs, 1,000,000 checks in the large lookup workload, and 100 import batches with 100 checks after each
batch in the interleaved workload. Table values are averages in milliseconds.

| Scenario | Family | Prefixes | `ip-range-list` | `node:net BlockList` | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Full import | IPv4 | 15,349 | 10.28 ms | 11.76 ms | `ip-range-list` 1.14x faster |
| 1,000,000 lookups after import | IPv4 | 15,349 | 364.19 ms | 29,951.53 ms | `ip-range-list` 82.24x faster |
| Interleaved import/lookups | IPv4 | 15,349 | 15.56 ms | 122.22 ms | `ip-range-list` 7.86x faster |
| Full import | IPv6 | 13,214 | 17.49 ms | 10.99 ms | `BlockList` 1.59x faster |
| 1,000,000 lookups after import | IPv6 | 13,214 | 846.15 ms | 27,106.68 ms | `ip-range-list` 32.04x faster |
| Interleaved import/lookups | IPv6 | 13,214 | 28.12 ms | 93.34 ms | `ip-range-list` 3.32x faster |
