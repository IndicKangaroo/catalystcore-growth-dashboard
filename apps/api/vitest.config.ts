import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // The sign-in tests need the Firebase emulators. `npm run test:emulator` starts them and runs
    // that file with vitest.emulator.config.ts, so nothing here is skipped silently.
    exclude: [...configDefaults.exclude, 'src/emulator.test.ts'],
  },
});
