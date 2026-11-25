import { AlertTriangle, ArrowDownRight, Disc3, LockKeyhole } from "lucide-react";
import type { RankedAlbum } from "@/lib/catalog/ranking";
import { scoreLabel } from "@/lib/catalog/presentation";
import styles from "./album-details.module.css";
const displayRank = (n: number) => String(n).padStart(2, "0");
const sourceNumberLabel = (n: number) => String(n).replace(".", ",");
const scoreDifference = (a: RankedAlbum) => a.reportedScore !== null && a.originalScore !== null && a.reportedScore !== a.originalScore;
export function AlbumDetails({ album }: { album: RankedAlbum | null }) {
  if (!album) return <aside className={styles.detailCard}><div className={styles.detailEmpty}><Disc3 size={25} aria-hidden="true" /><strong>Escolha um álbum</strong><span>Os detalhes da avaliação aparecem aqui.</span></div></aside>;
  const hasDifference = scoreDifference(album);
  const hasCompetitiveRecord = Boolean(
    album.repescagem || album.repescagemDisqualified || album.repescagemNote || album.playInScore !== null
    || album.playInResult || album.prePlayoffScore !== null || album.prePlayoffResult || album.prePlayoffTiebreak
    || album.playoffSeed !== null || album.top50BestPhase || album.top50Bonus !== null
    || album.top50Index !== null || album.top50SourceRank !== null,
  );
  return <aside className={styles.detailCard} aria-label="Detalhes da avaliação">
    <div className={styles.detailHeader}><span className={styles.cardEyebrow}>DETALHE DA AVALIAÇÃO</span><span className={styles.detailPosition}>#{displayRank(album.annualPosition)}</span></div>
    <div className={styles.detailArtist}>{album.artist}</div>
    <h2>{album.title}</h2>
    <div className={styles.detailMeta}>{album.genre || "Gênero não informado"}<span>·</span>{album.country || "País não informado"}</div>
    <div className={styles.detailScore}>
      <div><span>NOTA ORIGINAL</span><strong>{scoreLabel(album.originalScore)}<small>/100</small></strong></div>
      {hasDifference && <div className={styles.reportedScore}><span>NOTA DA PLANILHA</span><strong>{scoreLabel(album.reportedScore)}</strong></div>}
    </div>
    {album.evaluationCompleteness === "incomplete" && <div className={styles.detailNotice}><AlertTriangle size={15} aria-hidden="true" /><span>Os quatro pilares não estão estruturados na fonte; o total original não representa uma soma validada.</span></div>}
    {hasDifference && <div className={styles.detailNotice}><ArrowDownRight size={15} aria-hidden="true" /><span>A nota informada na planilha difere da avaliação original. O ranking usa a original.</span></div>}
    <dl className={styles.detailFacts}>
      {album.evaluatedOn !== undefined && <div><dt>Conclusão da avaliação</dt><dd>{album.evaluatedOn ? album.evaluatedOn.split("-").reverse().join("/") : "Não informada"}</dd></div>}
      {album.releaseYear !== undefined && <div><dt>Ano de lançamento</dt><dd>{album.releaseYear ?? "Não informado"}</dd></div>}
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
