import { readFileSync } from 'node:fs';
import { BlockList } from 'node:net';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import v8 from 'node:v8';
import vm from 'node:vm';
import { IPRangeList } from '../dist/esm/index.js';

const benchmarkDir = dirname(fileURLToPath(import.meta.url));
const defaultFiles = {
	ipv4: join(benchmarkDir, 'ipv4-ranges.csv'),
	ipv6: join(benchmarkDir, 'ipv6-ranges.csv'),
};

const packageAliases = {
	'all': 'all',
	'blocklist': 'node:net BlockList',
	'ip-range-list': 'ip-range-list',
};

const packages = {
	'ip-range-list': {
		create: () => new IPRangeList(),
		addSubnet: (list, prefix) => list.addSubnet(prefix.sourceCidr),
		check: (list, address) => list.contains(address),
	},
	'node:net BlockList': {
		create: () => new BlockList(),
		addSubnet: (list, prefix) => list.addSubnet(prefix.address, prefix.prefix, 'ipv6'),
		check: (list, address) => list.check(address, 'ipv6'),
	},
};

const queryProfileAliases = {
	all: 'all',
	present: 'present',
	missing: 'missing',
	mixed: 'mixed',
};

function printUsage (log = console.log) {
	log(`Usage:
  node benchmark/benchmark.js [options]

Options:
  --ipv4-file <csv>                        IPv4 input CSV. Default: benchmark/ipv4-ranges.csv
  --ipv6-file <csv>                        IPv6 input CSV. Default: benchmark/ipv6-ranges.csv
  --package <all|ip-range-list|blocklist>  Package to benchmark. Default: all
  --runs <number>                          Measured runs. Default: 7
  --warmups <number>                       Warmup runs. Default: 2
  --large-checks <number>                  Lookups after full import. Default: 1000000
  --chunks <number>                        Interleaved import chunks. Default: 100
  --checks-per-chunk <number>              Interleaved lookups after each chunk. Default: 100
  --query-profile <all|present|missing|mixed>
                                           Query profile to run. Default: all
  --mixed-miss-rate <number>               Missing-address share in mixed queries. Default: 0.8
  --verbose                                Print progress output
  --help                                   Show this message`);
}

function parsePositiveInteger (name, value) {
	const parsed = Number(value);

	if (!Number.isSafeInteger(parsed) || parsed <= 0) {
		throw new TypeError(`${name} must be a positive integer`);
	}

	return parsed;
}

function parseRatio (name, value) {
	const parsed = Number(value);

	if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
		throw new TypeError(`${name} must be a number from 0 to 1`);
	}

	return parsed;
}

function parseArgs (args) {
	const options = {
		ipv4File: defaultFiles.ipv4,
		ipv6File: defaultFiles.ipv6,
		packageName: 'all',
		runs: 7,
		warmups: 2,
		largeChecks: 1_000_000,
		chunks: 100,
		checksPerChunk: 100,
		queryProfile: 'all',
		mixedMissRate: 0.8,
		verbose: false,
	};

	for (let index = 0; index < args.length; index++) {
		const arg = args[index];

		if (arg === '--help') {
			printUsage();
			process.exit(0);
		}

		if (arg === '--verbose') {
			options.verbose = true;
			continue;
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
			case '--ipv4-file':
				options.ipv4File = value;
				break;
			case '--ipv6-file':
				options.ipv6File = value;
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
			case '--query-profile':
				options.queryProfile = value;
				break;
			case '--mixed-miss-rate':
				options.mixedMissRate = parseRatio(arg, value);
				break;
			default:
				throw new TypeError(`Unknown option: ${arg}`);
		}
	}

	if (!(options.packageName in packageAliases)) {
		throw new TypeError('--package must be all, ip-range-list, or blocklist');
	}

	if (!(options.queryProfile in queryProfileAliases)) {
		throw new TypeError('--query-profile must be all, present, missing, or mixed');
	}

	return options;
}

function mapIpv4Address (address) {
	return `::ffff:${address}`;
}

function normalizePrefix (cidr, sourceFamily) {
	const [ sourceAddress, rawPrefix ] = cidr.split('/');
	const sourcePrefix = Number(rawPrefix);

	if (sourceFamily === 'ipv4') {
		const address = mapIpv4Address(sourceAddress);
		const prefix = sourcePrefix + 96;

		return {
			cidr: `${address}/${prefix}`,
			sourceCidr: cidr,
			address,
			prefix,
			sourceFamily,
		};
	}

	return {
		cidr,
		sourceCidr: cidr,
		address: sourceAddress,
		prefix: sourcePrefix,
		sourceFamily,
	};
}

