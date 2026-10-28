// Browser-only router adapter. Production authorization is exercised separately.
import { useSyncExternalStore } from "react";
import type { AnchorHTMLAttributes } from "react";
const event = "fixture-navigation";
const notify = () => window.dispatchEvent(new Event(event));
for (const method of ["pushState", "replaceState"] as const) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (...args) => { original(...args); notify(); };
}
const subscribe = (fn: () => void) => { window.addEventListener(event, fn); window.addEventListener("popstate", fn); return () => { window.removeEventListener(event, fn); window.removeEventListener("popstate", fn); }; };
export const usePathname = () => useSyncExternalStore(subscribe, () => location.pathname);
export const useSearchParams = () => new URLSearchParams(useSyncExternalStore(subscribe, () => location.search));
const router = { push: (url: string) => history.pushState(null,"",url), replace: (url: string) => history.replaceState(null,"",url), refresh: () => { window.dispatchEvent(new Event("fixture-refresh")); } };
export const useRouter = () => router;
export default function Link({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={href} onClick={e => { onClick?.(e); if (!e.defaultPrevented && href?.startsWith("/") && !e.metaKey && !e.ctrlKey) { e.preventDefault(); router.push(href); } }} />;
}
