export type AlbumRecord = {
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

export type LocalSourcePreview = {
  version: number;
  referenceDate: string;
  summary: Record<string, string>;
  albums: AlbumRecord[];
  backlog: BacklogRecord[];
};
