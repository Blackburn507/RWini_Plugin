import json from '@rollup/plugin-json'
import nodeResolve from '@rollup/plugin-node-resolve'

/** @type {import('rollup').RollupOptions} */
export default {
    input: './src/extension.js',
    output: {
        file: './dist/extension.js',
        format: 'cjs'
    },
    external: [
        'vscode'
    ],
    plugins: [json(), nodeResolve()]
}