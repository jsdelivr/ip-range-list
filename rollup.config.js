import nodeResolve from '@rollup/plugin-node-resolve';

export default {
	input: 'dist/esm/index.js',
	output: [
		{
			file: 'dist/cjs/bundle.cjs',
			format: 'cjs',
			exports: 'named',
			sourcemap: true,
		},
		{
			name: 'IPRangeList',
			file: 'dist/umd/bundle.js',
			format: 'umd',
			exports: 'named',
			sourcemap: true,
		},
	],
	plugins: [
		nodeResolve(),
	],
};
