"use client";
import { createContext, useCallback, useContext, useMemo, useId, type ReactNode } from "react";
import { useSearchParams, usePathname, useRouter } from "next/navigation";
import NextLink from "next/link";
import { SEASONS, seasonHref } from "@/lib/seasons/definitions";
import styles from "./theme-switcher.module.css";
import { artworkPost } from "@/lib/artwork/messages";

const Context = createContext<{year:number;explicit:boolean} | null>(null);
export function SeasonProvider({ year, children }: { year?: number; children: ReactNode }) {
  const params = useSearchParams();
  const raw = params?.get("temporada") ?? null;
  const value = useMemo(() => ({ year: year ?? (raw === "2027" ? 2027 : 2026), explicit: raw !== null || (year != null && year !== 2026) }), [year, raw]);
  return <Context value={value}>{children}</Context>;
}
export function useSeason() {
  const context = useContext(Context);
  const params = useSearchParams();
  return context ?? { year: params?.get("temporada") === "2027" ? 2027 : 2026, explicit: params?.has("temporada") ?? false };
}
export function SeasonLink({ href, ...props }: React.ComponentProps<typeof NextLink>) {
  const { year, explicit } = useSeason();
  return <NextLink {...props} href={typeof href === "string" ? seasonHref(href, year, explicit) : href} />;
}
export function useSeasonFetch(override?: number) {
  const { year } = useSeason();
  return useCallback((href: string, init?: RequestInit) => fetch(seasonHref(href, override ?? year), init), [override, year]);
}
export function useArtworkPost() {
  const {year} = useSeason();
  return useCallback(<T,>(href:string, body:Record<string,unknown>, signal?:AbortSignal) => artworkPost<T>(seasonHref(href,year),body,signal),[year]);
}
export function SeasonSwitcher() {
  const id=useId();
  const { year } = useSeason();
  const pathname = usePathname();
  const router = useRouter();
  return <div className={styles.control}><label htmlFor={id}>Temporada</label><select id={id} value={year} onChange={event => {
    const path = pathname?.startsWith("/albuns/") ? "/albuns" : pathname ?? "/";
    router.push(seasonHref(path, Number(event.target.value)));
  }}>{SEASONS.map(season => <option value={season.year} key={season.year}>{season.year}</option>)}</select></div>;
}
