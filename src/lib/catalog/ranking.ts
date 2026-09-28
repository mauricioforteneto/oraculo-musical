import type { AlbumRecord } from "./types";

export type RankedAlbum = AlbumRecord & { key: string; annualPosition: number };

export function recordKey(album: AlbumRecord) {
  return encodeURIComponent(album.artist) + "::" + encodeURIComponent(album.title);
}

export function rankAnnualAlbums(records: AlbumRecord[]): RankedAlbum[] {
  const sorted = [...records].sort((a, b) => {
    const scoreA = a.originalScore;
    const scoreB = b.originalScore;
    if (scoreA === null && scoreB !== null) return 1;
    if (scoreB === null && scoreA !== null) return -1;
    if (scoreA !== scoreB) return (scoreB ?? -1) - (scoreA ?? -1);
    return a.artist.localeCompare(b.artist, "pt-BR") || a.title.localeCompare(b.title, "pt-BR");
  });

  let position = 0;
  let previous: number | null | undefined;
  return sorted.map((album, index) => {
    if (album.originalScore !== previous) position = index + 1;
    previous = album.originalScore;
    return { ...album, key: recordKey(album), annualPosition: album.originalScore === null ? 0 : position };
  });
}
