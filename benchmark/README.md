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

The default inputs are generated from [Manycast](https://manycast.net/) LACES anycast prefix data:

```sh
npm run benchmark:prepare
```

## Run

Build the package before running the benchmark. The script imports the built ESM entry point from `dist/`.

```sh
npm run build
npm run benchmark
```

By default, the benchmark runs both IPv4 and IPv6 with `benchmark/ipv4-ranges.csv` and `benchmark/ipv6-ranges.csv`.
You can also run it as `node --expose-gc benchmark/benchmark.js`; the script tries to enable `gc` itself and prints a
tip when the runtime still needs the flag.

Options:

- `--family <all|ipv4|ipv6>` selects the address family. The default is `all`.
- `--file <csv>` uses a custom input file for the selected `ipv4` or `ipv6` family.
- `--package <all|ip-range-list|blocklist>` selects which implementation to run. The default is `all`.
- `--runs <number>` sets the number of measured runs. The default is `7`.
- `--warmups <number>` sets the number of warmup runs before measurement. The default is `2`.
- `--large-checks <number>` sets the number of lookups after full import. The default is `1000000`.
- `--chunks <number>` sets the number of import batches for the interleaved workload. The default is `100`.
- `--checks-per-chunk <number>` sets the number of lookups after each import batch. The default is `100`.

The script prints JSON with the settings, hit counts, and average, minimum, and p95 timings for each implementation.
To rerun without downloading data, or to run one family with a custom file, use the run-only script:

```sh
npm run benchmark:run -- --family ipv4 --file path/to/ipv4-ranges.csv
npm run benchmark:run -- --family ipv6 --file path/to/ipv6-ranges.csv
```

## Scenarios

Full import measures how long it takes to add every prefix from the CSV file to a new list.

Large lookup imports the full dataset, then checks addresses derived from the dataset prefixes. With the default
settings, this runs 1,000,000 checks.

Interleaved import/lookups splits the dataset into batches, imports one batch at a time, and runs lookups after each
batch. With the default settings, this uses 100 batches and 100 lookups after each batch.

## Published Results

The published results were collected with Node.js v24.6.0 on Windows 11 x64, Intel Core Ultra 9 275HX by running
`npm run benchmark`. The input data was generated from the unfiltered first column of the Manycast LACES anycast prefix
data. The benchmark used the default settings: 7 measured runs after 2 warmup runs, 1,000,000 checks in the large
lookup workload, and 100 import batches with 100 checks after each batch in the interleaved workload. Table values are
averages in milliseconds.

| Scenario | Family | Prefixes | `ip-range-list` | `node:net BlockList` | Result |
| --- | --- | ---: | ---: | ---: | --- |
| Full import | IPv4 | 41,207 | 33.65 ms | 27.09 ms | `BlockList` 1.24x faster |
| 1,000,000 lookups after import | IPv4 | 41,207 | 404.93 ms | 111,372.56 ms | `ip-range-list` 275.04x faster |
| Interleaved import/lookups | IPv4 | 41,207 | 38.42 ms | 823.27 ms | `ip-range-list` 21.43x faster |
| Full import | IPv6 | 14,425 | 20.13 ms | 10.68 ms | `BlockList` 1.88x faster |
| 1,000,000 lookups after import | IPv6 | 14,425 | 854.48 ms | 28,942.36 ms | `ip-range-list` 33.87x faster |
| Interleaved import/lookups | IPv6 | 14,425 | 30.17 ms | 112.65 ms | `ip-range-list` 3.73x faster |
