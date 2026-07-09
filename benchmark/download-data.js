import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const benchmarkDir = dirname(fileURLToPath(import.meta.url));

const sources = [
	{
		url: 'https://download.jsdelivr.com/LACES_ANYCAST_IPV4.csv.gz',
		output: join(benchmarkDir, 'ipv4-ranges.csv'),
	},
	{
		url: 'https://download.jsdelivr.com/LACES_ANYCAST_IPV6.csv.gz',
		output: join(benchmarkDir, 'ipv6-ranges.csv'),
	},
];

function parseFirstCsvField (line) {
	if (!line.startsWith('"')) {
		return line.split(',', 1)[0] ?? '';
	}

	let field = '';

	for (let index = 1; index < line.length; index++) {
		const character = line[index];

		if (character !== '"') {
			field += character;
			continue;
		}

		if (line[index + 1] === '"') {
			field += '"';
			index++;
			continue;
		}

		break;
	}

	return field;
}

async function downloadPrefixes ({ url, output }) {
	mkdirSync(dirname(output), { recursive: true });

	const response = await fetch(url);

	if (!response.ok || response.body === null) {
		throw new Error(`Failed to download ${url}: ${response.status} ${response.statusText}`);
	}

	const body = Buffer.from(await response.arrayBuffer());
	const content = (body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body).toString('utf8');
	const prefixes = [ 'prefix' ];

	for (const line of content.split(/\r?\n/)) {
		const prefix = parseFirstCsvField(line).trim();

		if (prefix === '' || prefix.toLowerCase() === 'prefix') {
			continue;
		}

		prefixes.push(prefix);
	}

	writeFileSync(output, `${prefixes.join('\n')}\n`);

	console.log(`Saved ${(prefixes.length - 1).toLocaleString('en-US')} prefixes to ${output}`);
}

try {
	for (const source of sources) {
		await downloadPrefixes(source);
	}
} catch (error) {
	console.error(error.message);
	process.exit(1);
}
