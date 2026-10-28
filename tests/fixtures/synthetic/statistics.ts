import { syntheticAlbum } from "./top50";

// Entirely fictitious records; the final row is retained history, not current.
export function syntheticStatisticsAlbums() {
  return [
    syntheticAlbum(1, { artist: "Banda & Convidado", genre: "Rock / jazz / ROCK", country: "Brasil", originalScore: 80, reportedScore: 100, top50Index: 120 }),
    syntheticAlbum(2, { artist: "Banda & Convidado", genre: "jazz / Pop", country: "  brasil  ", originalScore: null }),
    syntheticAlbum(3, { genre: "Post-rock", country: "Escócia", originalScore: 60 }),
    syntheticAlbum(4, { genre: "  ", country: "Inglaterra", originalScore: 0 }),
    syntheticAlbum(5, { genre: "Pop", country: "Irlanda do Norte", originalScore: 100 }),
    syntheticAlbum(6, { genre: "rock", country: "", originalScore: null }),
    syntheticAlbum(7, { genre: "Metal", country: "França", originalScore: 100, isPresent: false }),
  ];
}
