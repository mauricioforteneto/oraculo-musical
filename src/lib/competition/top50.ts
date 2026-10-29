import type { AlbumRecord, PublishedPlayoffResult, Top50ManualDecision } from "@/lib/catalog/types";
import { resolveTop50Decisions } from "./manual-decisions";
import { albumIdentity, firstRound, MATCH_PENDING_LABELS, type Participant } from "./rules";
import { buildBracketView, type BracketPhaseId } from "./bracket";

export const TOP50_RULES_VERSION = "2026-top50-2";
export const TOP50_BONUSES = { none: 0, rep: 1, playin: 3, pre: 6, first: 8, roundOf16: 10, quarters: 12, semis: 14 };
type ScoredPhase = keyof typeof TOP50_BONUSES;
const labels: Record<ScoredPhase, string> = { none: "Sem pós-temporada", rep: "Repescagem", playin: "Play-in", pre: "Pré-playoff",
  first: "Primeira rodada dos Playoffs", roundOf16: "Oitavas", quarters: "Quartas", semis: "Semifinais" };
const phaseOrder: Record<ScoredPhase, number> = { none: 0, rep: 1, playin: 2, pre: 3, first: 4, roundOf16: 5, quarters: 6, semis: 7 };
export type Top50Entry = {
  identityKey: string; artist: string; title: string; originalScore: number; seed: number | null;
  status: "active" | "eliminated" | "eligible" | "champion" | "runner-up";
  phase: string; bonus: number | null; index: number | null; position: number | null;
  late: boolean; conflicts: string[]; warnings: string[];
  manualDecisionId?: string;
  phasePerformance?: number;
};
type ScoredEntry = Top50Entry & { phaseOrder: number; phaseScore: number };
const fold = (text: string) => text.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
const compare = (a: ScoredEntry, b: ScoredEntry) => b.index! - a.index! || b.phaseOrder - a.phaseOrder
  || b.phaseScore - a.phaseScore || b.originalScore - a.originalScore
  || (a.seed !== null && b.seed !== null ? a.seed - b.seed : 0);

