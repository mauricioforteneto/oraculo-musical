import { vi } from "vitest";
// Unit/server-service tests run outside Next's react-server condition.
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  notFound: () => { throw new Error("NEXT_NOT_FOUND"); },
  redirect: () => { throw new Error("NEXT_REDIRECT"); },
}));
