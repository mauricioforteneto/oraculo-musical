"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownRight,
  AudioLines,
  BarChart3,
  ChevronRight,
  CircleHelp,
  Disc3,
  Headphones,
  LibraryBig,
  ListMusic,
  LockKeyhole,
  LogOut,
  Search,
  Sparkles,
  Trophy,
} from "lucide-react";
import type { AlbumRecord, LocalSourcePreview } from "@/lib/catalog/types";
import { rankAnnualAlbums, recordKey, type RankedAlbum } from "@/lib/catalog/ranking";
import { parseSummaryNumber } from "@/lib/catalog/summary";
import styles from "./dashboard.module.css";
import { CompetitionPanel } from "./competition-panel";
import type { getCompetitionState } from "@/lib/competition/service";
import type { CompetitionPhaseHistory } from "@/lib/competition/history";

type ScoreFilter = "all" | "90" | "80" | "70";

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function scoreLabel(score: number | null) {
  return score === null ? "—" : score.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

function sourceNumberLabel(value: number) {
  return String(value).replace(".", ",");
}

function shortDate(value: string) {
  const date = new Date(value + "T12:00:00");
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });
}

function syncStatusLabel(status: "running" | "succeeded" | "unchanged" | "failed") {
  return status === "running" ? "Em andamento" : status === "succeeded" ? "Publicada" : status === "unchanged" ? "Sem alterações" : "Falhou";
}

function displayRank(value: number) {
  return String(value).padStart(2, "0");
}

function scoreDifference(a: AlbumRecord) {
  return a.reportedScore !== null && a.originalScore !== null && a.reportedScore !== a.originalScore;
}

