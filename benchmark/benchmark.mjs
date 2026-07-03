import { readFileSync } from 'node:fs';
import { BlockList } from 'node:net';
import { cpus } from 'node:os';
import { performance } from 'node:perf_hooks';
import { IPRangeList } from '../dist/esm/index.js';

const packageAliases = {
	'all': 'all',
	'blocklist': 'node:net BlockList',
	'ip-range-list': 'ip-range-list',
};

const packages = {
	'ip-range-list': {
		create: () => new IPRangeList(),
		addSubnet: (list, prefix) => list.addSubnet(prefix.cidr),
		check: (list, address) => list.contains(address),
	},
	'node:net BlockList': {
		create: () => new BlockList(),
		addSubnet: (list, prefix, family) => list.addSubnet(prefix.address, prefix.prefix, family),
		check: (list, address, family) => list.check(address, family),
	},
};

function printUsage () {
	console.error(`Usage:
  node --expose-gc benchmark/benchmark.mjs --family <ipv4|ipv6> --file <csv> [options]

Options:
  --package <all|ip-range-list|blocklist>  Package to benchmark. Default: all
  --runs <number>                          Measured runs. Default: 7
  --warmups <number>                       Warmup runs. Default: 2
  --large-checks <number>                  Lookups after full import. Default: 1000000
  --chunks <number>                        Interleaved import chunks. Default: 100
  --checks-per-chunk <number>              Interleaved lookups after each chunk. Default: 100
  --help                                   Show this message`);
}

function parsePositiveInteger (name, value) {
	const parsed = Number(value);

	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new TypeError(`${name} must be a positive integer`);
	}

	return parsed;
}

function parseArgs (args) {
	const options = {
		packageName: 'all',
		runs: 7,
		warmups: 2,
		largeChecks: 1_000_000,
		chunks: 100,
		checksPerChunk: 100,
	};

	for (let index = 0; index < args.length; index++) {
		const arg = args[index];

		if (arg === '--help') {
			printUsage();
			process.exit(0);
		}

		if (!arg.startsWith('--')) {
			throw new TypeError(`Unexpected argument: ${arg}`);
		}

		const value = args[index + 1];

		if (value === undefined || value.startsWith('--')) {
			throw new TypeError(`Missing value for ${arg}`);
		}

		index++;

		switch (arg) {
			case '--family':
				options.family = value;
				break;
			case '--file':
				options.file = value;
				break;
			case '--package':
				options.packageName = value;
				break;
			case '--runs':
				options.runs = parsePositiveInteger(arg, value);
				break;
			case '--warmups':
				options.warmups = parsePositiveInteger(arg, value);
				break;
			case '--large-checks':
				options.largeChecks = parsePositiveInteger(arg, value);
				break;
			case '--chunks':
				options.chunks = parsePositiveInteger(arg, value);
				break;
			case '--checks-per-chunk':
				options.checksPerChunk = parsePositiveInteger(arg, value);
				break;
			default:
				throw new TypeError(`Unknown option: ${arg}`);
		}
	}

	if (options.family !== 'ipv4' && options.family !== 'ipv6') {
		throw new TypeError('--family must be ipv4 or ipv6');
	}

	if (options.file === undefined) {
		throw new TypeError('--file is required');
	}

	if (!(options.packageName in packageAliases)) {
		throw new TypeError('--package must be all, ip-range-list, or blocklist');
	}

	return options;
}

function loadPrefixes (file) {
	const lines = readFileSync(file, 'utf8').trim().split(/\r?\n/);

	return lines.slice(1).filter(Boolean).map((cidr) => {
		const [ address, prefix ] = cidr.split('/');

		return { cidr, address, prefix: Number(prefix) };
	});
}

function percentile (values, p) {
	const sorted = values.toSorted((a, b) => a - b);
	const index = Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p));

	return sorted[index];
}

function summarize (values) {
	const average = values.reduce((sum, value) => sum + value, 0) / values.length;

	return {
		average,
		min: Math.min(...values),
		p95: percentile(values, 0.95),
	};
}

function time (fn) {
	const start = performance.now();
	const result = fn();

	return { ms: performance.now() - start, result };
}

