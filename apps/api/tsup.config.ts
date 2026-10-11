import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node22',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  // The shared package is consumed as TypeScript source, so bundle it into the API build.
  noExternal: ['@growth/shared'],
});