function loadPrefixes (file, sourceFamily) {
	const lines = readFileSync(file, 'utf8').trim().split(/\r?\n/);

	return lines.slice(1).filter(Boolean).map(cidr => normalizePrefix(cidr, sourceFamily));
}

function ensureGarbageCollector () {
	if (typeof globalThis.gc === 'function') {
		return true;
	}

	try {
		v8.setFlagsFromString('--expose_gc');
		globalThis.gc = vm.runInNewContext('gc');
	} catch {
		return false;
	}

	return typeof globalThis.gc === 'function';
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

function createRandom (seed) {
	let state = seed % 0x100000000;

	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) % 0x100000000;

		if (state < 0) {
			state += 0x100000000;
		}

		return state / 0x100000000;
	};
}

function randomHex16 (random) {
	return Math.floor(random() * 0x10000).toString(16).padStart(4, '0');
}

function makeRandomIpv4Address (random) {
	return Array.from({ length: 4 }, () => Math.floor(random() * 0x100).toString(10)).join('.');
}

function makeRandomIpv6Address (random) {
	return Array.from({ length: 8 }, () => randomHex16(random)).join(':');
}

function createMissGuard (prefixes) {
	const list = new IPRangeList();

	for (const prefix of prefixes) {
		list.addSubnet(prefix.sourceCidr);
	}

	return list;
}

function makeRandomMissAddress (random, missGuard, sourceFamily) {
	const maxAttempts = 10_000;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		const address = sourceFamily === 'ipv4' ? mapIpv4Address(makeRandomIpv4Address(random)) : makeRandomIpv6Address(random);

		if (!missGuard.contains(address)) {
			return address;
		}
	}

	throw new Error(`No uncovered ${sourceFamily} address found after ${maxAttempts} random attempts.`);
}

function getMissCounts (missCount, ipv4MissRatio) {
	const ipv4 = Math.round(missCount * ipv4MissRatio);

	return { ipv4, ipv6: missCount - ipv4 };
}

function pushMissQueries (queries, random, missGuard, missCounts) {
	for (let index = 0; index < missCounts.ipv4; index++) {
		queries.push(makeRandomMissAddress(random, missGuard, 'ipv4'));
	}

	for (let index = 0; index < missCounts.ipv6; index++) {
		queries.push(makeRandomMissAddress(random, missGuard, 'ipv6'));
	}
}

function countQueryFamilies (queries) {
	let ipv4 = 0;
	let ipv6 = 0;

	for (const query of queries) {
		if (query.startsWith('::ffff:')) {
			ipv4++;
		} else {
			ipv6++;
		}
	}

	return { ipv4, ipv6 };
}

function shuffle (items, random) {
	for (let index = items.length - 1; index > 0; index--) {
		const swapIndex = Math.floor(random() * (index + 1));
		const value = items[index];
		items[index] = items[swapIndex];
		items[swapIndex] = value;
	}
}

function makePresentQueries (prefixes, total) {
	return Array.from({ length: total }, (_, index) => prefixes[index % prefixes.length].address);
}

function makeMissingQueries (total, seed, missGuard, ipv4MissRatio) {
	const random = createRandom(seed);
	const queries = [];
	const missCounts = getMissCounts(total, ipv4MissRatio);

	pushMissQueries(queries, random, missGuard, missCounts);
	shuffle(queries, random);

	return { queries, counts: countQueryFamilies(queries) };
}

function makeLargeQuerySet (profile, prefixes, total, missingPool, random) {
	const missCount = Math.round(total * profile.missRate);
	const hitCount = total - missCount;
	const missingQueries = missingPool.slice(0, missCount);
	const queries = [
		...makePresentQueries(prefixes, hitCount),
		...missingQueries,
	];

	shuffle(queries, random);

	return {
		name: profile.name,
		queries,
		expectedHits: hitCount,
		missCount,
		missCounts: countQueryFamilies(missingQueries),
	};
}

