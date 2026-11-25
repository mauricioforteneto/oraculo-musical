import type { AlbumRecord, BacklogRecord, PlayoffPhase, PublishedPlayoffResult, Top50ManualDecision } from "../catalog/types";
import { parseTop50Decisions } from "./top50-decisions";
import { parseMonthlyRecords } from "./monthly-records";
import { validCalendarDate } from "@/lib/competition/monthly";

export type WorkbookIssue = {
  code: string;
  severity: "warning" | "error";
  sourceLocator: string;
  message: string;
};

export const WORKBOOK_PARSER_VERSION = "2026.4";
export const PLAYOFF_PARSER_REVISION = 3;
export const PLAYOFF_EXTRACTION_VERSION = "2026.3";

export type WorkbookSheetData = {
  sheet: string;
  data: readonly (readonly unknown[])[];
};

export type ParsedAlbum = AlbumRecord & { identityKey: string };

export type ParsedSourceWorkbook = {
  monthlyRecords?: ReturnType<typeof parseMonthlyRecords>;
  season: number;
  sourceVersion: string;
  referenceDate: string;
  summary: Record<string, string>;
  albums: ParsedAlbum[];
  backlog: BacklogRecord[];
  playoffResults: PublishedPlayoffResult[];
  top50Decisions: Top50ManualDecision[];
  issues: WorkbookIssue[];
  counts: {
    albumRows: number;
    albums: number;
    backlogRows: number;
    backlog: number;
    rejectedRows: number;
    reportedOriginalDifferences: number;
    incompleteEvaluations: number;
    errors: number;
    warnings: number;
  };
  canPublish: boolean;
};

type FieldColumns = Map<string, number>;
type HeaderConfig = { optionalWarnings?: boolean; headers: Record<string, string[]>; required: string[]; markers: string[] };

const ALBUM_HEADERS: HeaderConfig = {
  headers: {
    sourceRank: ["rank"],
    evaluatedOn: ["data da avaliação", "data de avaliação"],
    releaseYear: ["ano de lançamento"],
    artist: ["artista"],
    title: ["álbum"],
    reportedScore: ["nota"],
    tier: ["faixa"],
    genre: ["gênero"],
    country: ["país"],
    source: ["fonte"],
    originalScore: ["nota original"],
    soundScore: ["construção sonora"],
    identityScore: ["identidade & personalidade"],
    consistencyScore: ["consistência & narrativa"],
    replayScore: ["replay & impacto"],
    repescagem: ["repescagem 75-79"],
    repescagemDisqualified: ["desqualificado repescagem?"],
    repescagemNote: ["observação repescagem"],
    playInScore: ["play-in score"],
    playInResult: ["resultado play-in"],
    prePlayoffScore: ["pré-playoff score"],
    prePlayoffResult: ["resultado pré-playoff"],
    prePlayoffTiebreak: ["desempate pré-playoff"],
    playoffSeed: ["seed playoff"],
    top50BestPhase: ["melhor fase top 50"],
    top50Bonus: ["bônus top 50"],
    top50Index: ["índice top 50"],
    top50SourceRank: ["rank top 50 provisório"],
  },
  required: ["sourceRank", "artist", "title", "reportedScore", "tier", "genre", "country", "source", "originalScore"],
  markers: ["artist", "title", "originalScore"],
};

const BACKLOG_HEADERS: HeaderConfig = {
  headers: {
    order: ["ordem"],
    artist: ["artista"],
    title: ["álbum"],
    priority: ["prioridade"],
    source: ["fonte / referência", "fonte", "referência"],
  },
  required: ["order", "artist", "title", "priority", "source"],
  markers: ["order", "artist", "title"],
};

const PLAYOFF_RESULT_HEADERS: HeaderConfig = {
  headers: {
    seedA: ["seed a"],
    artistA: ["artista a"],
    seedB: ["seed b"],
    artistB: ["artista b"],
  },
  required: ["seedA", "artistA", "seedB", "artistB"],
  markers: ["seedA", "artistA", "seedB", "artistB"],
};

const EXCEL_ERROR = /^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|SPILL!|CALC!)$/i;