export function Dashboard({ source, syncReady, localPreview, competition, competitionHistory }: { source: LocalSourcePreview | null; syncReady: boolean; localPreview: boolean; competition: Awaited<ReturnType<typeof getCompetitionState>> | null; competitionHistory: CompetitionPhaseHistory | null }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ScoreFilter>("all");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [shown, setShown] = useState(15);
  const [showAllBacklog, setShowAllBacklog] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState("");

  async function synchronize() {
    if (!syncReady || syncing) return;
    setSyncing(true);
    setSyncFeedback("");
    try {
      const response = await fetch("/api/sync", { method: "POST", credentials: "same-origin", headers: { Accept: "application/json" } });
      const result = await response.json() as { status?: string; version?: string; error?: string };
      if (!response.ok) {
        setSyncFeedback(`Falha na sincronização (${result.error ?? "SYNC_FAILED"}).`);
        router.refresh();
        return;
      }
      setSyncFeedback(result.status === "unchanged"
        ? `A versão ${result.version} já está publicada.`
        : `Versão ${result.version} publicada.`);
      router.refresh();
    } catch {
      setSyncFeedback("Não foi possível concluir a sincronização.");
    } finally {
      setSyncing(false);
    }
  }

  const albums = useMemo(() => rankAnnualAlbums(source?.albums ?? []), [source?.albums]);
  const selected = albums.find((album) => album.key === selectedKey) ?? albums[0] ?? null;
  const originalScores = albums.map((album) => album.originalScore).filter((score): score is number => score !== null);
  const average = originalScores.length ? originalScores.reduce((sum, score) => sum + score, 0) / originalScores.length : 0;
  const noteDifferences = albums.filter(scoreDifference).length;
  const count90 = originalScores.filter((score) => score >= 90).length;
  const sourceTop50Positions = albums.filter((album) => album.isPresent !== false && album.top50SourceRank !== null).length;
  const sourceAverage = parseSummaryNumber(source?.summary["Nota média"]);
  const sourceBacklog = parseSummaryNumber(source?.summary["Backlog atual"]);
  const hasBacklogDifference = sourceBacklog !== null && sourceBacklog !== (source?.backlog.length ?? 0);
  const filteredAlbums = albums.filter((album) => {
    const needle = normalize(query.trim());
    const matchesText = !needle || normalize([album.artist, album.title, album.genre, album.country].join(" ")).includes(needle);
    const score = album.originalScore ?? -1;
    const matchesScore = filter === "all" || score >= Number(filter);
    return matchesText && matchesScore;
  });
  const visibleAlbums = filteredAlbums.slice(0, shown);
  const backlog = source?.backlog ?? [];
  const visibleBacklog = showAllBacklog ? backlog : backlog.slice(0, 5);
  const histogram = [
    { label: "90–100", min: 90, max: 100 },
    { label: "80–89", min: 80, max: 89 },
    { label: "70–79", min: 70, max: 79 },
    { label: "60–69", min: 60, max: 69 },
    { label: "Abaixo de 60", min: 0, max: 59 },
  ].map((band) => ({ ...band, count: originalScores.filter((score) => score >= band.min && score <= band.max).length }));
  const maxBand = Math.max(...histogram.map((band) => band.count), 1);
  const topThree = albums.slice(0, 3);
  const dateLabel = source?.referenceDate ? shortDate(source.referenceDate) : source ? "Sem publicação válida" : "Sem arquivo local";
  const hasSummaryDifference = sourceAverage !== null && Math.abs(sourceAverage - average) > 0.005;
  const lastAttempt = source?.lastAttempt ?? null;
  const attemptHistory = source?.attemptHistory ?? [];
  const latestVersion = source?.version === null || source?.version === undefined ? null : String(source.version);
  const syncTitle = localPreview
    ? "Prévia local"
    : lastAttempt?.status === "running"
      ? "Sincronização em andamento"
      : lastAttempt?.status === "failed"
        ? latestVersion ? "Falha na última tentativa" : "Sem publicação válida"
        : latestVersion ? "Fonte sincronizada" : source ? "Fonte configurada" : "Fonte não carregada";
  const syncDescription = localPreview
    ? "Drive ainda não conectado"
    : lastAttempt?.status === "failed"
      ? latestVersion ? `Última publicação válida · v${latestVersion}` : "A tentativa mais recente não gerou uma publicação válida"
      : lastAttempt?.status === "running"
        ? latestVersion ? `Última publicação válida · v${latestVersion}` : "Ainda não há uma publicação válida"
        : latestVersion
          ? `Última versão publicada · v${latestVersion}${source?.publishedAt ? ` · ${dateTime(source.publishedAt)}` : ""}`
          : source ? "Aguardando a primeira sincronização" : "Aguardando a fonte de dados";
  const attemptCounts = lastAttempt ? [
    ["Novos", lastAttempt.counts.new],
    ["Alterados", lastAttempt.counts.changed],
    ["Sem mudança", lastAttempt.counts.unchanged],
    ["Ausentes", lastAttempt.counts.absent],
    ["Avisos", lastAttempt.counts.warnings],
    ["Erros", lastAttempt.counts.errors],
  ].filter(([, count]) => typeof count === "number" && count > 0) : [];
  const showSyncReport = lastAttempt && (lastAttempt.status === "failed" || lastAttempt.issues.length > 0);

  const filters: { id: ScoreFilter; label: string }[] = [
    { id: "all", label: "Todos" },
    { id: "90", label: "90+" },
    { id: "80", label: "80+" },
    { id: "70", label: "70+" },
  ];

  return (
    <div className={styles.appShell}>
      <aside className={styles.sidebar} aria-label="Navegação principal">
        <a className={styles.brand} href="#visao-geral" aria-label="Oráculo Musical, início">
          <span className={styles.brandMark}><Disc3 size={21} strokeWidth={1.45} aria-hidden="true" /></span>
          <span><strong>oráculo</strong><small>MUSICAL · 2026</small></span>
        </a>

        <div className={styles.navCaption}>ACERVO</div>
        <nav className={styles.navigation}>
          <a className={styles.navItem + " " + styles.navActive} href="#visao-geral" aria-current="page"><AudioLines size={17} aria-hidden="true" />Visão geral</a>
          <a className={styles.navItem} href="#acervo"><LibraryBig size={17} aria-hidden="true" />Álbuns <span className={styles.navCount}>{albums.length || "—"}</span></a>
          <Link className={styles.navItem} href="/estatisticas"><BarChart3 size={17} aria-hidden="true" />Estatísticas</Link>
          <a className={styles.navItem} href="#backlog"><ListMusic size={17} aria-hidden="true" />Backlog <span className={styles.navCount}>{source?.backlog.length ?? "—"}</span></a>
        </nav>

        <div className={styles.navCaption + " " + styles.navCaptionSpaced}>TEMPORADA</div>
        <nav className={styles.navigation} aria-label="Seções da temporada">
          <a className={styles.navItem} href="#top-50"><Trophy size={17} aria-hidden="true" />Top 50 <span className={styles.pendingDot}>Provisório</span></a>
          <a className={styles.navItem} href="#chaveamento"><Sparkles size={17} aria-hidden="true" />Chaveamento</a>
          <a className={styles.navItem} href="#historico-competitivo"><Trophy size={17} aria-hidden="true" />Histórico das fases</a>
        </nav>

        <div className={styles.sidebarBottom}>
          <div className={styles.sourceMini}>
            <div className={styles.sourceMiniIcon}><LockKeyhole size={15} aria-hidden="true" /></div>
            <div><strong>Fonte privada</strong><span>{source ? localPreview ? `Prévia local · v${source.version}` : latestVersion ? `Última publicação · v${latestVersion}` : "Sem publicação válida" : "Arquivo ainda não carregado"}</span></div>
            <span className={styles.statusDot} aria-label={localPreview ? "Prévia local" : lastAttempt?.status === "running" ? "Sincronização em andamento" : lastAttempt?.status === "failed" ? "Última tentativa falhou" : latestVersion ? "Publicação válida disponível" : "Sem publicação válida"} />
          </div>
          <form action="/auth/logout" method="post">
            <button className={styles.logoutButton} type="submit"><LogOut size={16} aria-hidden="true" />Sair</button>
          </form>
        </div>
      </aside>

      <main className={styles.mainContent} id="visao-geral">
        <header className={styles.topbar}>
          <div className={styles.breadcrumb}><span>MINHA ESCUTA</span><ChevronRight size={13} aria-hidden="true" /><strong>2026</strong></div>
          <div className={styles.topbarRight}>
            <span className={styles.readOnly}><LockKeyhole size={13} aria-hidden="true" />Somente leitura</span>
            <span className={styles.topbarDate}>{dateLabel}</span>
          </div>
        </header>

        <div className={styles.pageContent}>
          <section className={styles.intro} aria-labelledby="page-title">
            <div className={styles.introCopy}>
              <div className={styles.overline}><span className={styles.overlineRule} />TEMPORADA 2026 <span className={styles.overlineDot}>·</span> {latestVersion ? "ARQUIVO V" + latestVersion : "ACERVO"}</div>
              <h1 id="page-title">O ano em <em>discos.</em></h1>
              <p>Um retrato da escuta, organizado pela nota original de cada álbum.</p>
            </div>
            <div className={styles.syncStatus}>
              <span className={styles.statusRing}><span /></span>
              <div className={styles.syncStatusCopy}>
                <strong>{syncTitle}</strong>
                <span>{syncDescription}</span>
                {syncFeedback && <span role="status">{syncFeedback}</span>}
              </div>
              <button className={styles.syncButton} type="button" disabled={!syncReady || syncing} onClick={synchronize} title={syncReady ? "Ler a versão mais recente da pasta privada" : "Configuração privada de sincronização pendente"}>
                {syncing ? "Lendo…" : "Sincronizar"}
              </button>
              <CircleHelp size={17} className={styles.statusHelp} aria-hidden="true" />
            </div>
          </section>

          <CompetitionPanel state={competition} ready={syncReady} sourceTop50Positions={sourceTop50Positions} history={competitionHistory}
            playoffResults={source?.playoffResults ?? []} resultsVersion={latestVersion} />

          {showSyncReport && <section className={styles.syncReport} aria-labelledby="sync-report-title">
            <div className={styles.alertIcon}><AlertTriangle size={18} aria-hidden="true" /></div>
            <div className={styles.alertCopy}>
              <strong id="sync-report-title">Última tentativa: {lastAttempt.status === "failed" ? "falhou" : lastAttempt.status === "running" ? "em andamento" : "concluída com apontamentos"}.</strong>
              <p>Iniciada em {dateTime(lastAttempt.startedAt)}{lastAttempt.finishedAt ? ` · finalizada em ${dateTime(lastAttempt.finishedAt)}` : ""}{lastAttempt.errorCode ? ` · código ${lastAttempt.errorCode}` : ""}{latestVersion ? ` · publicação válida v${latestVersion} preservada` : " · nenhuma publicação válida"}</p>
              {attemptCounts.length > 0 && <p>{attemptCounts.map(([label, count]) => `${label}: ${count}`).join(" · ")}</p>}
              {lastAttempt.issues.length > 0 && <details className={styles.syncIssueDetails}>
                <summary>Ver {lastAttempt.issues.length} apontamento{lastAttempt.issues.length === 1 ? "" : "s"}</summary>
                <ul>{lastAttempt.issues.map((issue, index) => <li key={issue.code + issue.sourceLocator + index}><strong>{issue.severity === "error" ? "Erro" : "Aviso"} · {issue.code}</strong>{issue.sourceLocator && <span>{issue.sourceLocator}</span>}<p>{issue.message}</p></li>)}</ul>
              </details>}
            </div>
            <span className={styles.alertTag}>{lastAttempt.status === "failed" ? "SINCRONIZAÇÃO" : "REVISÃO DA FONTE"}</span>
          </section>}

          {attemptHistory.length > 0 && <details className={styles.syncHistory}>
            <summary>Histórico recente · {attemptHistory.length} tentativa{attemptHistory.length === 1 ? "" : "s"}</summary>
            <ol>{attemptHistory.map((attempt, index) => <li key={attempt.startedAt + index}>
              <div><strong>{syncStatusLabel(attempt.status)}{attempt.version ? ` · v${attempt.version}` : ""}</strong><span>{dateTime(attempt.startedAt)}{attempt.finishedAt ? ` · ${dateTime(attempt.finishedAt)}` : ""}</span></div>
              <span className={attempt.isCurrentPublication ? styles.currentPublication : styles.historyOutcome}>
                {attempt.isCurrentPublication ? "Publicação ativa" : attempt.status === "failed" ? "Não publicada" : attempt.version ? "Versão histórica" : "Sem versão"}
              </span>
              {(attempt.errorCode || attempt.issueCount > 0) && <small>{attempt.errorCode ? `Código ${attempt.errorCode}` : ""}{attempt.errorCode && attempt.issueCount > 0 ? " · " : ""}{attempt.issueCount > 0 ? `${attempt.issueCount} apontamento${attempt.issueCount === 1 ? "" : "s"}` : ""}</small>}
            </li>)}</ol>
          </details>}

          <section className={styles.metrics} aria-label="Resumo do acervo">
            <Metric icon={<Headphones size={17} aria-hidden="true" />} label="Álbuns ouvidos" value={String(albums.length)} caption="registrados na fonte" />
            <Metric icon={<AudioLines size={17} aria-hidden="true" />} label="Nota média original" value={average.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 2 })} caption="calculada sobre as avaliações originais" />
            <Metric icon={<Sparkles size={17} aria-hidden="true" />} label="90 ou mais" value={String(count90)} caption="notas originais nesta faixa" accent />
            <Metric icon={<AlertTriangle size={17} aria-hidden="true" />} label="Notas divergentes" value={String(noteDifferences)} caption="nota informada diferente da original" />
          </section>

          <section className={styles.featureGrid} aria-label="Destaque e distribuição">
            <div className={styles.featureCard}>
              <div className={styles.featureArt} aria-hidden="true">
                <div className={styles.vinyl}><span className={styles.vinylCenter}>OM</span></div>
                <span className={styles.artIndex}>LADO A<br />2026</span>
                <span className={styles.artLine} />
              </div>
              <div className={styles.featureInfo}>
                <div className={styles.cardEyebrow}><span>01</span> MAIOR NOTA ORIGINAL</div>
                {topThree[0] ? <><h2>{topThree[0].artist}</h2><p className={styles.featureAlbum}>{topThree[0].title}</p><div className={styles.featureScoreLine}><strong>{scoreLabel(topThree[0].originalScore)}</strong><span>/ 100</span><span className={styles.featureDivider} />{topThree[0].country}</div></> : <><h2>Seu acervo começa aqui</h2><p className={styles.featureAlbum}>Importe a planilha para ver seus destaques.</p></>}
                {topThree.length > 1 && <div className={styles.runnersUp}>
                  {topThree.slice(1).map((album, index) => <div className={styles.runner} key={recordKey(album)}><span>0{index + 2}</span><strong>{album.artist}</strong><small>{scoreLabel(album.originalScore)}</small></div>)}
                </div>}
              </div>
            </div>

            <div className={styles.distributionCard}>
              <div className={styles.cardHeader}><div><div className={styles.cardEyebrow}>PANORAMA</div><h2>Notas originais</h2></div><span className={styles.chartIcon}><AudioLines size={18} aria-hidden="true" /></span></div>
              <div className={styles.chartTotal}><strong>{originalScores.length}</strong><span>avaliações com nota original</span></div>
              <div className={styles.histogram} aria-label="Distribuição de notas originais por faixa">
                {histogram.map((band) => <div className={styles.histogramRow} key={band.label}>
                  <span>{band.label}</span><div className={styles.barTrack}><span style={{ width: ((band.count / maxBand) * 100) + "%" }} /></div><strong>{band.count}</strong>
                </div>)}
              </div>
              <p className={styles.chartFootnote}>A nota informada e os bônus competitivos ficam separados deste ranking.</p>
            </div>
          </section>

          {source && (hasSummaryDifference || noteDifferences > 0 || hasBacklogDifference) && <section className={styles.sourceAlert} aria-label="Divergências encontradas na planilha">
            <div className={styles.alertIcon}><AlertTriangle size={18} aria-hidden="true" /></div>
            <div className={styles.alertCopy}>
              <strong>Alguns totais da planilha precisam de conferência.</strong>
              <p>{noteDifferences > 0 && <span>{noteDifferences} notas exibidas diferem da nota original. </span>}{sourceAverage !== null && hasSummaryDifference && <span>O resumo informa média {sourceAverage.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}; a média original calculada é {average.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. </span>}{sourceBacklog !== null && hasBacklogDifference && <span>O resumo lista {sourceBacklog} itens no backlog, mas a aba contém {source.backlog.length}.</span>}</p>
            </div>
            <span className={styles.alertTag}>REVISÃO DA FONTE</span>
          </section>}

          <section className={styles.catalogSection} id="acervo" aria-labelledby="catalog-title">
            <div className={styles.catalogHeading}>
              <div><div className={styles.cardEyebrow}>ACERVO 2026</div><h2 id="catalog-title">Ranking anual</h2><p>Ordenado pela nota original. Empates compartilham posição.</p></div>
              <div className={styles.albumCount} aria-live="polite"><strong>{filteredAlbums.length}</strong><span>de {albums.length}</span></div>
            </div>

            <div className={styles.catalogControls}>
              <label className={styles.searchBox}>
                <Search size={17} aria-hidden="true" />
                <span className={styles.visuallyHidden}>Buscar por álbum, artista, gênero ou país</span>
                <input value={query} onChange={(event) => { setQuery(event.target.value); setShown(15); }} placeholder="Buscar álbum, artista, gênero..." />
              </label>
              <div className={styles.filters} role="group" aria-label="Filtrar por nota original">
                {filters.map((item) => <button className={filter === item.id ? styles.filterActive : styles.filterButton} type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setShown(15); }}>{item.label}</button>)}
              </div>
            </div>

            <div className={styles.catalogLayout}>
              <div className={styles.rankingList} role="list" aria-label="Álbuns ordenados pela nota original">
                {visibleAlbums.length ? visibleAlbums.map((album) => <button className={styles.albumRow + (selected?.key === album.key ? " " + styles.albumSelected : "")} type="button" key={album.key} onClick={() => setSelectedKey(album.key)} aria-pressed={selected?.key === album.key}>
                  <span className={styles.albumPosition}>{album.annualPosition ? displayRank(album.annualPosition) : "—"}</span>
                  <span className={styles.albumIdentity}><strong>{album.artist}</strong><span>{album.title}</span><small>{album.country}{album.tier ? " · " + album.tier : ""}{album.isPresent === false ? " · ausente na versão atual" : ""}</small></span>
                  <span className={styles.albumScore}>{scoreLabel(album.originalScore)}<small>ORIGINAL</small></span>
                  <ChevronRight className={styles.rowChevron} size={16} aria-hidden="true" />
                </button>) : <div className={styles.emptySearch}><Search size={20} aria-hidden="true" /><strong>Nenhum álbum encontrado</strong><span>Tente outro artista, título ou país.</span></div>}
                {filteredAlbums.length > visibleAlbums.length && <button className={styles.loadMore} type="button" onClick={() => setShown((current) => current + 15)}>Mostrar mais álbuns <span>{filteredAlbums.length - visibleAlbums.length} restantes</span></button>}
              </div>

              <AlbumDetails album={selected} />
            </div>
          </section>

          <section className={styles.lowerGrid}>
            <div className={styles.backlogCard} id="backlog">
              <div className={styles.cardHeader}><div><div className={styles.cardEyebrow}>PRÓXIMAS ESCUTAS</div><h2>Backlog</h2></div><span className={styles.backlogCount}>{backlog.length} álbuns</span></div>
              {backlog.length ? <ol className={styles.backlogList} id="backlog-items">{visibleBacklog.map((item) => <li key={item.order + "-" + item.artist + "-" + item.title}><span className={styles.backlogOrder}>{String(item.order).padStart(2, "0")}</span><span><strong>{item.artist}</strong><small>{item.title}</small>{item.source && <small className={styles.backlogSource}>Fonte: {item.source}</small>}</span><span className={styles.priority}>{item.priority || "Sem prioridade"}</span></li>)}</ol> : <p className={styles.mutedBody}>A lista de próximas escutas aparece aqui após a leitura da fonte.</p>}
              {backlog.length > 5 && <button className={styles.backlogToggle} type="button" aria-controls="backlog-items" aria-expanded={showAllBacklog} onClick={() => setShowAllBacklog((current) => !current)}>{showAllBacklog ? "Mostrar menos" : `Ver todos os ${backlog.length} álbuns`}</button>}
              <p className={styles.readOnlyNote}><LockKeyhole size={13} aria-hidden="true" />O backlog é exibido como está na planilha.</p>
            </div>

          </section>

          <footer className={styles.footer}>
            <span>ORÁCULO MUSICAL <span className={styles.footerDot}>·</span> 2026</span>
            <span>{source ? latestVersion ? `${localPreview ? "Prévia local da versão " : "Última publicação da versão "}${latestVersion} · referência ${dateLabel}` : "Sem publicação válida" : "Nenhuma fonte carregada"}</span>
            <span>Dados privados <LockKeyhole size={12} aria-hidden="true" /></span>
          </footer>
        </div>
      </main>
    </div>
  );
}

