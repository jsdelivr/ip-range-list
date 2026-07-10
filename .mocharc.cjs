module.exports = {
	'timeout': 10_000,
	'spec': [
		'test/tests/unit/**/*.ts',
	],
	'node-option': [
		'enable-source-maps',
		'loader=ts-node/esm',
	],
};
