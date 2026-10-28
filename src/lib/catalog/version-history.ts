export type HistoryDomain = "albums" | "backlog" | "playoffs";
export type HistoryChangeKind = "added" | "changed" | "absent" | "reappeared";
export type HistoryValue = string | number | boolean | null;
export type HistoryVersion = { version: string; fileName: string; importedAt: string | null; modifiedAt: string; isCurrent: boolean };
export type HistoryRecord = { key: string; label: string; version: string; locator: string | null; values: Record<string, HistoryValue> };
export type HistoryBlockSnapshot = { available: boolean; records: HistoryRecord[] };
export type HistorySnapshot = { version: HistoryVersion; blocks: Record<HistoryDomain, HistoryBlockSnapshot> };
export type HistoryFieldChange = { field: string; label: string; before: HistoryValue; after: HistoryValue; derived: boolean };
export type HistoryChange = { key: string; domain: HistoryDomain; kind: HistoryChangeKind; label: string;
  fields: HistoryFieldChange[]; before: HistoryRecord | null; after: HistoryRecord | null };
export type HistoryComparisonBlock = { status: "ready" | "baseline" | "unavailable"; records: number; changes: HistoryChange[]; warnings: string[] };
export type HistoryComparison = { before: HistoryVersion | null; after: HistoryVersion; blocks: Record<HistoryDomain, HistoryComparisonBlock> };
export type VersionHistoryData = { versions: HistoryVersion[]; selected: HistoryVersion; previous: HistoryVersion | null;
  comparison: HistoryComparison; page: number; hasMore: boolean; notices: string[] };

export const HISTORY_DOMAINS: { id: HistoryDomain; label: string }[] = [{ id: "albums", label: "Álbuns" }, { id: "backlog", label: "Backlog" }, { id: "playoffs", label: "Playoffs" }];
export const HISTORY_KINDS: { id: HistoryChangeKind; label: string }[] = [{ id: "added", label: "Adicionados" }, { id: "changed", label: "Alterados" }, { id: "absent", label: "Ausentes" }, { id: "reappeared", label: "Reaparecidos" }];

const fields: Record<HistoryDomain, Record<string, string>> = {
  albums: { artist: "Artista", title: "Álbum", originalScore: "Nota original registrada", reportedScore: "Nota informada", tier: "Faixa",
    genre: "Gênero", country: "País", source: "Fonte", soundScore: "Construção sonora", identityScore: "Identidade e personalidade",
    consistencyScore: "Consistência e narrativa", replayScore: "Replay e impacto", repescagem: "Repescagem", repescagemDisqualified: "Desqualificado na Repescagem",
    repescagemNote: "Observação da Repescagem", playInScore: "Score do Play-in", playInResult: "Resultado do Play-in", prePlayoffScore: "Score do Pré-playoff",
    prePlayoffResult: "Resultado do Pré-playoff", prePlayoffTiebreak: "Desempate do Pré-playoff", playoffSeed: "Seed registrado",
    sourceRank: "Ranking anual informado", top50BestPhase: "Melhor fase Top 50 informada", top50Bonus: "Bônus Top 50 informado", top50Index: "Índice Top 50 informado", top50SourceRank: "Posição Top 50 informada" },
  backlog: { artist: "Artista", title: "Álbum", order: "Ordem no backlog", priority: "Prioridade", source: "Fonte / referência" },
  playoffs: { seedA: "Seed A", artistA: "Artista A", seedB: "Seed B", artistB: "Artista B", result: "Resultado", winner: "Vencedor", criterion: "Critério" },
};
const derived = new Set(["sourceRank", "top50BestPhase", "top50Bonus", "top50Index", "top50SourceRank"]);
const text = (value: unknown) => typeof value === "string" ? value.normalize("NFC").trim() : "";
const value = (v: unknown): HistoryValue => v === undefined || v === null || v === "" ? null
  : typeof v === "number" || typeof v === "boolean" || typeof v === "string" ? v : null;

export function historyBlockAvailable(records: number, expected: unknown, emptyKnown = false) {
  return typeof expected === "number" && Number.isInteger(expected) && expected >= 0 ? records === expected : records > 0 || emptyKnown;
}

export function historyRecordKey(domain: HistoryDomain, record: Record<string, unknown>, albumKey?: string) {
  if (domain === "albums" && albumKey) return albumKey;
  if (domain !== "playoffs") return JSON.stringify([text(record.artist), text(record.title)]);
  const phase = record.phase ?? "first";
  return phase === "first" ? JSON.stringify(["first", Math.min(Number(record.seedA), Number(record.seedB)), Math.max(Number(record.seedA), Number(record.seedB))])
    : JSON.stringify([phase, record.gameId]);
}

