import type { AlbumRecord } from "./types";
import { recordKey } from "./ranking";

export type StatisticsDimension = "genres" | "countries" | "artists";
export type StatisticsAlbum = Pick<AlbumRecord, "artist" | "title" | "originalScore" | "genre" | "country"> & { key: string };
export type StatisticsGroup = {
  key: string; label: string; count: number; percentage: number;
  scoredCount: number; average: number | null; albumKeys: string[];
};
export type CatalogStatistics = {
  total: number; scoredCount: number; average: number | null;
  genreCount: number; countryCount: number; artistCount: number; allArtistsSingleAlbum: boolean;
  groups: Record<StatisticsDimension, StatisticsGroup[]>; albums: StatisticsAlbum[];
};

const cleanCategory = (value: string) => value.normalize("NFC").trim().replace(/\s+/gu, " ");
const validScore = (score: number | null) => typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100 ? score : null;

export function buildCatalogStatistics(records: AlbumRecord[]): CatalogStatistics {
  const albums: StatisticsAlbum[] = records.filter(a => a.isPresent !== false).map(a => ({
    key: recordKey(a), artist: a.artist, title: a.title, originalScore: validScore(a.originalScore), genre: a.genre, country: a.country,
  })).sort((a, b) => (b.originalScore ?? -1) - (a.originalScore ?? -1)
    || a.artist.localeCompare(b.artist, "pt-BR") || a.title.localeCompare(b.title, "pt-BR"));
  const scores = albums.flatMap(a => a.originalScore === null ? [] : [a.originalScore]);

  function aggregate(dimension: StatisticsDimension): StatisticsGroup[] {
    const groups = new Map<string, StatisticsGroup & { sum: number }>();
    for (const album of albums) {
      const values = dimension === "genres" ? album.genre.split("/").map(cleanCategory).filter(Boolean)
        : dimension === "countries" ? [cleanCategory(album.country)].filter(Boolean) : [album.artist.normalize("NFC").trim()].filter(Boolean);
      const distinct = new Map<string, string>();
      for (const value of values) distinct.set(`value:${dimension === "artists" ? value : value.toLocaleLowerCase("pt-BR")}`, value);
      if (distinct.size === 0) distinct.set("missing:", "Não informado");
      for (const [key, label] of distinct) {
        let group = groups.get(key);
        if (!group) {
          group = { key, label, count: 0, percentage: 0, scoredCount: 0, average: null, albumKeys: [], sum: 0 };
          groups.set(key, group);
        }
        group.count++; group.albumKeys.push(album.key);
        if (album.originalScore !== null) { group.sum += album.originalScore; group.scoredCount++; }
      }
    }
    return [...groups.values()].map(({ sum, ...group }) => ({ ...group,
      percentage: albums.length ? group.count / albums.length * 100 : 0,
      average: group.scoredCount ? sum / group.scoredCount : null,
    })).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR") || a.key.localeCompare(b.key));
  }
  const groups = { genres: aggregate("genres"), countries: aggregate("countries"), artists: aggregate("artists") };
  const knownCount = (list: StatisticsGroup[]) => list.filter(g => g.key !== "missing:").length;
  return { total: albums.length, scoredCount: scores.length, average: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null,
    genreCount: knownCount(groups.genres), countryCount: knownCount(groups.countries), artistCount: knownCount(groups.artists),
    allArtistsSingleAlbum: groups.artists.length > 0 && groups.artists.every(g => g.count === 1), groups, albums };
}

export function albumsForStatisticsGroup(statistics: CatalogStatistics, dimension: StatisticsDimension, key: string): StatisticsAlbum[] {
  const group = statistics.groups[dimension].find(g => g.key === key);
  if (!group) return [];
  const keys = new Set(group.albumKeys);
  return statistics.albums.filter(a => keys.has(a.key));
}
