import type { Top50ManualDecision } from "../../../src/lib/catalog/types";
import type { WorkbookSheetData } from "../../../src/lib/ingestion/workbook-parser";
import { TOP50_DECISION_HEADERS, TOP50_DECISION_SHEET } from "../../../src/lib/competition/manual-decisions";
import { albumIdentity } from "../../../src/lib/competition/rules";
import { syntheticAlbum, syntheticField, syntheticFirstResults } from "./top50";

export function syntheticManualTie() {
  const field = syntheticField();
  const higher = Array.from({ length: 24 }, (_, i) => syntheticAlbum(i + 100, { originalScore: 80, reportedScore: 80, playoffSeed: null }));
  const tied = Array.from({ length: 3 }, (_, i) => syntheticAlbum(i + 200, { originalScore: 78, reportedScore: 78, playoffSeed: null,
    repescagem: "Eliminado — Etapa 2", top50BestPhase: "Repescagem", top50Bonus: 1, top50Index: 79 }));
  const albums = [...field.albums, ...higher, ...tied];
  const decisions: Top50ManualDecision[] = tied.map((album, i) => ({ decisionId: "synthetic-cut-1", season: 2026, rulesVersion: "2026-top50-2",
    artist: album.artist, title: album.title, originalScore: 78, phase: "Repescagem", phaseScore: 2, index: 79, order: [2, 1, 3][i],
    status: "Confirmada", confirmedBy: "Proprietário fictício", confirmedAt: "2026-10-29", confirmationReference: "Confirmação fictícia para teste",
    sourceSheet: TOP50_DECISION_SHEET, sourceRow: i + 2, parseErrors: [] }));
  return { albums, tied, decisions, participants: field.participants, cutoff: albums.map(album => albumIdentity(album)), results: syntheticFirstResults() };
}

export function syntheticDecisionSheet(decisions: Top50ManualDecision[]): WorkbookSheetData {
  return { sheet: TOP50_DECISION_SHEET, data: [TOP50_DECISION_HEADERS, ...decisions.map(row => [row.decisionId, row.season, row.rulesVersion,
    row.artist, row.title, row.originalScore, row.phase, row.phaseScore, row.index, row.order, row.status, row.confirmedBy, row.confirmedAt, row.confirmationReference])] };
}

export function syntheticManualWorkbook(decisions = syntheticManualTie().decisions): WorkbookSheetData[] {
  const tie = syntheticManualTie();
  const headers = ["Rank", "Artista", "Álbum", "Nota", "Faixa", "Gênero", "País", "Fonte", "Nota Original",
    "Repescagem 75-79", "Desqualificado Repescagem?", "Observação Repescagem", "Play-in Score", "Resultado Play-in",
    "Pré-playoff Score", "Resultado Pré-playoff", "Desempate Pré-playoff", "Seed Playoff", "Melhor fase Top 50", "Bônus Top 50",
    "Índice Top 50", "Rank Top 50 provisório", "Construção Sonora", "Identidade & Personalidade", "Consistência & Narrativa", "Replay & Impacto"];
  return [{ sheet: "Albuns 2026", data: [headers, ...tie.albums.map(a => [a.sourceRank, a.artist, a.title, a.originalScore, a.tier, a.genre,
    a.country, a.source, a.originalScore, a.repescagem, a.repescagemDisqualified, a.repescagemNote, a.playInScore, a.playInResult,
    a.prePlayoffScore, a.prePlayoffResult, a.prePlayoffTiebreak, a.playoffSeed, a.top50BestPhase, a.top50Bonus, a.top50Index,
    a.top50SourceRank, a.soundScore, a.identityScore, a.consistencyScore, a.replayScore])] },
    { sheet: "Backlog", data: [["Ordem", "Artista", "Álbum", "Prioridade", "Fonte"]] },
    { sheet: "Resumo", data: [["Data de referência", "29/10/2026"], ["Álbuns ouvidos", tie.albums.length]] },
    { sheet: "Resultados Playoffs", data: [["Fase", "Jogo", "Seed A", "Artista A", "Seed B", "Artista B", "Resultado", "Vencedor", "Critério"],
      ...tie.results.map((r, i) => ["1ª rodada", `Jogo ${String(i + 1).padStart(2, "0")}`, r.seedA, r.artistA, r.seedB, r.artistB, r.result, r.winner, r.criterion])] },
    syntheticDecisionSheet(decisions)];
}
