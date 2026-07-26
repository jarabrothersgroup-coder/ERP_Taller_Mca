import "@testing-library/jest-dom/vitest";

// Enable mock data fallback globally (must be set before data-service module is evaluated)
process.env["NEXT_PUBLIC_ENABLE_MOCKS"] = "true";

// Mock window.matchMedia for components that use it (e.g., theme toggles)
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock window.getComputedStyle (used by some shadcn components)
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
  const style = originalGetComputedStyle(elt, pseudoElt);
  return style;
};

// Silence console.error/warn during tests (uncomment if noisy)
// const originalError = console.error;
// console.error = (...args: unknown[]) => {
//   if (typeof args[0] === "string" && args[0].includes("Warning:")) return;
//   originalError.call(console, ...args);
// };
