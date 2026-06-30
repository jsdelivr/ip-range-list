import { defineConfig } from 'eslint/config';
import typescript from '@martin-kolarik/eslint-config/typescript.js';

export default defineConfig([
	{
		ignores: [
			'dist/**',
			'node_modules/**',
			'package-lock.json',
		],
	},
	...typescript,
	{
		files: [ 'src/**/*.ts' ],
		rules: {
			'no-bitwise': 'off',
		},
	},
]);