function Metric({ icon, label, value, caption, accent = false }: { icon: React.ReactNode; label: string; value: string; caption: string; accent?: boolean }) {
  return <article className={styles.metricCard + (accent ? " " + styles.metricAccent : "")}>
    <div className={styles.metricTop}><span className={styles.metricIcon}>{icon}</span><span className={styles.metricLabel}>{label}</span></div>
    <strong className={styles.metricValue}>{value}</strong>
    <span className={styles.metricCaption}>{caption}</span>
  </article>;
}

function AlbumDetails({ album }: { album: RankedAlbum | null }) {
  if (!album) return <aside className={styles.detailCard}><div className={styles.detailEmpty}><Disc3 size={25} aria-hidden="true" /><strong>Escolha um álbum</strong><span>Os detalhes da avaliação aparecem aqui.</span></div></aside>;
  const hasDifference = scoreDifference(album);
  const hasCompetitiveRecord = Boolean(
    album.repescagem || album.repescagemDisqualified || album.repescagemNote || album.playInScore !== null
    || album.playInResult || album.prePlayoffScore !== null || album.prePlayoffResult || album.prePlayoffTiebreak
    || album.playoffSeed !== null || album.top50BestPhase || album.top50Bonus !== null
    || album.top50Index !== null || album.top50SourceRank !== null,
  );
  return <aside className={styles.detailCard} aria-label="Detalhes do álbum selecionado">
    <div className={styles.detailHeader}><span className={styles.cardEyebrow}>DETALHE DA AVALIAÇÃO</span><span className={styles.detailPosition}>#{displayRank(album.annualPosition)}</span></div>
    <div className={styles.detailArtist}>{album.artist}</div>
    <h3>{album.title}</h3>
    <div className={styles.detailMeta}>{album.genre || "Gênero não informado"}<span>·</span>{album.country || "País não informado"}</div>
    <div className={styles.detailScore}>
      <div><span>NOTA ORIGINAL</span><strong>{scoreLabel(album.originalScore)}<small>/100</small></strong></div>
      {hasDifference && <div className={styles.reportedScore}><span>NOTA DA PLANILHA</span><strong>{scoreLabel(album.reportedScore)}</strong></div>}
    </div>
    {album.evaluationCompleteness === "incomplete" && <div className={styles.detailNotice}><AlertTriangle size={15} aria-hidden="true" /><span>Os quatro pilares não estão estruturados na fonte; o total original não representa uma soma validada.</span></div>}
    {hasDifference && <div className={styles.detailNotice}><ArrowDownRight size={15} aria-hidden="true" /><span>A nota informada na planilha difere da avaliação original. O ranking usa a original.</span></div>}
    <dl className={styles.detailFacts}>
      <div><dt>Faixa informada</dt><dd>{album.tier || "Não informada"}</dd></div>
      <div><dt>Posição na planilha</dt><dd>{album.sourceRank ? "#" + album.sourceRank : "Não informada"}</dd></div>
      {album.soundScore !== null && <div><dt>Construção sonora</dt><dd>{scoreLabel(album.soundScore)}/25</dd></div>}
      {album.identityScore !== null && <div><dt>Identidade &amp; personalidade</dt><dd>{scoreLabel(album.identityScore)}/25</dd></div>}
      {album.consistencyScore !== null && <div><dt>Consistência &amp; narrativa</dt><dd>{scoreLabel(album.consistencyScore)}/25</dd></div>}
      {album.replayScore !== null && <div><dt>Replay &amp; impacto</dt><dd>{scoreLabel(album.replayScore)}/25</dd></div>}
      {album.source && <div><dt>Fonte registrada</dt><dd className={styles.sourceText}>{album.source}</dd></div>}
    </dl>
    {album.repescagemNote && <div className={styles.observation}><span>OBSERVAÇÃO NA FONTE</span><p>{album.repescagemNote}</p></div>}
    {hasCompetitiveRecord && <details className={styles.competitiveEvidence}>
      <summary>Registros competitivos da planilha</summary>
      <p>Valores transcritos da fonte{album.isPresent === false ? " (última versão em que este álbum apareceu)" : ""}; não são classificação nem resultado recalculado pelo app.</p>
      <dl className={styles.detailFacts}>
        {album.repescagem && <div><dt>Repescagem</dt><dd>{album.repescagem}</dd></div>}
        {album.repescagemDisqualified && <div><dt>Desqualificação da Repescagem</dt><dd>{album.repescagemDisqualified}</dd></div>}
        {album.playInScore !== null && <div><dt>Play-in informado</dt><dd>{sourceNumberLabel(album.playInScore)}/25</dd></div>}
        {album.playInResult && <div><dt>Resultado Play-in</dt><dd>{album.playInResult}</dd></div>}
        {album.prePlayoffScore !== null && <div><dt>Pré-playoff informado</dt><dd>{sourceNumberLabel(album.prePlayoffScore)}/25</dd></div>}
        {album.prePlayoffResult && <div><dt>Resultado Pré-playoff</dt><dd>{album.prePlayoffResult}</dd></div>}
        {album.prePlayoffTiebreak && <div><dt>Desempate Pré-playoff</dt><dd>{album.prePlayoffTiebreak}</dd></div>}
        {album.playoffSeed !== null && <div><dt>Seed registrado</dt><dd>{album.playoffSeed}</dd></div>}
        {album.top50BestPhase && <div><dt>Melhor fase informada</dt><dd>{album.top50BestPhase}</dd></div>}
        {album.top50Bonus !== null && <div><dt>Bônus informado</dt><dd>{sourceNumberLabel(album.top50Bonus)}</dd></div>}
        {album.top50Index !== null && <div><dt>Índice informado</dt><dd>{sourceNumberLabel(album.top50Index)}</dd></div>}
        {album.top50SourceRank !== null && <div><dt>Posição Top 50 provisória</dt><dd>#{album.top50SourceRank}</dd></div>}
      </dl>
    </details>}
    <p className={styles.detailDisclaimer}><LockKeyhole size={13} aria-hidden="true" />Consulta somente leitura. Nenhuma nota pode ser alterada aqui.</p>
  </aside>;
}
