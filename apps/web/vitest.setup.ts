import "@testing-library/jest-dom";
import { vi } from "vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

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
