# Benchmark

This benchmark compares `IPRangeList` with Node.js `net.BlockList` using IPv4 and IPv6 CIDR range CSV files.

CSV parsing and lookup address setup happen before timing starts. IPv4 prefixes are queried as IPv4-mapped IPv6
addresses so both implementations are measured in one combined address space. The benchmark measures these workloads:

- importing the full dataset into a new list;
- checking present-only, missing-only, and mixed address sets after the full dataset has been imported;
- importing the dataset in batches, with present-only, missing-only, and mixed checks between batches.

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

The default benchmark loads both generated files. Use `--ipv4-file` and `--ipv6-file` to override them.

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

By default, the benchmark loads both IPv4 and IPv6 data from `benchmark/ipv4-ranges.csv` and
`benchmark/ipv6-ranges.csv`.
You can also run it as `node --expose-gc benchmark/benchmark.js`; the script tries to enable `gc` itself and prints a
tip when the runtime still needs the flag.

Options:

- `--ipv4-file <csv>` sets the IPv4 input CSV. The default is `benchmark/ipv4-ranges.csv`.
- `--ipv6-file <csv>` sets the IPv6 input CSV. The default is `benchmark/ipv6-ranges.csv`.
- `--package <all|ip-range-list|blocklist>` selects which implementation to run. The default is `all`.
- `--runs <number>` sets the number of measured runs. The default is `7`.
- `--warmups <number>` sets the number of warmup runs before measurement. The default is `2`.
- `--large-checks <number>` sets the number of lookups after full import. The default is `1000000`.
- `--chunks <number>` sets the number of import batches for the interleaved workload. The default is `100`.
- `--checks-per-chunk <number>` sets the number of lookups after each import batch. The default is `100`.
- `--query-profile <all|present|missing|mixed>` selects which query profile to run. The default is `all`.
- `--mixed-miss-rate <number>` sets the missing-address share in the mixed profile. The default is `0.8`.
- `--verbose` prints progress output.

The script prints JSON with the settings, hit counts, and average, minimum, and p95 timings for each implementation.
To rerun without downloading data, or to run with custom files, use the run-only script:

```sh
npm run benchmark:run -- --ipv4-file path/to/ipv4-ranges.csv --ipv6-file path/to/ipv6-ranges.csv
```

## Scenarios

Full import measures how long it takes to add every prefix from the CSV file to a new list.

Large lookup imports the full dataset, then checks three query profiles. `present` contains only addresses derived from
the dataset prefixes. `missing` contains only generated addresses that are not present in the dataset. `mixed` contains
20% present addresses and 80% missing addresses by default. With the default settings, each profile runs 1,000,000
checks.

Interleaved import/lookups splits the dataset into batches, imports one batch at a time, and runs lookups after each
batch. Present queries in this workload only use prefixes already imported in the current or previous batches. With the
default settings, this uses 100 batches and 100 lookups after each batch for each selected profile.

Missing addresses are generated with a seeded pseudo-random generator. The generator preserves the source dataset's
IPv4/IPv6 prefix ratio, maps generated IPv4 misses to IPv4-mapped IPv6 addresses, and rejects generated addresses that
fall inside the loaded ranges.
