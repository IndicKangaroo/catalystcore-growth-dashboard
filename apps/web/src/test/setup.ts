import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// jsdom has no ResizeObserver, which the charts use to follow the width of their card. A chart that
// never gets a size draws nothing, so tests check the numbers around and beneath it instead.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub;

afterEach(() => {
  cleanup();
  // Restore the real storage and clock before anything below uses them.
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
