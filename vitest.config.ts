import { defineConfig } from 'vitest/config';

/**
 * Test-runner config for the Angular unit-test builder.
 *
 * `@hugeicons/angular` ships no `exports` map and its `main` points at
 * `dist/bundles/hugeicons-angular.umd.js`, which is not in the published package. The app bundler
 * picks `module` and never notices; Node's resolver follows `main` and fails, which took down every
 * suite that renders a component using an icon — the whole app shell, since the bottom bar has them.
 * Pointing at the ESM bundle that IS shipped is the smallest fix that keeps both resolvers working.
 */
export default defineConfig({
  test: {
    server: {
      // The alias below only reaches code Vite processes. @zouriel/ui is a node_module and would be
      // externalized to Node's own resolver, which is the resolver that cannot find the UMD file.
      deps: { inline: [/@zouriel\/ui/, /@hugeicons\/angular/] },
    },
  },
  resolve: {
    alias: {
      '@hugeicons/angular': new URL(
        './node_modules/@hugeicons/angular/dist/fesm2022/hugeicons-angular.mjs',
        import.meta.url,
      ).pathname,
    },
  },
});
