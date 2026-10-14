import { defineConfig } from 'vitest/config';

// Only the tests that need the Firebase emulators. `npm run test:emulator` (in the repository root)
// starts the emulators and then runs this configuration.
export default defineConfig({
  test: {
    include: ['src/emulator.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
