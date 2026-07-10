import { assert } from 'chai';
import { describe, it } from 'mocha';
import { IPRangeList } from '../../../src/index.js';
import { snapshot } from '../../utils/shared.js';

describe('IPRangeList ranges', () => {
	it('should return detached canonical snapshots', () => {
		const ranges = new IPRangeList();

		assert.strictEqual(ranges.addAddress('192.0.2.1'), ranges);
		assert.strictEqual(ranges.addSubnet('2001:db8::1/128'), ranges);
		assert.strictEqual(ranges.addRange('192.0.2.2', '192.0.2.3'), ranges);

		const previous = ranges.ranges;
		previous.push({ start: 'changed', end: 'changed' });
		previous[0]!.start = 'changed';
		ranges.addAddress('192.0.2.4');

		assert.deepEqual(snapshot(previous), [
			{ start: 'changed', end: '::ffff:192.0.2.3' },
			{ start: '2001:db8::1', end: '2001:db8::1' },
			{ start: 'changed', end: 'changed' },
		]);

		assert.deepEqual(snapshot(ranges.ranges), [
			{ start: '::ffff:192.0.2.1', end: '::ffff:192.0.2.4' },
			{ start: '2001:db8::1', end: '2001:db8::1' },
		]);
	});

	it('should render canonical IPv6 output', () => {
		const ranges = new IPRangeList()
			.addAddress('2001:0DB8:0:0:0:0:0:1')
			.addAddress('2001:0:0:1:0:0:1:1')
			.addAddress('2001:db8:0:1:2:3:4:5');

		assert.equal(ranges.contains('2001:db8::1'), true);

		assert.deepEqual(snapshot(ranges.ranges), [
			{ start: '2001::1:0:0:1:1', end: '2001::1:0:0:1:1' },
			{ start: '2001:db8::1', end: '2001:db8::1' },
			{ start: '2001:db8:0:1:2:3:4:5', end: '2001:db8:0:1:2:3:4:5' },
		]);
	});
});
