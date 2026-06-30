import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import module from 'node:module';
import { after, before, describe, it } from 'node:test';

const require = module.createRequire(import.meta.url);
const packageName = 'ip-range-list';
const packageDirectory = path.resolve(import.meta.dirname, `../node_modules/${packageName}`);

describe('dist', () => {
	before(() => {
		fs.cpSync(path.resolve(import.meta.dirname, '../package.json'), path.join(packageDirectory, 'package.json'), { recursive: true });
		fs.cpSync(path.resolve(import.meta.dirname, '../dist'), path.join(packageDirectory, 'dist'), { recursive: true });
	});

	after(() => {
		fs.rmSync(packageDirectory, { recursive: true, force: true });
	});

	describe('esm', () => {
		it('loads and works', async () => {
			const { IPRangeList } = await import(packageName);
			const ranges = new IPRangeList().addSubnet('192.0.2.9/24');

			assert.ok(IPRangeList);
			assert.ok(ranges.contains('192.0.2.0'));
			assert.ok(!ranges.contains('192.0.3.0'));
		});
	});

	describe('cjs', () => {
		it('loads and works', () => {
			const { IPRangeList } = require(packageName);
			const ranges = new IPRangeList().addSubnet('192.0.2.9/24');

			assert.ok(IPRangeList);
			assert.ok(ranges.contains('192.0.2.0'));
			assert.ok(!ranges.contains('192.0.3.0'));
		});
	});
});