function headerToken(value: unknown) {
  if (typeof value !== "string") return "";
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR")
    .replace(/[?]/g, "").replace(/\s+/g, " ").trim();
}

function isBlank(value: unknown) {
  return value === null || value === undefined || (typeof value === "string" && value.trim() === "");
}

function displayValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  return "";
}

function dateValue(value: string) {
  const brazilianDate = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value.trim());
  if (!brazilianDate) return value;
  return `${brazilianDate[3]}-${brazilianDate[2].padStart(2, "0")}-${brazilianDate[1].padStart(2, "0")}`;
}

function isNonEmptyRow(row: readonly unknown[]) {
  return row.some((value) => !isBlank(value));
}

function findHeader(sheet: WorkbookSheetData, config: HeaderConfig) {
  const markers = config.markers.map((field) => headerToken(config.headers[field][0]));
  const limit = Math.min(sheet.data.length, 20);
  for (let rowIndex = 0; rowIndex < limit; rowIndex += 1) {
    const tokens = sheet.data[rowIndex].map(headerToken);
    if (markers.every((marker) => tokens.includes(marker))) return { rowIndex, row: sheet.data[rowIndex] };
  }
  return null;
}

function mapHeaders(
  sheetName: string,
  rowIndex: number,
  row: readonly unknown[],
  config: HeaderConfig,
  issues: WorkbookIssue[],
): FieldColumns {
  const tokenIndexes = new Map<string, number>();
  row.forEach((value, index) => {
    const token = headerToken(value);
    if (!token) return;
    if (tokenIndexes.has(token)) {
      issues.push({ code: "DUPLICATE_HEADER", severity: "error", sourceLocator: `${sheetName}!${columnLabel(index + 1)}${rowIndex + 1}`, message: "O cabeçalho contém uma coluna duplicada." });
      return;
    }
    tokenIndexes.set(token, index);
  });

  const columns = new Map<string, number>();
  for (const [field, aliases] of Object.entries(config.headers)) {
    const index = aliases.map((alias) => tokenIndexes.get(headerToken(alias))).find((candidate) => candidate !== undefined);
    if (index !== undefined) columns.set(field, index);
  }
  for (const required of config.required) {
    if (!columns.has(required)) {
      issues.push({ code: "REQUIRED_COLUMN_MISSING", severity: "error", sourceLocator: `${sheetName}!${rowIndex + 1}`, message: "A tabela não possui todas as colunas obrigatórias." });
    }
  }
  for (const optional of Object.keys(config.headers)) {
    if (config.optionalWarnings !== false && !["evaluatedOn", "releaseYear"].includes(optional) && !config.required.includes(optional) && !columns.has(optional)) {
      issues.push({ code: "OPTIONAL_COLUMN_MISSING", severity: "warning", sourceLocator: `${sheetName}!${rowIndex + 1}`, message: "Uma coluna competitiva opcional não foi encontrada; esse campo ficará vazio." });
    }
  }
  return columns;
}

function columnLabel(index: number) {
  let label = "";
  let value = index;
  while (value > 0) {
    value -= 1;
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26);
  }
  return label;
}

function valueAt(row: readonly unknown[], columns: FieldColumns, field: string) {
  const index = columns.get(field);
  return index === undefined ? undefined : row[index];
}

function readText(value: unknown) {
  return displayValue(value).trim();
}

function readNumber(
  value: unknown,
  field: string,
  label: string,
  locator: string,
  issues: WorkbookIssue[],
  options: { required?: boolean; minimum?: number; maximum?: number; integer?: boolean } = {},
): number | null {
  if (isBlank(value)) {
    if (options.required) issues.push({ code: `${field.toUpperCase()}_MISSING`, severity: "error", sourceLocator: locator, message: `${label} está vazio ou não tem resultado calculado no arquivo.` });
    return null;
  }
  if (typeof value !== "number" || !Number.isFinite(value)) {
    issues.push({ code: `${field.toUpperCase()}_INVALID`, severity: "error", sourceLocator: locator, message: `${label} precisa ser um número válido.` });
    return null;
  }
  if ((options.minimum !== undefined && value < options.minimum) || (options.maximum !== undefined && value > options.maximum) || (options.integer && !Number.isInteger(value))) {
    issues.push({ code: `${field.toUpperCase()}_OUT_OF_RANGE`, severity: "error", sourceLocator: locator, message: `${label} está fora do intervalo permitido.` });
    return null;
  }
  return value;
}