function makeInterleavedProfileQueries (profile, chunks, checksPerChunk, missingPool, random) {
	const queries = [];
	let importedPrefixes = [];
	let expectedHits = 0;
	let missCount = 0;
	let missingIndex = 0;
	const missingQueries = [];

	for (const chunk of chunks) {
		importedPrefixes = [ ...importedPrefixes, ...chunk ];

		const chunkMisses = Math.round(checksPerChunk * profile.missRate);
		const chunkHits = checksPerChunk - chunkMisses;
		const chunkQueries = [];

		for (let index = 0; index < chunkHits; index++) {
			const prefix = importedPrefixes[Math.floor(random() * importedPrefixes.length)];
			chunkQueries.push(prefix.address);
		}

		const chunkMissingQueries = missingPool.slice(missingIndex, missingIndex + chunkMisses);
		chunkQueries.push(...chunkMissingQueries);
		missingQueries.push(...chunkMissingQueries);
		missingIndex += chunkMisses;

		shuffle(chunkQueries, random);
		queries.push(...chunkQueries);
		expectedHits += chunkHits;
		missCount += chunkMisses;
	}

	return {
		name: profile.name,
		queries,
		expectedHits,
		missCount,
		missCounts: countQueryFamilies(missingQueries),
	};
}

function getQueryProfiles (options) {
	const profiles = [
		{ name: 'present', missRate: 0 },
		{ name: 'missing', missRate: 1 },
		{ name: 'mixed', missRate: options.mixedMissRate },
	];

	return options.queryProfile === 'all' ? profiles : profiles.filter(profile => profile.name === options.queryProfile);
}

function getMaxMissCount (profiles, total) {
	return Math.max(...profiles.map(profile => Math.round(total * profile.missRate)));
}

function prepareQuerySets (prefixes, chunks, missGuard, sourcePrefixCounts, options) {
	const profiles = getQueryProfiles(options);
	const ipv4MissRatio = sourcePrefixCounts.ipv4 / prefixes.length;
	const largeMissingCount = getMaxMissCount(profiles, options.largeChecks);
	const interleavedTotalChecks = chunks.length * options.checksPerChunk;
	const interleavedMissingCount = chunks.reduce((sum) => {
		const chunkMisses = getMaxMissCount(profiles, options.checksPerChunk);

		return sum + chunkMisses;
	}, 0);

	const largeMissing = makeMissingQueries(largeMissingCount, 0x12345678, missGuard, ipv4MissRatio);
	const interleavedMissing = makeMissingQueries(interleavedMissingCount, 0x87654321, missGuard, ipv4MissRatio);
	const large = profiles.map((profile, index) => makeLargeQuerySet(
		profile,
		prefixes,
		options.largeChecks,
		largeMissing.queries,
		createRandom(0xabcdef01 + index),
	));
	const interleaved = profiles.map((profile, index) => makeInterleavedProfileQueries(
		profile,
		chunks,
		options.checksPerChunk,
		interleavedMissing.queries,
		createRandom(0x10203040 + index),
	));

	return {
		profiles: profiles.map(profile => profile.name),
		large,
		interleaved,
		interleavedTotalChecks,
	};
}

function makeChunks (prefixes, chunkCount) {
	const chunks = [];
	const chunkSize = Math.ceil(prefixes.length / chunkCount);

	for (let index = 0; index < prefixes.length; index += chunkSize) {
		chunks.push(prefixes.slice(index, index + chunkSize));
	}

	return chunks;
}

function runLargeScenario (impl, prefixes, querySets) {
	const list = impl.create();

	const imported = time(() => {
		for (const prefix of prefixes) {
			impl.addSubnet(list, prefix);
		}
	});

	const checks = {};

	for (const querySet of querySets) {
		const checked = time(() => {
			let hits = 0;

			for (const query of querySet.queries) {
				if (impl.check(list, query)) {
					hits++;
				}
			}

			return hits;
		});

		checks[querySet.name] = {
			ms: checked.ms,
			hits: checked.result,
			expectedHits: querySet.expectedHits,
			missCount: querySet.missCount,
			missCounts: querySet.missCounts,
		};
	}

	return { importMs: imported.ms, checks };
}

function runInterleavedScenario (impl, chunks, querySet, checksPerChunk) {
	const list = impl.create();
	let queryIndex = 0;

	const measured = time(() => {
		let hits = 0;

		for (const chunk of chunks) {
			for (const prefix of chunk) {
				impl.addSubnet(list, prefix);
			}

			for (let index = 0; index < checksPerChunk; index++) {
				const query = querySet.queries[queryIndex];
				queryIndex++;

				if (impl.check(list, query)) {
					hits++;
				}
			}
		}

		return hits;
	});

	return {
		totalMs: measured.ms,
		hits: measured.result,
		expectedHits: querySet.expectedHits,
		missCount: querySet.missCount,
		missCounts: querySet.missCounts,
	};
}