function makeLargeQueries (prefixes, largeChecks) {
	return Array.from({ length: largeChecks }, (_, index) => prefixes[index % prefixes.length].address);
}

function makeChunks (prefixes, chunkCount) {
	const chunks = [];
	const chunkSize = Math.ceil(prefixes.length / chunkCount);

	for (let index = 0; index < prefixes.length; index += chunkSize) {
		chunks.push(prefixes.slice(index, index + chunkSize));
	}

	return chunks;
}

function runLargeScenario (impl, prefixes, queries, family) {
	const list = impl.create();

	const imported = time(() => {
		for (const prefix of prefixes) {
			impl.addSubnet(list, prefix, family);
		}
	});

	const checked = time(() => {
		let hits = 0;

		for (const query of queries) {
			if (impl.check(list, query, family)) {
				hits++;
			}
		}

		return hits;
	});

	return { importMs: imported.ms, checkMs: checked.ms, hits: checked.result };
}

function runInterleavedScenario (impl, chunks, prefixes, family, checksPerChunk) {
	const list = impl.create();
	let queryIndex = 0;

	const measured = time(() => {
		let hits = 0;

		for (const chunk of chunks) {
			for (const prefix of chunk) {
				impl.addSubnet(list, prefix, family);
			}

			for (let index = 0; index < checksPerChunk; index++) {
				const query = prefixes[queryIndex % prefixes.length].address;
				queryIndex++;

				if (impl.check(list, query, family)) {
					hits++;
				}
			}
		}

		return hits;
	});

	return { totalMs: measured.ms, hits: measured.result };
}

function benchmarkOne (name, impl, family, prefixes, options) {
	const queries = makeLargeQueries(prefixes, options.largeChecks);
	const chunks = makeChunks(prefixes, options.chunks);
	const largeImport = [];
	const largeChecks = [];
	const interleaved = [];
	let largeHits = 0;
	let interleavedHits = 0;

	for (let run = 0; run < options.warmups + options.runs; run++) {
		globalThis.gc?.();
		const large = runLargeScenario(impl, prefixes, queries, family);

		globalThis.gc?.();
		const mixed = runInterleavedScenario(impl, chunks, prefixes, family, options.checksPerChunk);

		if (run >= options.warmups) {
			largeImport.push(large.importMs);
			largeChecks.push(large.checkMs);
			interleaved.push(mixed.totalMs);
			largeHits = large.hits;
			interleavedHits = mixed.hits;
		}
	}

	return {
		name,
		family,
		prefixCount: prefixes.length,
		largeChecks: options.largeChecks,
		chunkCount: chunks.length,
		checksPerChunk: options.checksPerChunk,
		largeHits,
		interleavedHits,
		largeImport: summarize(largeImport),
		largeCheck: summarize(largeChecks),
		interleaved: summarize(interleaved),
	};
}

function getPackageEntries (packageName) {
	const packageLabel = packageAliases[packageName];

	return packageLabel === 'all' ? Object.entries(packages) : [ [ packageLabel, packages[packageLabel] ] ];
}

let options;

try {
	options = parseArgs(process.argv.slice(2));
} catch (error) {
	console.error(error.message);
	printUsage();
	process.exit(1);
}

let prefixes;

try {
	prefixes = loadPrefixes(options.file);
} catch (error) {
	console.error(error.message);
	process.exit(1);
}

const results = [];

for (const [ name, impl ] of getPackageEntries(options.packageName)) {
	console.error(`Running ${name} ${options.family}...`);
	results.push(benchmarkOne(name, impl, options.family, prefixes, options));
}

if (globalThis.gc === undefined) {
	console.error('Tip: run with --expose-gc to reduce cross-run heap noise.');
}

console.log(JSON.stringify({
	settings: {
		node: process.version,
		platform: `${process.platform} ${process.arch}`,
		cpu: cpus()[0]?.model,
		file: options.file,
		family: options.family,
		package: options.packageName,
		runs: options.runs,
		warmups: options.warmups,
		largeChecks: options.largeChecks,
		chunks: options.chunks,
		checksPerChunk: options.checksPerChunk,
	},
	results,
}, null, 2));
