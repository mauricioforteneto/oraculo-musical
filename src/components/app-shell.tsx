"use client";

import { useEffect, useRef } from "react";
import { SeasonLink as Link, SeasonProvider, SeasonSwitcher, useSeason } from "./season-context";
import { usePathname } from "next/navigation";
import { AudioLines, LibraryBig, Trophy, GitBranch, MoreHorizontal, BarChart3, History, RefreshCw, ClipboardList, BookOpen, LogOut, X } from "lucide-react";
import { Brand } from "./brand";
import { ThemeSwitcher } from "./theme-switcher";
import styles from "./app-shell.module.css";

const primary = [
  { href: "/", label: "Início", icon: AudioLines },
  { href: "/albuns", label: "Álbuns", icon: LibraryBig },
  { href: "/top-50", label: "Top 50", icon: Trophy },
  { href: "/playoffs", label: "Playoffs", icon: GitBranch },
];
const secondary = [
  { href: "/regras", label: "Regras da temporada", icon: BookOpen },
  { href: "/pendencias", label: "Pendências", icon: ClipboardList },
  { href: "/estatisticas", label: "Estatísticas", icon: BarChart3 },
  { href: "/historico", label: "Histórico de versões", icon: History },
  { href: "/sincronizacao", label: "Sincronização", icon: RefreshCw },
];
export function activeDestination(path: string | null) {
  return path?.startsWith("/albuns/") ? "/albuns" : path ?? "/";
}
type AppShellProps = { children: React.ReactNode; title: string; description?: string; version?: string | number | null; localPreview?: boolean; headingClassName?: string; season?: number; publicationLabel?: string };
export function AppShell(props: AppShellProps) {
  return <SeasonProvider year={props.season}><AppShellContent key={props.season} {...props} /></SeasonProvider>;
}
function AppShellContent({ children, title, description, version, localPreview = false, headingClassName, publicationLabel }: AppShellProps) {
  const { year } = useSeason();
  const pathname = usePathname();
  const active = activeDestination(pathname);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const previousOverflow = useRef<string | null>(null);
  function unlock() {
    if (previousOverflow.current !== null) document.body.style.overflow = previousOverflow.current;
    previousOverflow.current = null;
  }
  function closeMenu() { dialog.current?.close(); unlock(); }
  function openMenu() {
    if (!dialog.current || dialog.current.open) return;
    previousOverflow.current = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current.showModal();
  }
  useEffect(() => {
    dialog.current?.close();
    if (previousOverflow.current !== null) document.body.style.overflow = previousOverflow.current;
    previousOverflow.current = null;
    return () => {
      if (previousOverflow.current !== null) document.body.style.overflow = previousOverflow.current;
      previousOverflow.current = null;
    };
  }, [pathname, year]);
  function navigation(items: typeof primary, mobile = false) {
    return items.map(item => <Link key={item.href} href={item.href} aria-current={active === item.href ? "page" : undefined}
      className={mobile ? styles.mobileItem : styles.navItem} onClick={closeMenu}>
      <item.icon size={19} aria-hidden="true" /><span>{item.label}</span>
    </Link>);
  }
  return <div className={styles.shell}>
    <a href="#conteudo" className={styles.skip}>Ir para o conteúdo</a>
    <header className={styles.topbar}>
      <Link href="/" className={styles.brand} aria-label="Oráculo Musical, início"><Brand /></Link>
      <span className={styles.desktopCaption}>Minha escuta em {year}</span>
      <span className={styles.version}><span className={styles.mobileSeason}>{year}</span>{publicationLabel ?? (localPreview ? "Prévia local" : "Fonte")}{publicationLabel ? "" : version != null ? ` v${version}` : " sem publicação"}</span>
    </header>
    <div className={styles.frame}>
    <aside className={styles.sidebar}>
      <nav aria-label="Navegação principal" className={styles.nav}>{navigation(primary)}{navigation(secondary)}</nav>
      <div className={styles.sidebarFoot}><SeasonSwitcher /><ThemeSwitcher /><span>Acervo privado</span><form action="/auth/logout" method="post"><button type="submit" className={styles.navItem}><LogOut size={18} aria-hidden="true" />Sair</button></form></div>
    </aside>
    <div className={styles.workspace}>
      <main id="conteudo" className={styles.content}>
        <div className={[styles.heading, headingClassName].filter(Boolean).join(" ")}><h1>{title}</h1>{description && <p>{description}</p>}</div>
        {children}
      </main>
      <footer className={styles.footer}>Oráculo Musical {year} <span>{publicationLabel ?? (version != null ? `Publicação v${version}` : "Aguardando publicação")}</span></footer>
    </div>
    </div>
    <nav className={styles.mobileNav} aria-label="Navegação mobile">
      {navigation(primary, true)}
      <button ref={trigger} type="button" className={styles.mobileItem} aria-haspopup="dialog" aria-controls="mais-menu"
        aria-current={secondary.some(item => item.href === active) ? "page" : undefined} onClick={openMenu}>
        <MoreHorizontal size={21} aria-hidden="true" /><span>Mais</span>
      </button>
    </nav>
    <dialog id="mais-menu" ref={dialog} className={styles.dialog} aria-labelledby="mais-title" onCancel={unlock}
      onClose={() => { unlock(); trigger.current?.focus(); }} onKeyDown={event => {
        if (event.key !== "Tab") return;
        const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
        const first = controls[0]; const last = controls.at(-1);
        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }} onClick={event => { if (event.target === event.currentTarget) closeMenu(); }}>
      <div className={styles.dialogBody}>
        <div className={styles.dialogHeading}><h2 id="mais-title">Mais do Oráculo</h2><button type="button" aria-label="Fechar menu" onClick={closeMenu}><X size={22} aria-hidden="true" /></button></div>
        <nav aria-label="Mais páginas" className={styles.nav}>{navigation(secondary)}</nav>
        <SeasonSwitcher />
        <ThemeSwitcher />
        <form action="/auth/logout" method="post"><button className={styles.navItem} type="submit"><LogOut size={19} aria-hidden="true" />Sair</button></form>
      </div>
    </dialog>
  </div>;
}
