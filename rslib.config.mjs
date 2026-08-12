import { defineConfig } from '@rslib/core'

// Types are handwritten (src/index.d.ts) since the source is plain JS —
// copied into dist as-is.
const copyTypes = {
  copy: [{ from: './src/index.d.ts', to: 'index.d.ts' }],
}

export default defineConfig({
  source: {
    entry: { index: './src/pptxtojson.js' },
  },
  output: {
    target: 'web',
    sourceMap: true,
  },
  lib: [
    {
      format: 'esm',
      syntax: 'es2020',
      output: {
        distPath: { root: 'dist' },
        filename: { js: 'index.js' },
        ...copyTypes,
      },
    },
    {
      format: 'cjs',
      syntax: 'es2020',
      output: {
        distPath: { root: 'dist' },
        filename: { js: 'index.cjs' },
      },
    },
    {
      // Self-contained browser bundle (script tag usage) — deps inlined.
      format: 'umd',
      umdName: 'pptxtojson',
      syntax: 'es2020',
      autoExternal: false,
      output: {
        distPath: { root: 'dist' },
        filename: { js: 'index.umd.js' },
        minify: true,
      },
    },
  ],
})