export function makeHistoryRecord(domain: HistoryDomain, raw: Record<string, unknown>, version: string, albumKey?: string, locator?: string | null): HistoryRecord {
  const label = domain === "playoffs" ? `${text(raw.gameId) || `${raw.seedA} × ${raw.seedB}`} · ${text(raw.artistA)} × ${text(raw.artistB)}`
    : `${text(raw.artist)} — ${text(raw.title)}`;
  return { key: historyRecordKey(domain, raw, albumKey), label, version,
    locator: locator ?? (domain === "playoffs" ? `${text(raw.sourceSheet) || "Playoffs"}${raw.sourceRow ? `!${raw.sourceRow}` : ""}`
      : domain === "backlog" ? `Backlog · ordem ${raw.order ?? "não informada"}` : raw.sourceRow ? `Albuns!${raw.sourceRow}` : null),
    values: Object.fromEntries(Object.keys(fields[domain]).map(key => [key, value(raw[key])])) };
}

function indexRecords(records: HistoryRecord[]) {
  const map = new Map<string, HistoryRecord>(); const ambiguous = new Set<string>();
  for (const r of records) {
    const old = map.get(r.key);
    if (!old || BigInt(r.version) > BigInt(old.version)) { map.set(r.key, r); ambiguous.delete(r.key); }
    else if (r.version === old.version) ambiguous.add(r.key);
  }
  return { map, ambiguous };
}

export function comparePublishedVersions(before: HistorySnapshot | null, after: HistorySnapshot,
  earlier: Partial<Record<HistoryDomain, HistoryRecord[]>> = {}): HistoryComparison {
  const blocks = {} as Record<HistoryDomain, HistoryComparisonBlock>;
  for (const { id: domain } of HISTORY_DOMAINS) {
    const old = before?.blocks[domain]; const current = after.blocks[domain];
    const block: HistoryComparisonBlock = { status: !current.available || (old && !old.available) ? "unavailable" : before ? "ready" : "baseline",
      records: current.records.length, changes: [], warnings: [] };
    blocks[domain] = block;
    if (block.status !== "ready") {
      if (block.status === "baseline") {
        const baseline = indexRecords(current.records);
        for (const key of baseline.ambiguous) block.warnings.push(`Identidade repetida no ponto inicial: ${baseline.map.get(key)!.label}`);
      }
      continue;
    }
    const a = indexRecords(old!.records); const b = indexRecords(current.records);
    const prior = indexRecords((earlier[domain] ?? []).filter(r => BigInt(r.version) < BigInt(before!.version.version)));
    for (const key of new Set([...a.map.keys(), ...b.map.keys()])) {
      const previous = a.map.get(key) ?? null; const next = b.map.get(key) ?? null;
      if (a.ambiguous.has(key) || b.ambiguous.has(key) || (!previous && next && prior.ambiguous.has(key))) {
        block.warnings.push(`Identidade repetida; comparação pendente: ${(next ?? previous)!.label}`); continue;
      }
      const lastSeen = !previous && next ? prior.map.get(key) ?? null : null;
      const from = previous ?? lastSeen;
      const changes: HistoryFieldChange[] = [];
      for (const [field, label] of Object.entries(fields[domain])) {
        const fromValue = from?.values[field] ?? null; const toValue = next?.values[field] ?? null;
        if (fromValue !== toValue) changes.push({ field, label, before: fromValue, after: toValue, derived: domain === "albums" && derived.has(field) });
      }
      const kind: HistoryChangeKind | null = !next ? "absent" : !previous ? lastSeen ? "reappeared" : "added" : changes.length ? "changed" : null;
      if (kind) block.changes.push({ key, domain, kind, label: (next ?? previous)!.label, fields: changes, before: from, after: next });
    }
    block.changes.sort((a, b) => a.label.localeCompare(b.label, "pt-BR") || a.key.localeCompare(b.key));
  }
  return { before: before?.version ?? null, after: after.version, blocks };
}

export function filterHistoryChanges(comparison: HistoryComparison, options: { domain: HistoryDomain | "all"; kind: HistoryChangeKind | "all"; query: string; includeDerived: boolean }) {
  const normalize = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
  const needle = normalize(options.query.trim());
  return HISTORY_DOMAINS.flatMap(({ id }) => comparison.blocks[id].changes).flatMap(change => {
    if (options.domain !== "all" && change.domain !== options.domain || options.kind !== "all" && change.kind !== options.kind) return [];
    const visibleFields = change.fields.filter(f => options.includeDerived || !f.derived);
    if (change.kind === "changed" && !visibleFields.length) return [];
    if (needle && !normalize(`${change.label} ${visibleFields.map(f => `${f.label} ${f.before ?? ""} ${f.after ?? ""}`).join(" ")}`).includes(needle)) return [];
    return [{ ...change, fields: visibleFields }];
  });
}
