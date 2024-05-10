import json from '@rollup/plugin-json'

/** @type {import('rollup').RollupOptions} */
export default {
    input: './src/extension.js',
    output: {
        file: './dist/extension.js',
        format: 'cjs'
    },
    plugins: [json]
}