function locator(sheet: string, row: number, columns: FieldColumns, field: string) {
  const index = columns.get(field);
  return `${sheet}!${index === undefined ? "A" : columnLabel(index + 1)}${row}`;
}

function summaryNumber(value: string | undefined) {
  if (!value) return null;
  const match = /^\s*([+-]?\d+(?:[.,]\d+)?)/.exec(value);
  if (!match) return null;
  const parsed = Number(match[1].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function addSummaryIssues(summary: Record<string, string>, albums: AlbumRecord[], backlog: BacklogRecord[], issues: WorkbookIssue[]) {
  const sourceAlbumCount = summaryNumber(summary["Álbuns ouvidos"]);
  if (sourceAlbumCount !== null && sourceAlbumCount !== albums.length) {
    issues.push({ code: "SUMMARY_ALBUM_COUNT_MISMATCH", severity: "warning", sourceLocator: "Resumo", message: "A contagem de álbuns do resumo difere da tabela de avaliações." });
  }
  const sourceBacklogCount = summaryNumber(summary["Backlog atual"]);
  if (sourceBacklogCount !== null && sourceBacklogCount !== backlog.length) {
    issues.push({ code: "SUMMARY_BACKLOG_COUNT_MISMATCH", severity: "warning", sourceLocator: "Resumo", message: "A contagem de backlog do resumo difere da aba Backlog." });
  }
  const sourceAverage = summaryNumber(summary["Nota média"]);
  const reportedScores = albums.map((album) => album.reportedScore).filter((score): score is number => score !== null);
  if (sourceAverage !== null && reportedScores.length) {
    const calculatedAverage = reportedScores.reduce((sum, score) => sum + score, 0) / reportedScores.length;
    if (Math.round(sourceAverage * 100) !== Math.round(calculatedAverage * 100)) {
      issues.push({ code: "SUMMARY_AVERAGE_MISMATCH", severity: "warning", sourceLocator: "Resumo", message: "A média informada no resumo difere da média recalculada das notas da tabela." });
    }
  }
}

function parseLegacyPlayoffResults(sheets: readonly WorkbookSheetData[], issues: WorkbookIssue[]) {
  const sheet = sheets.find((candidate) => candidate.sheet === "Playoffs");
  if (!sheet) return [] as PublishedPlayoffResult[];
  const header = findHeader(sheet, PLAYOFF_RESULT_HEADERS);
  if (!header) return [] as PublishedPlayoffResult[];

  const columns = mapHeaders(sheet.sheet, header.rowIndex, header.row, PLAYOFF_RESULT_HEADERS, []);
  const optionalColumn = (aliases: string[]) => header.row.findIndex((value) => aliases.some((alias) => headerToken(alias) === headerToken(value)));
  const resultColumn = optionalColumn(["resultado 1ª rodada", "resultado 1a rodada"]);
  const winnerColumn = optionalColumn(["vencedor"]);
  const criterionColumn = optionalColumn(["critério", "criterio"]);
  const results: PublishedPlayoffResult[] = [];

  for (let rowIndex = header.rowIndex + 1; rowIndex < sheet.data.length; rowIndex += 1) {
    const row = sheet.data[rowIndex];
    const result = readText(resultColumn < 0 ? undefined : row[resultColumn]);
    const winner = readText(winnerColumn < 0 ? undefined : row[winnerColumn]);
    const criterion = readText(criterionColumn < 0 ? undefined : row[criterionColumn]);
    if (!result && !winner && !criterion) continue;

    const seedAValue = valueAt(row, columns, "seedA");
    const seedBValue = valueAt(row, columns, "seedB");
    const seedA = typeof seedAValue === "number" && Number.isInteger(seedAValue) && seedAValue > 0 ? seedAValue : null;
    const seedB = typeof seedBValue === "number" && Number.isInteger(seedBValue) && seedBValue > 0 ? seedBValue : null;
    const artistA = readText(valueAt(row, columns, "artistA"));
    const artistB = readText(valueAt(row, columns, "artistB"));
    if (seedA === null || seedB === null || seedA === seedB || !artistA || !artistB) {
      issues.push({ code: "PLAYOFF_RESULT_ROW_INVALID", severity: "warning", sourceLocator: `${sheet.sheet}!${rowIndex + 1}`, message: "Um resultado publicado da primeira rodada não tem dois seeds e artistas válidos; não foi associado a um confronto." });
      continue;
    }

    results.push({ seedA, artistA, seedB, artistB, result, winner, criterion, sourceRow: rowIndex + 1 });
  }
  return results;
}

const PHASE_NAMES: Record<string, PlayoffPhase> = {
  "1ª rodada": "first", "1a rodada": "first", "primeira rodada": "first",
  "oitavas": "roundOf16", "quartas": "quarters", "semifinais": "semis", "final": "final",
};

function parsePublishedPlayoffResults(sheets: readonly WorkbookSheetData[], issues: WorkbookIssue[]) {
  const sheet = sheets.find(s => s.sheet === "Resultados Playoffs");
  if (!sheet) return parseLegacyPlayoffResults(sheets, issues);
  const config: HeaderConfig = {
    headers: { ...PLAYOFF_RESULT_HEADERS.headers, phase: ["fase"], gameId: ["jogo"], result: ["resultado"], winner: ["vencedor"], criterion: ["critério"] },
    required: ["phase", "gameId", "seedA", "artistA", "seedB", "artistB", "result", "winner", "criterion"],
    markers: ["phase", "gameId"],
  };
  const header = findHeader(sheet, config);
  if (!header) {
    issues.push({ code: "PLAYOFF_RESULTS_HEADER_INVALID", severity: "error", sourceLocator: sheet.sheet, message: "A aba Resultados Playoffs não possui o cabeçalho esperado." });
    return [];
  }
  const columns = mapHeaders(sheet.sheet, header.rowIndex, header.row, config, issues);
  const results: PublishedPlayoffResult[] = [];
  let declaresFirst = false;
  for (let i = header.rowIndex + 1; i < sheet.data.length; i++) {
    const row = sheet.data[i];
    const phase = PHASE_NAMES[headerToken(valueAt(row, columns, "phase"))];
    if (phase === "first") declaresFirst = true;
    const result = readText(valueAt(row, columns, "result"));
    const winner = readText(valueAt(row, columns, "winner"));
    const criterion = readText(valueAt(row, columns, "criterion"));
    // Scheduled games and empty future slots are not result facts.
    if (!result && !winner && !criterion) continue;
    const rawGame = readText(valueAt(row, columns, "gameId"));
    const gameId = phase === "first" ? /^jogo\s*0*([1-9]\d?)$/i.exec(rawGame)?.[1] : rawGame.toUpperCase();
    const validGame = phase === "first" ? Number(gameId) >= 1 && Number(gameId) <= 16
      : phase === "roundOf16" ? /^O[1-8]$/.test(gameId ?? "")
      : phase === "quarters" ? /^QF[1-4]$/.test(gameId ?? "")
      : phase === "semis" ? /^SF[12]$/.test(gameId ?? "") : phase === "final" && gameId === "FINAL";
    const seedA = valueAt(row, columns, "seedA");
    const seedB = valueAt(row, columns, "seedB");
    const artistA = readText(valueAt(row, columns, "artistA"));
    const artistB = readText(valueAt(row, columns, "artistB"));
    if (!phase || !validGame || typeof seedA !== "number" || !Number.isInteger(seedA) || seedA < 1 || seedA > 32
      || typeof seedB !== "number" || !Number.isInteger(seedB) || seedB < 1 || seedB > 32 || seedA === seedB || !artistA || !artistB) {
      issues.push({ code: "PLAYOFF_RESULT_ROW_INVALID", severity: "error", sourceLocator: `${sheet.sheet}!${i + 1}`, message: "Resultado com fase, jogo, seeds ou artistas inválidos; corrija a linha antes de publicar." });
      continue;
    }
    results.push({ phase, gameId: phase === "first" ? `Jogo ${gameId!.padStart(2, "0")}` : gameId!, sourceSheet: sheet.sheet,
      seedA, artistA, seedB, artistB, result, winner, criterion, sourceRow: i + 1 });
  }
  // A new table may contain only the later rounds. Once it declares the first
  // round, that round is authoritative and must not be merged with the old copy.
  return declaresFirst ? results : [...parseLegacyPlayoffResults(sheets, issues), ...results];
}

function summaryRecord(sheet?: WorkbookSheetData): Record<string, string> {
  const summary: Record<string, string> = {};
  for (const row of sheet?.data ?? []) {
    const label = readText(row[0]);
    const value = displayValue(row[1]);
    if (label && value) summary[label] = value;
  }
  return summary;
}

export function parseWorkbookSheets(
  sheets: readonly WorkbookSheetData[],
  options: { season: number; sourceVersion: string },
): ParsedSourceWorkbook {
  if (!Number.isInteger(options.season) || options.season < 2000 || options.season > 9999) throw new Error("INVALID_SEASON");
  if (!/^\d+$/.test(options.sourceVersion) || BigInt(options.sourceVersion) > 9223372036854775807n) throw new Error("INVALID_SOURCE_VERSION");

  const issues: WorkbookIssue[] = [];
  const albumSheetName = `Albuns ${options.season}`;
  const albumSheet = sheets.find((sheet) => sheet.sheet === albumSheetName);
  const backlogSheet = sheets.find((sheet) => sheet.sheet === "Backlog");
  const summarySheet = sheets.find((sheet) => sheet.sheet === "Resumo");
  if (!albumSheet) issues.push({ code: "ALBUM_SHEET_MISSING", severity: "error", sourceLocator: albumSheetName, message: "A aba de avaliações da temporada não foi encontrada." });
  if (!backlogSheet) issues.push({ code: "BACKLOG_SHEET_MISSING", severity: "error", sourceLocator: "Backlog", message: "A aba Backlog não foi encontrada." });
  if (!summarySheet) issues.push({ code: "SUMMARY_SHEET_MISSING", severity: "warning", sourceLocator: "Resumo", message: "A aba Resumo não foi encontrada; divergências dos totais não serão conferidas." });

  for (const sheet of sheets) {
    for (let rowIndex = 0; rowIndex < sheet.data.length; rowIndex += 1) {
      const row = sheet.data[rowIndex];
      for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
        if (typeof row[columnIndex] === "string" && EXCEL_ERROR.test(row[columnIndex] as string)) {
          issues.push({ code: "EXCEL_ERROR_VALUE", severity: "warning", sourceLocator: `${sheet.sheet}!${columnLabel(columnIndex + 1)}${rowIndex + 1}`, message: "A planilha contém um valor de erro do Excel." });
        }
      }
    }
  }

  const albumHeader = albumSheet ? findHeader(albumSheet, ALBUM_HEADERS) : null;
  if (albumSheet && !albumHeader) issues.push({ code: "ALBUM_HEADER_NOT_FOUND", severity: "error", sourceLocator: albumSheetName, message: "Não foi possível localizar o cabeçalho da tabela de avaliações." });
  const albumColumns = albumHeader ? mapHeaders(albumSheetName, albumHeader.rowIndex, albumHeader.row, {...ALBUM_HEADERS,optionalWarnings:options.season !== 2027}, issues) : new Map<string, number>();
  const albums: ParsedAlbum[] = [];
  const seenIdentities = new Map<string, number>();
  const seenLooseIdentities = new Map<string, number>();
  const rejectedRows = new Set<string>();
  let albumRows = 0;

  if (albumSheet && albumHeader) {
    for (let rowIndex = albumHeader.rowIndex + 1; rowIndex < albumSheet.data.length; rowIndex += 1) {
      const row = albumSheet.data[rowIndex];
      if (!isNonEmptyRow(row)) continue;
      albumRows += 1;
      const sourceRow = rowIndex + 1;
      const rowIssuesStart = issues.length;
      const artistValue = valueAt(row, albumColumns, "artist");
      const titleValue = valueAt(row, albumColumns, "title");
      const artist = readText(artistValue);
      const title = readText(titleValue);
      if (!artist || !title) {
        rejectedRows.add(`${albumSheetName}!${sourceRow}`);
        issues.push({ code: "ALBUM_IDENTITY_MISSING", severity: "error", sourceLocator: `${albumSheetName}!${sourceRow}`, message: "A linha preenchida precisa conter Artista e Álbum." });
        continue;
      }

      const sourceRank = readNumber(valueAt(row, albumColumns, "sourceRank"), "source_rank", "Rank informado", locator(albumSheetName, sourceRow, albumColumns, "sourceRank"), issues, { minimum: 1, integer: true });
      const reportedScore = readNumber(valueAt(row, albumColumns, "reportedScore"), "reported_score", "Nota informada", locator(albumSheetName, sourceRow, albumColumns, "reportedScore"), issues, { minimum: 0, maximum: 100 });
      const originalScore = readNumber(valueAt(row, albumColumns, "originalScore"), "original_score", "Nota Original", locator(albumSheetName, sourceRow, albumColumns, "originalScore"), issues, { required: true, minimum: 0, maximum: 100 });
      const soundScore = readNumber(valueAt(row, albumColumns, "soundScore"), "sound_score", "Construção Sonora", locator(albumSheetName, sourceRow, albumColumns, "soundScore"), issues, { minimum: 0, maximum: 25 });
      const identityScore = readNumber(valueAt(row, albumColumns, "identityScore"), "identity_score", "Identidade & Personalidade", locator(albumSheetName, sourceRow, albumColumns, "identityScore"), issues, { minimum: 0, maximum: 25 });
      const consistencyScore = readNumber(valueAt(row, albumColumns, "consistencyScore"), "consistency_score", "Consistência & Narrativa", locator(albumSheetName, sourceRow, albumColumns, "consistencyScore"), issues, { minimum: 0, maximum: 25 });
      const replayScore = readNumber(valueAt(row, albumColumns, "replayScore"), "replay_score", "Replay & Impacto", locator(albumSheetName, sourceRow, albumColumns, "replayScore"), issues, { minimum: 0, maximum: 25 });
      const pillarScores = [soundScore, identityScore, consistencyScore, replayScore];
      const evaluationCompleteness = pillarScores.every((score) => score !== null) ? "complete" : "incomplete";
      if (evaluationCompleteness === "complete" && originalScore !== null
        && Math.round(pillarScores.reduce<number>((sum, score) => sum + (score ?? 0), 0) * 1000) !== Math.round(originalScore * 1000)) {
        issues.push({ code: "ORIGINAL_PILLAR_SUM_MISMATCH", severity: "error", sourceLocator: `${albumSheetName}!${sourceRow}`, message: "A soma dos quatro pilares difere da Nota Original." });
      }
      const identityArtist = artist.normalize("NFC").trim();
      const identityTitle = title.normalize("NFC").trim();
      const identityKey = JSON.stringify([options.season, identityArtist, identityTitle, ""]);
      const looseKey = JSON.stringify([options.season, identityArtist.toLocaleLowerCase("pt-BR").replace(/\s+/g, " "), identityTitle.toLocaleLowerCase("pt-BR").replace(/\s+/g, " "), ""]);
      const previousExact = seenIdentities.get(identityKey);
      if (previousExact !== undefined) {
        rejectedRows.add(`${albumSheetName}!${sourceRow}`);
        issues.push({ code: "DUPLICATE_IDENTITY", severity: "error", sourceLocator: `${albumSheetName}!${sourceRow}`, message: `A identidade do álbum também aparece na linha ${previousExact}.` });
      } else {
        const previousLoose = seenLooseIdentities.get(looseKey);
        if (previousLoose !== undefined) issues.push({ code: "POSSIBLE_DUPLICATE_IDENTITY", severity: "warning", sourceLocator: `${albumSheetName}!${sourceRow}`, message: `A identidade pode coincidir com a linha ${previousLoose}; a correspondência não foi fundida.` });
        seenIdentities.set(identityKey, sourceRow);
        seenLooseIdentities.set(looseKey, sourceRow);
      }
      if (reportedScore !== null && originalScore !== null && reportedScore !== originalScore) {
        issues.push({ code: "REPORTED_ORIGINAL_DIFFERENCE", severity: "warning", sourceLocator: `${albumSheetName}!${sourceRow}`, message: "Nota informada e Nota Original diferem; ambos os valores foram preservados." });
      }

      const evaluatedOn = dateValue(readText(valueAt(row, albumColumns, "evaluatedOn")));
      const releaseYear = options.season === 2027 ? readNumber(valueAt(row, albumColumns, "releaseYear"), "release_year", "Ano de lançamento", locator(albumSheetName, sourceRow, albumColumns, "releaseYear"), issues, { minimum: 1000, maximum: 9999, integer: true }) : null;
      if (options.season === 2027) {
        if (evaluatedOn && (!validCalendarDate(evaluatedOn) || !evaluatedOn.startsWith("2027-"))) issues.push({ code: "EVALUATION_DATE_INVALID", severity: "error", sourceLocator: `${albumSheetName}!${sourceRow}`, message: "Data da avaliação deve ser válida e pertencer a 2027." });
        if (!evaluatedOn || releaseYear === null) issues.push({ code: "MONTHLY_METADATA_MISSING", severity: "warning", sourceLocator: `${albumSheetName}!${sourceRow}`, message: "Data da avaliação ou ano de lançamento ausente; classificação mensal exige completar os metadados." });
      }
      albums.push({
        ...(options.season === 2027 ? { evaluatedOn: evaluatedOn || null, releaseYear } : {}),
        sourceRow,
        identityKey,
        sourceRank,
        artist,
        title,
        reportedScore,
        originalScore,
        tier: readText(valueAt(row, albumColumns, "tier")),
        genre: readText(valueAt(row, albumColumns, "genre")),
        country: readText(valueAt(row, albumColumns, "country")),
        source: readText(valueAt(row, albumColumns, "source")),
        evaluationCompleteness,
        soundScore,
        identityScore,
        consistencyScore,
        replayScore,
        repescagem: readText(valueAt(row, albumColumns, "repescagem")),
        repescagemDisqualified: readText(valueAt(row, albumColumns, "repescagemDisqualified")),
        repescagemNote: readText(valueAt(row, albumColumns, "repescagemNote")),
        playInScore: readNumber(valueAt(row, albumColumns, "playInScore"), "play_in_score", "Play-in Score", locator(albumSheetName, sourceRow, albumColumns, "playInScore"), issues),
        playInResult: readText(valueAt(row, albumColumns, "playInResult")),
        prePlayoffScore: readNumber(valueAt(row, albumColumns, "prePlayoffScore"), "pre_playoff_score", "Pré-playoff Score", locator(albumSheetName, sourceRow, albumColumns, "prePlayoffScore"), issues),
        prePlayoffResult: readText(valueAt(row, albumColumns, "prePlayoffResult")),
        prePlayoffTiebreak: readText(valueAt(row, albumColumns, "prePlayoffTiebreak")),
        playoffSeed: readNumber(valueAt(row, albumColumns, "playoffSeed"), "playoff_seed", "Seed Playoff", locator(albumSheetName, sourceRow, albumColumns, "playoffSeed"), issues, { minimum: 1, integer: true }),
        top50BestPhase: readText(valueAt(row, albumColumns, "top50BestPhase")),
        top50Bonus: readNumber(valueAt(row, albumColumns, "top50Bonus"), "top50_bonus", "Bônus Top 50", locator(albumSheetName, sourceRow, albumColumns, "top50Bonus"), issues),
        top50Index: readNumber(valueAt(row, albumColumns, "top50Index"), "top50_index", "Índice Top 50", locator(albumSheetName, sourceRow, albumColumns, "top50Index"), issues),
        top50SourceRank: readNumber(valueAt(row, albumColumns, "top50SourceRank"), "top50_source_rank", "Rank Top 50 informado", locator(albumSheetName, sourceRow, albumColumns, "top50SourceRank"), issues, { minimum: 1, integer: true }),
      });
      if (issues.slice(rowIssuesStart).some((issue) => issue.severity === "error")) rejectedRows.add(`${albumSheetName}!${sourceRow}`);
    }
  }
  if (albumRows === 0) issues.push({ code: "NO_ALBUM_ROWS", severity: "error", sourceLocator: albumSheetName, message: "A planilha não contém avaliações." });

  const backlogHeader = backlogSheet ? findHeader(backlogSheet, BACKLOG_HEADERS) : null;
  if (backlogSheet && !backlogHeader) issues.push({ code: "BACKLOG_HEADER_NOT_FOUND", severity: "error", sourceLocator: "Backlog", message: "Não foi possível localizar o cabeçalho da tabela Backlog." });
  const backlogColumns = backlogHeader ? mapHeaders("Backlog", backlogHeader.rowIndex, backlogHeader.row, BACKLOG_HEADERS, issues) : new Map<string, number>();
  const backlog: BacklogRecord[] = [];
  const seenBacklogOrders = new Set<number>();
  let backlogRows = 0;
  if (backlogSheet && backlogHeader) {
    for (let rowIndex = backlogHeader.rowIndex + 1; rowIndex < backlogSheet.data.length; rowIndex += 1) {
      const row = backlogSheet.data[rowIndex];
      if (!isNonEmptyRow(row)) continue;
      backlogRows += 1;
      const sourceRow = rowIndex + 1;
      const rowIssuesStart = issues.length;
      const artist = readText(valueAt(row, backlogColumns, "artist"));
      const title = readText(valueAt(row, backlogColumns, "title"));
      if (!artist || !title) {
        rejectedRows.add(`Backlog!${sourceRow}`);
        issues.push({ code: "BACKLOG_IDENTITY_MISSING", severity: "error", sourceLocator: `Backlog!${sourceRow}`, message: "A linha preenchida precisa conter Artista e Álbum." });
        continue;
      }
      const providedOrder = readNumber(valueAt(row, backlogColumns, "order"), "backlog_order", "Ordem do backlog", locator("Backlog", sourceRow, backlogColumns, "order"), issues, { minimum: 1, integer: true });
      const order = providedOrder ?? backlog.length + 1;
      if (seenBacklogOrders.has(order)) {
        rejectedRows.add(`Backlog!${sourceRow}`);
        issues.push({ code: "DUPLICATE_BACKLOG_ORDER", severity: "error", sourceLocator: locator("Backlog", sourceRow, backlogColumns, "order"), message: "A ordem do backlog aparece mais de uma vez." });
      }
      seenBacklogOrders.add(order);
      backlog.push({ order, artist, title, priority: readText(valueAt(row, backlogColumns, "priority")), source: readText(valueAt(row, backlogColumns, "source")) });
      if (issues.slice(rowIssuesStart).some((issue) => issue.severity === "error")) rejectedRows.add(`Backlog!${sourceRow}`);
    }
  }

  const summary = summaryRecord(summarySheet);
  if (summarySheet) addSummaryIssues(summary, albums, backlog, issues);
  const playoffResults = parsePublishedPlayoffResults(sheets, issues);
  const top50Decisions = parseTop50Decisions(sheets, issues);
  const monthlyRecords = options.season === 2027 ? parseMonthlyRecords(sheets, issues) : undefined;
  const reportedOriginalDifferences = issues.filter((issue) => issue.code === "REPORTED_ORIGINAL_DIFFERENCE").length;
  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;
  const referenceDate = dateValue(summary["Data de referência"] ?? "");

  return {
    season: options.season,
    sourceVersion: options.sourceVersion,
    referenceDate,
    summary,
    albums,
    backlog,
    playoffResults,
    top50Decisions,
    ...(monthlyRecords ? { monthlyRecords } : {}),
    issues,
    counts: {
      albumRows,
      albums: albums.length,
      backlogRows,
      backlog: backlog.length,
      rejectedRows: rejectedRows.size,
      reportedOriginalDifferences,
      incompleteEvaluations: albums.filter((album) => album.evaluationCompleteness === "incomplete").length,
      errors,
      warnings,
    },
    canPublish: errors === 0 && albums.length > 0,
  };
}
