import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest does not run with `globals: true`, so React Testing Library cannot register
// its own automatic cleanup. Without this, each `render` leaves the previous tree
// mounted and later queries match stale duplicates.
afterEach(cleanup);

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock;

// jsdom does not implement matchMedia, which ThemeProvider uses to follow the OS
// colour scheme. The theme helpers tolerate its absence, but stubbing it keeps the
// tests exercising the real code path rather than the fallback.
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// jsdom implements neither the Pointer Capture API nor scrollIntoView, both of which
// Radix primitives (Select, Tabs, AlertDialog) call while opening.
Element.prototype.scrollIntoView = function scrollIntoView() {};
Element.prototype.hasPointerCapture = function hasPointerCapture() {
  return false;
};
Element.prototype.setPointerCapture = function setPointerCapture() {};
Element.prototype.releasePointerCapture = function releasePointerCapture() {};
