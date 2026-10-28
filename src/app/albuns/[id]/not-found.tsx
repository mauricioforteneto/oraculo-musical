import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import styles from "@/components/workspace.module.css";
export default function AlbumNotFound() {
  return <AppShell title="Álbum não encontrado"><section className={styles.card}><p>Este álbum não está disponível na fonte configurada.</p><Link className={styles.action} href="/albuns">Voltar aos álbuns</Link></section></AppShell>;
}
