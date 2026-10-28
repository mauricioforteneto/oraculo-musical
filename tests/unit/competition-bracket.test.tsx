import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { CompetitionBracket } from "../../src/components/competition-bracket";
import { firstRound, type Participant } from "../../src/lib/competition/rules";

const participants: Participant[] = Array.from({ length: 24 }, (_, i) => ({
  identityKey: `synthetic-${i}`, artist: `Artista fictício ${i + 1}`, title: `Álbum fictício com título extenso ${i + 1}`,
  originalScore: 90, route: "elite", seed: i + 1, sourceRow: i + 2, evidence: {},
}));
const bracket = firstRound(participants)!;
const results = bracket.matches.map(({ high, low }, i) => ({
  seedA: high.seed, artistA: high.artist, seedB: low.seed, artistB: low.artist,
  winner: `${low.artist} (#${low.seed})`, result: "13 × 13", criterion: "Desempate: Replay", sourceRow: i + 2,
}));

describe("apresentação da chave", () => {
  it("abre nas oitavas reais e oferece as cinco fases sem anunciar campeão", () => {
    const html = renderToStaticMarkup(<CompetitionBracket bracket={bracket} results={results} resultsVersion="90" />);
    expect(html).toMatch(/aria-pressed="true"[^>]*><strong>Oitavas<\/strong>/);
    expect(html).toContain("Semifinais");
    expect(html).toContain("Final");
    expect(html).toContain("Álbum fictício com título extenso 24");
    expect(html).not.toContain("Álbum fictício com título extenso 16");
    expect(html).toContain("Sem resultados publicados nesta fase.");
    expect(html).toContain("Nota original: 90 de 100");
    expect(html).not.toContain("RESULTADO PUBLICADO");
  });

  it("mostra fonte, byes e motivo específico do jogo pendente na primeira rodada", () => {
    const incomplete = results.slice(0, -1);
    const html = renderToStaticMarkup(<CompetitionBracket bracket={bracket} results={incomplete} resultsVersion="90" />);
    expect(html).toMatch(/aria-pressed="true"[^>]*><strong>Primeira rodada<\/strong>/);
    expect(html).toContain("1 jogo pendente");
    expect(html).toContain("Jogo 8:");
    expect(html).toContain("Nenhum resultado publicado pôde ser associado");
    expect(html).toContain("Direto para as oitavas");
    expect(html).toContain("RESULTADO · V90");
    expect(html).toContain("RESULTADO PUBLICADO · LINHA 2");
    expect(html).toContain("Desempate: Replay");
  });
});
