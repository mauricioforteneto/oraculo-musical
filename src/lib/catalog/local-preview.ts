import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { AlbumRecord, BacklogRecord, LocalSourcePreview, PublishedPlayoffResult } from "./types";

const text = (value: unknown) => typeof value === "string" ? value : "";
const number = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

function albumRecord(value: unknown): AlbumRecord | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const artist = text(item.artist).trim();
  const title = text(item.title).trim();
  const sourceRow = number(item.sourceRow);
  if (!artist || !title || sourceRow === null) return null;
  const soundScore = number(item.soundScore);
  const identityScore = number(item.identityScore);
  const consistencyScore = number(item.consistencyScore);
  const replayScore = number(item.replayScore);
  const evaluationCompleteness = [soundScore, identityScore, consistencyScore, replayScore].every((score) => score !== null)
    ? "complete" as const
    : "incomplete" as const;
  return {
    sourceRow,
    sourceRank: number(item.sourceRank),
    artist,
    title,
    reportedScore: number(item.reportedScore),
    originalScore: number(item.originalScore),
    tier: text(item.tier),
    genre: text(item.genre),
    country: text(item.country),
    source: text(item.source),
    isPresent: true,
    evaluationCompleteness,
    soundScore,
    identityScore,
    consistencyScore,
    replayScore,
    repescagem: text(item.repescagem),
    repescagemDisqualified: text(item.repescagemDisqualified),
    repescagemNote: text(item.repescagemNote),
    playInScore: number(item.playInScore),
    playInResult: text(item.playInResult),
    prePlayoffScore: number(item.prePlayoffScore),
    prePlayoffResult: text(item.prePlayoffResult),
    prePlayoffTiebreak: text(item.prePlayoffTiebreak),
    playoffSeed: number(item.playoffSeed),
    top50BestPhase: text(item.top50BestPhase),
    top50Bonus: number(item.top50Bonus),
    top50Index: number(item.top50Index),
    top50SourceRank: number(item.top50SourceRank),
  };
}

function backlogRecord(value: unknown): BacklogRecord | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const order = number(item.order);
  const artist = text(item.artist).trim();
  const title = text(item.title).trim();
  if (order === null || !artist || !title) return null;
  return { order, artist, title, priority: text(item.priority), source: text(item.source) };
}

function playoffResult(value: unknown): PublishedPlayoffResult | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const seedA = number(item.seedA);
  const seedB = number(item.seedB);
  const sourceRow = number(item.sourceRow);
  const artistA = text(item.artistA).trim();
  const artistB = text(item.artistB).trim();
  if (seedA === null || seedB === null || sourceRow === null || !artistA || !artistB) return null;
  return { seedA, artistA, seedB, artistB, result: text(item.result), winner: text(item.winner), criterion: text(item.criterion), sourceRow };
}

export async function getLocalSourcePreview(): Promise<LocalSourcePreview | null> {
  // The workbook copy is a development-only preview. Production reads from the database.
  if (process.env.NODE_ENV === "production") return null;

  const file = path.join(process.cwd(), ".private", "source-preview.json");
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return null;
    throw error;
  }

  if (!parsed || typeof parsed !== "object") return null;
  const data = parsed as Record<string, unknown>;
  const albums = Array.isArray(data.albums) ? data.albums.map(albumRecord).filter((item): item is AlbumRecord => item !== null) : [];
  const backlog = Array.isArray(data.backlog) ? data.backlog.map(backlogRecord).filter((item): item is BacklogRecord => item !== null) : [];
  const playoffResults = Array.isArray(data.playoffResults) ? data.playoffResults.map(playoffResult).filter((item): item is PublishedPlayoffResult => item !== null) : [];
  const summary = data.summary && typeof data.summary === "object" ? data.summary as Record<string, unknown> : {};

  return {
    version: number(data.version) ?? 0,
    referenceDate: text(data.referenceDate),
    summary: Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, text(value)])),
    albums,
    backlog,
    playoffResults,
  };
}