export function projectTop50(albums: AlbumRecord[], participants: Participant[], results: PublishedPlayoffResult[], cutoffAlbumKeys: string[] | null = null, decisions: Top50ManualDecision[] = []) {
  const bracket = firstRound(participants);
  if (!bracket) return null;
  const view = buildBracketView(bracket, results);
  const cutoff = cutoffAlbumKeys ? new Set(cutoffAlbumKeys) : null;
  const catalog = new Map<string, AlbumRecord>();
  const duplicates = new Set<string>();
  for (const album of albums) {
    const key = albumIdentity(album);
    if (catalog.has(key)) duplicates.add(key);
    else catalog.set(key, album);
  }
  const eliminated = new Map<string, ScoredPhase>();
  const resultIssues: string[] = [];
  for (const phase of view.phases) {
    for (const game of phase.games) {
      const resolution = game.resolution;
      if (resolution?.pending && resolution.pending !== "missing-result") resultIssues.push(`${phase.label} · ${game.label}: ${MATCH_PENDING_LABELS[resolution.pending]}`);
      if (phase.id === "final" || !resolution?.winner) continue;
      const loser = [game.high.participant, game.low.participant].find(p => p && p.identityKey !== resolution.winner!.identityKey)!;
      eliminated.set(loser.identityKey, phase.id as Exclude<BracketPhaseId, "final">);
    }
  }
  const final = view.phases.at(-1)!.games[0];
  const champion = view.champion;
  const runnerUp = champion ? [final.high.participant!, final.low.participant!].find(p => p.identityKey !== champion.identityKey)! : null;
  const survivors: Top50Entry[] = [];
  const fixed: Top50Entry[] = [];
  const scored: ScoredEntry[] = [];

  function base(key: string, artist: string, title: string, originalScore: number, seed: number | null): Top50Entry {
    return { identityKey: key, artist, title, originalScore, seed, status: "eligible", phase: "", bonus: null, index: null, position: null,
      late: cutoff !== null && !cutoff.has(key), conflicts: duplicates.has(key) ? ["Identidade duplicada no catálogo."] : [], warnings: [] };
  }
  function score(entry: Top50Entry, phase: ScoredPhase, performance = 0) {
    entry.phase = labels[phase]; entry.bonus = TOP50_BONUSES[phase]; entry.index = entry.originalScore + entry.bonus;
    entry.phasePerformance = performance;
    scored.push({ ...entry, phaseOrder: phaseOrder[phase], phaseScore: performance });
  }
  const participantKeys = new Set(participants.map(p => p.identityKey));
  for (const p of participants) {
    const entry = base(p.identityKey, p.artist, p.title, p.originalScore, p.seed);
    const source = catalog.get(p.identityKey);
    // The frozen evaluation remains authoritative even if catalog metadata changes.
    if (source && source.originalScore !== p.originalScore) entry.warnings.push("Nota informada difere da original congelada; cálculo preserva a nota congelada.");
    if (champion?.identityKey === p.identityKey || runnerUp?.identityKey === p.identityKey) {
      entry.status = champion?.identityKey === p.identityKey ? "champion" : "runner-up";
      entry.phase = entry.status === "champion" ? "Campeão" : "Vice-campeão";
      entry.position = entry.status === "champion" ? 1 : 2;
      fixed.push(entry);
    } else if (eliminated.has(p.identityKey)) {
      entry.status = "eliminated";
      score(entry, eliminated.get(p.identityKey)!);
    } else {
      entry.status = "active"; entry.phase = "Playoffs — em disputa";
      survivors.push(entry);
    }
  }
  for (const [key, album] of catalog) {
    if (participantKeys.has(key) || album.originalScore === null) continue;
    const pre = album.prePlayoffScore !== null || !!album.prePlayoffResult;
    const playin = album.playInScore !== null || !!album.playInResult;
    const rep = !!album.repescagem && !/^nao\b/.test(fold(album.repescagem));
    const phase: ScoredPhase = pre ? "pre" : playin ? "playin" : rep ? "rep" : "none";
    if (phase === "none" && album.originalScore < 79) continue;
    const entry = base(key, album.artist, album.title, album.originalScore, null);
    if (entry.late && phase !== "none") entry.conflicts.push("Fase encerrada consta apenas após o corte; requer conferência.");
    if (album.isPresent === false) entry.conflicts.push("Álbum ausente na publicação mais recente.");
    const performance = phase === "pre" ? album.prePlayoffScore ?? 0 : phase === "playin" ? album.playInScore ?? 0
      : phase === "rep" ? /etapa 2/.test(fold(album.repescagem)) ? 2 : /etapa 1/.test(fold(album.repescagem)) ? 1 : 0 : 0;
    if ((phase === "pre" && (album.prePlayoffScore === null || !album.prePlayoffResult))
      || (phase === "playin" && (album.playInScore === null || !album.playInResult))) entry.conflicts.push("Participação competitiva sem score e resultado comprovados.");
    if (phase === "rep" && performance === 0) entry.conflicts.push("Etapa da Repescagem não comprovada.");
    if (rep && /fora da pos.temporada|fora de pos.temporada|nao participou|apos o fechamento/.test(fold(album.repescagemNote))) {
      entry.conflicts.push("A fonte contém indicação de exclusão da Repescagem; conferir a participação.");
    }
    score(entry, phase, performance);
  }
  const reserved = champion ? 2 : survivors.length;
  const slots = 50 - reserved;
  const eligible = scored.filter(e => e.conflicts.length === 0).sort((a, b) => compare(a, b) || a.artist.localeCompare(b.artist, "pt-BR") || a.title.localeCompare(b.title, "pt-BR"));
  const groups: ScoredEntry[][] = [];
  for (const entry of eligible) {
    if (!groups.length || compare(groups.at(-1)![0], entry) !== 0) groups.push([]);
    groups.at(-1)!.push(entry);
  }
  const manual = resolveTop50Decisions(groups, decisions, TOP50_RULES_VERSION);
  const resolvedCompare = (a: ScoredEntry, b: ScoredEntry) => compare(a, b)
    || (manual.order.has(a.identityKey) && manual.order.has(b.identityKey) ? manual.order.get(a.identityKey)! - manual.order.get(b.identityKey)! : 0);
  eligible.sort((a, b) => resolvedCompare(a, b) || a.artist.localeCompare(b.artist, "pt-BR") || a.title.localeCompare(b.title, "pt-BR"));
  for (const decision of manual.applied) for (const entry of eligible) {
    if (decision.orderedKeys.includes(entry.identityKey)) entry.manualDecisionId = decision.decisionId;
  }
  const boundary = eligible[slots - 1];
  const tieAtCut = !!boundary && !!eligible[slots] && resolvedCompare(boundary, eligible[slots]) === 0;
  let rank = 0;
  eligible.forEach((entry, i) => {
    if (i === 0 || resolvedCompare(entry, eligible[i - 1]) !== 0) rank = i + 1;
    if (i < slots && !(tieAtCut && resolvedCompare(entry, boundary) === 0)) entry.position = reserved + rank;
  });
  const entries: Top50Entry[] = [...fixed, ...scored].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || (b.index ?? 0) - (a.index ?? 0))
    .map(({ identityKey, artist, title, originalScore, seed, status, phase, bonus, index, position, late, conflicts, warnings, manualDecisionId, phasePerformance }) =>
      ({ identityKey, artist, title, originalScore, seed, status, phase, bonus, index, position, late, conflicts, warnings,
        ...(manualDecisionId ? { manualDecisionId } : {}), ...(phasePerformance === undefined ? {} : { phasePerformance }) }));
  for (const entry of [...entries, ...survivors]) {
    const album = catalog.get(entry.identityKey);
    if (!album) continue;
    // Derived source columns are comparisons, never evidence for eligibility.
    const genericPlayoffs = participantKeys.has(entry.identityKey) && fold(album.top50BestPhase) === "playoffs";
    if (album.top50BestPhase && !genericPlayoffs && fold(album.top50BestPhase) !== fold(entry.phase)) entry.warnings.push("Melhor fase informada difere da fase calculada.");
    if (album.top50Bonus !== null && album.top50Bonus !== entry.bonus) entry.warnings.push(`Bônus informado (${album.top50Bonus}) difere do calculado (${entry.bonus ?? "em disputa"}).`);
    if (album.top50Index !== null && album.top50Index !== entry.index) entry.warnings.push(`Índice informado (${album.top50Index}) difere do calculado (${entry.index ?? "não aplicável"}).`);
    if (album.top50SourceRank !== null && album.top50SourceRank !== entry.position) entry.warnings.push("Posição informada difere da posição calculada pela regra atual.");
  }
  return { rulesVersion: TOP50_RULES_VERSION, completed: !!champion, reserved, slots, survivors, entries, tieAtCut, resultIssues,
    cutTieKeys: tieAtCut ? eligible.filter(e => resolvedCompare(e,boundary) === 0).map(e => e.identityKey) : [],
    appliedDecisions: manual.applied, decisionIssues: manual.issues,
    unresolved: entries.filter(e => e.conflicts.length > 0).length,
    warningCount: [...entries, ...survivors].filter(e => e.warnings.length > 0).length };
}
export type Top50Projection = NonNullable<ReturnType<typeof projectTop50>>;
