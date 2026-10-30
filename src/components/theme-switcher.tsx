"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-init.mjs";
import styles from "./theme-switcher.module.css";

type Preference = "light" | "dark" | "system";
const preference = (value: string | null | undefined): Preference => value === "light" || value === "dark" ? value : "system";
const snapshot = () => preference(document.documentElement.dataset.themePreference);
const serverSnapshot = (): Preference => "system";

function apply(value: Preference) {
  const root = document.documentElement;
  const mode = value === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : value;
  root.dataset.themePreference = value;
  root.dataset.mode = mode;
  root.classList.toggle("dark", mode === "dark");
  window.dispatchEvent(new Event("oraculo:theme"));
}

function subscribe(notify: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const systemChange = () => { if (snapshot() === "system") apply("system"); };
  const storageChange = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) apply(preference(event.newValue));
  };
  window.addEventListener("oraculo:theme", notify);
  window.addEventListener("storage", storageChange);
  media.addEventListener("change", systemChange);
  return () => {
    window.removeEventListener("oraculo:theme", notify);
    window.removeEventListener("storage", storageChange);
    media.removeEventListener("change", systemChange);
  };
}

export function ThemeSwitcher() {
  const id = useId();
  const value = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  const [temporary, setTemporary] = useState(false);
  return <div className={styles.control}>
    <label htmlFor={id}>Tema</label>
    <select id={id} value={value} aria-describedby={temporary ? `${id}-notice` : undefined} onChange={event => {
      const next = preference(event.target.value);
      apply(next);
      try { localStorage.setItem(THEME_STORAGE_KEY, next); setTemporary(false); }
      catch { setTemporary(true); }
    }}>
      <option value="system">Seguir o sistema</option>
      <option value="light">Claro</option>
      <option value="dark">Escuro</option>
    </select>
    {temporary && <p id={`${id}-notice`} role="status">Tema aplicado nesta página. O navegador não permitiu salvar a preferência.</p>}
  </div>;
}