function createProfileMap (querySets) {
	return Object.fromEntries(querySets.map(querySet => [ querySet.name, {
		checks: querySet.queries.length,
		expectedHits: querySet.expectedHits,
		misses: querySet.missCount,
		missCounts: querySet.missCounts,
	}]));
}

function benchmarkOne (name, impl, prefixes, sourcePrefixCounts, chunks, querySets, options) {
	const largeImport = [];
	const largeChecks = Object.fromEntries(querySets.large.map(querySet => [ querySet.name, [] ]));
	const interleaved = Object.fromEntries(querySets.interleaved.map(querySet => [ querySet.name, [] ]));
	const largeHits = {};
	const interleavedHits = {};

	for (let run = 0; run < options.warmups + options.runs; run++) {
		globalThis.gc?.();
		const large = runLargeScenario(impl, prefixes, querySets.large);

		const mixedResults = {};

		for (const querySet of querySets.interleaved) {
			globalThis.gc?.();
			mixedResults[querySet.name] = runInterleavedScenario(impl, chunks, querySet, options.checksPerChunk);
		}

		for (const [ profile, result ] of Object.entries(large.checks)) {
			if (result.hits !== result.expectedHits) {
				throw new Error(`${name} ${profile} large lookup hit count mismatch: expected ${result.expectedHits}, got ${result.hits}`);
			}
		}

		for (const [ profile, result ] of Object.entries(mixedResults)) {
			if (result.hits !== result.expectedHits) {
				throw new Error(`${name} ${profile} interleaved hit count mismatch: expected ${result.expectedHits}, got ${result.hits}`);
			}
		}

		if (run >= options.warmups) {
			largeImport.push(large.importMs);

			for (const [ profile, result ] of Object.entries(large.checks)) {
				largeChecks[profile].push(result.ms);
				largeHits[profile] = result.hits;
			}

			for (const [ profile, result ] of Object.entries(mixedResults)) {
				interleaved[profile].push(result.totalMs);
				interleavedHits[profile] = result.hits;
			}
		}
	}

	return {
		name,
		prefixCount: prefixes.length,
		sourcePrefixCounts,
		queryProfiles: querySets.profiles,
		largeProfiles: createProfileMap(querySets.large),
		chunkCount: chunks.length,
		checksPerChunk: options.checksPerChunk,
		interleavedProfiles: createProfileMap(querySets.interleaved),
		largeHits,
		interleavedHits,
		largeImport: summarize(largeImport),
		largeCheck: Object.fromEntries(Object.entries(largeChecks).map(([ profile, values ]) => [ profile, summarize(values) ])),
		interleaved: Object.fromEntries(Object.entries(interleaved).map(([ profile, values ]) => [ profile, summarize(values) ])),
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
	printUsage(console.error);
	process.exit(1);
}

const hasGarbageCollector = ensureGarbageCollector();
let ipv4Prefixes;
let ipv6Prefixes;
const results = [];

try {
	ipv4Prefixes = loadPrefixes(options.ipv4File, 'ipv4');
	ipv6Prefixes = loadPrefixes(options.ipv6File, 'ipv6');
} catch (error) {
	console.error(error.message);
	process.exit(1);
}

const prefixes = [ ...ipv4Prefixes, ...ipv6Prefixes ];
const chunks = makeChunks(prefixes, options.chunks);
const sourcePrefixCounts = {
	ipv4: ipv4Prefixes.length,
	ipv6: ipv6Prefixes.length,
};
const missGuard = createMissGuard(prefixes);
const querySets = prepareQuerySets(prefixes, chunks, missGuard, sourcePrefixCounts, options);

for (const [ name, impl ] of getPackageEntries(options.packageName)) {
	if (options.verbose) {
		console.error(`Running ${name}...`);
	}

	results.push(benchmarkOne(name, impl, prefixes, sourcePrefixCounts, chunks, querySets, options));
}

if (!hasGarbageCollector) {
	console.error('Tip: run with --expose-gc to reduce cross-run heap noise.');
}

console.log(JSON.stringify({
	settings: {
		node: process.version,
		platform: `${process.platform} ${process.arch}`,
		cpu: cpus()[0]?.model,
		files: {
			ipv4: options.ipv4File,
			ipv6: options.ipv6File,
		},
		package: options.packageName,
		runs: options.runs,
		warmups: options.warmups,
		largeChecks: options.largeChecks,
		chunks: options.chunks,
		checksPerChunk: options.checksPerChunk,
		queryProfile: options.queryProfile,
		mixedMissRate: options.mixedMissRate,
	},
	results,
}, null, '\t'));
