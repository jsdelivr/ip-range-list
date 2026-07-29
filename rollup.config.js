import nodeResolve from '@rollup/plugin-node-resolve';
import { dts } from 'rollup-plugin-dts';

export default [
	{
		input: 'dist/esm/index.js',
		output: [
			{
				file: 'dist/cjs/bundle.cjs',
				format: 'cjs',
				exports: 'named',
				sourcemap: true,
			},
			{
				name: 'ipRangeList',
				file: 'dist/umd/bundle.js',
				format: 'umd',
				exports: 'named',
				sourcemap: true,
			},
		],
		plugins: [
			nodeResolve(),
		],
	},
	{
		input: 'dist/esm/index.d.ts',
		output: [
			{
				file: 'dist/cjs/bundle.d.cts',
				format: 'es',
			},
			{
				file: 'dist/umd/bundle.d.ts',
				format: 'es',
				banner: 'export as namespace ipRangeList;',
			},
		],
		plugins: [
			dts(),
		],
	},
];
