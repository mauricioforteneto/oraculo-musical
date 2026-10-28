"use client";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import styles from "@/components/workspace.module.css";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <AppShell title="Não foi possível carregar esta página"><section className={styles.card} role="alert"><p>Tente novamente em alguns instantes. A última publicação permanece preservada.</p><div className={styles.actions}><button type="button" className={styles.action} onClick={reset}>Tentar novamente</button><Link className={styles.action} href="/">Voltar ao início</Link></div></section></AppShell>;
}
