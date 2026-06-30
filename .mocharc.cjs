module.exports = {
	'timeout': 10_000,
	'spec': [
		'test/unit/**/*.ts',
	],
	'node-option': [
		'enable-source-maps',
		'import=tsx',
	],
};
