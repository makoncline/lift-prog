import "@testing-library/jest-dom";
import { vi } from "vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));
vi.mock("@/server/auth/app-user", () => ({
  resolveAppUserIdForAuthUser: vi.fn(),
}));

class ResizeObserverMock {
  constructor(private callback: ResizeObserverCallback) {}

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          contentRect: {
            x: 0,
            y: 0,
            top: 0,
            right: 320,
            bottom: 48,
            left: 0,
            width: 320,
            height: 48,
            toJSON: () => ({}),
          },
        } as unknown as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }

  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??=
  ResizeObserverMock as unknown as typeof ResizeObserver;

// Mock the next/navigation hooks
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "",
}));

// Automatically clean up after each test
afterEach(() => {
  cleanup();
});

// Add any global mocks or test configurations here
