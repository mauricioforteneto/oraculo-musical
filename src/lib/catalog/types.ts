import type { AlbumArtwork, ArtworkSummary } from "@/lib/artwork/types";
export type AlbumRecord = {
  /** Database identity supplied only when reading the published source. */
  albumId?: string;
  artwork?: AlbumArtwork;
  /** Last workbook containing this record; retained rows may predate the publication. */
  provenance?: { version: string; fileName: string; sourceLocator: string | null };
  sourceRow: number;
  sourceRank: number | null;
  artist: string;
  title: string;
  reportedScore: number | null;
  originalScore: number | null;
  tier: string;
  genre: string;
  country: string;
  source: string;
  isPresent?: boolean;
  evaluationCompleteness?: "complete" | "incomplete";
  soundScore: number | null;
  identityScore: number | null;
  consistencyScore: number | null;
  replayScore: number | null;
  repescagem: string;
  repescagemDisqualified: string;
  repescagemNote: string;
  playInScore: number | null;
  playInResult: string;
  prePlayoffScore: number | null;
  prePlayoffResult: string;
  prePlayoffTiebreak: string;
  playoffSeed: number | null;
  top50BestPhase: string;
  top50Bonus: number | null;
  top50Index: number | null;
  top50SourceRank: number | null;
};

export type BacklogRecord = {
  order: number;
  artist: string;
  title: string;
  priority: string;
  source: string;
};

export type PlayoffPhase = "first" | "roundOf16" | "quarters" | "semis" | "final";
export type PublishedPlayoffResult = {
  // Missing phase denotes a legacy first-round record.
  phase?: PlayoffPhase;
  gameId?: string;
  sourceSheet?: string;
  seedA: number;
  artistA: string;
  seedB: number;
  artistB: string;
  result: string;
  winner: string;
  criterion: string;
  sourceRow: number;
};

export type LocalSourcePreview = {
  artworkSummary?: ArtworkSummary;
  version: number | string | null;
  referenceDate: string;
  publishedAt?: string | null;
  fileName?: string | null;
  /** Undefined means no successful import report was found, rather than zero warnings. */
  publicationIssues?: Array<{ code: string; severity: "warning" | "error"; sourceLocator: string; message: string }>;
  lastAttempt?: {
    status: "running" | "succeeded" | "unchanged" | "failed";
    startedAt: string;
    finishedAt: string | null;
    errorCode: string | null;
    version?: string | null;
    fileName?: string | null;
    counts: Record<string, number>;
    issues: Array<{ code: string; severity: "warning" | "error"; sourceLocator: string; message: string }>;
  } | null;
  attemptHistory?: Array<{
    status: "running" | "succeeded" | "unchanged" | "failed";
    startedAt: string;
    finishedAt: string | null;
    version: string | null;
    isCurrentPublication: boolean;
    errorCode: string | null;
    issueCount: number;
  }>;
  summary: Record<string, string>;
  albums: AlbumRecord[];
  backlog: BacklogRecord[];
  playoffResults: PublishedPlayoffResult[];
};
