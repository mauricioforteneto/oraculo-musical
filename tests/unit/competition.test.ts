import { describe, expect, it, vi } from "vitest";
import type { AlbumRecord } from "../../src/lib/catalog/types";
import { albumIdentity, buildParticipants, CUTOFF_UTC, firstRound, participantChanges, projectResidualTop50, reseedRoundOf16 } from "../../src/lib/competition/rules";
import { DriveReader, type DriveFile } from "../../src/lib/ingestion/drive";
import { freezeTokenMatches } from "../../src/lib/competition/token";

function album(i: number, patch: Partial<AlbumRecord> = {}): AlbumRecord {
  return { sourceRow: i + 2, sourceRank: i, artist: `Fictional Artist ${i}`, title: `Fictional Album ${i}`,
    reportedScore: 90, originalScore: 90, tier: "Elite", genre: "", country: "", source: "", soundScore: null,
    identityScore: null, consistencyScore: null, replayScore: null, repescagem: "", repescagemDisqualified: "",
    repescagemNote: "", playInScore: null, playInResult: "", prePlayoffScore: null, prePlayoffResult: "",
    prePlayoffTiebreak: "", playoffSeed: i, top50BestPhase: "", top50Bonus: null, top50Index: null, top50SourceRank: null, ...patch };
}
function field(n: number) { return Array.from({ length: n }, (_, i) => album(i + 1, { originalScore: i < 8 ? 99 - i : 89 - (i % 5) })); }

describe("congelamento e chave fictícios", () => {
  for (const [n, byes, games] of [[24, 8, 8], [25, 7, 9], [32, 0, 16]]) {
    it(`monta N=${n} com ${byes} byes e ${games} jogos`, () => {
      const built = buildParticipants(field(n));
      expect(built.canFreeze).toBe(true);
      const bracket = firstRound(built.participants)!;
      expect(bracket.byes).toHaveLength(byes);
      expect(bracket.matches).toHaveLength(games);
      expect(bracket.matches[0].high.seed).toBe(byes + 1);
      expect(bracket.matches[0].low.seed).toBe(n);
      expect(new Set([...bracket.byes, ...bracket.matches.flatMap(m => [m.high, m.low])].map(p => p.seed)).size).toBe(n);
      expect(bracket.roundOf16.map(s => `${s.slot}:${s.highRank}x${s.lowRank}`)).toEqual(["A:1x16", "B:8x9", "C:4x13", "D:5x12", "E:2x15", "F:7x10", "G:3x14", "H:6x11"]);
    });
  }
  it("recusa tamanho e seeds inválidos; mantém divergência de ordem como aviso", () => {
    expect(buildParticipants(field(33)).issues.map(i => i.code)).toContain("FIELD_SIZE_OUT_OF_RANGE");
    expect(buildParticipants(field(24).map((a, i) => i === 0 ? { ...a, playoffSeed: null } : a)).canFreeze).toBe(false);
    expect(buildParticipants(field(24).map((a, i) => i === 0 ? { ...a, playoffSeed: 2 } : a)).issues.map(i => i.code)).toContain("SEED_DUPLICATE");
    expect(buildParticipants(field(24).map((a, i) => i === 0 ? { ...a, playoffSeed: 25 } : a)).issues.map(i => i.code)).toContain("SEED_OUT_OF_RANGE");
    const swapped = field(24); [swapped[0].playoffSeed, swapped[1].playoffSeed] = [2, 1];
    expect(buildParticipants(swapped).canFreeze).toBe(true);
    expect(buildParticipants(swapped).issues.map(i => i.code)).toContain("SEED_ORDER_DIVERGENCE");
  });
  it("preserva classificado prévio e exige resultado verificável", () => {
    const data = field(24);
    expect(buildParticipants(data.slice(1), [albumIdentity(data[0])]).issues.map(i => i.code)).toContain("CLASSIFIED_PARTICIPANT_OMITTED");
    const pre = album(30, { originalScore: 78, prePlayoffResult: "Classificado", prePlayoffScore: null, playoffSeed: null });
    expect(buildParticipants([...data, pre]).issues.map(i => i.code)).toContain("PRE_QUALIFICATION_UNVERIFIED");
  });
  it("faz um reseeding real sem inventar vencedores", () => {
    const participants = buildParticipants(field(24)).participants;
    const survivors = [...participants.slice(0, 8), ...participants.slice(16)];
    const round = reseedRoundOf16(survivors)!;
    expect(round).toHaveLength(8);
    expect(round[0].high.seed).toBe(1);
    expect(round[0].low.seed).toBe(24);
    expect(round[1].high.seed).toBe(8);
    expect(round[1].low.seed).toBe(17);
    expect(reseedRoundOf16(survivors.slice(1))).toBeNull();
  });
  it("audita inclusão, remoção e alteração em correção", () => {
    const before = buildParticipants(field(24)).participants;
    const after = [...before.slice(1).map(p => p.seed === 2 ? { ...p, seed: 1 } : p), { ...before[0], identityKey: "fictional-new", seed: 2 }];
    const diff = participantChanges(before, after);
    expect(diff.added).toHaveLength(1);
    expect(diff.removed).toHaveLength(1);
    expect(diff.changed).toHaveLength(1);
  });
});

describe("Top 50 residual fictício", () => {
  const participants = buildParticipants(field(24)).participants;
  const entrant = (i: number, originalScore: number, patch: Partial<AlbumRecord> = {}) => album(i, { originalScore, playoffSeed: null, tier: "Eliminado", ...patch });
  it("aplica o maior bônus não cumulativo e aceita 79 sem fase", () => {
    const records = [entrant(41, 70, { repescagem: "Eliminado — Etapa 2", playInScore: 12, playInResult: "Eliminado", prePlayoffScore: 10, prePlayoffResult: "Eliminado" }),
      entrant(42, 70, { playInScore: 10, playInResult: "Eliminado" }), entrant(43, 70, { repescagem: "Eliminado — Etapa 1" }),
      entrant(44, 79), entrant(45, 78)];
    const result = projectResidualTop50(records, participants, records.map(albumIdentity));
    expect(result.entries.map(e => e.bonus)).toEqual([0, 6, 3, 1]);
    expect(result.entries.find(e => e.title === "Fictional Album 45")).toBeUndefined();
  });
  it("mantém entrada tardia fora dos Playoffs e conflito de fase sem posição", () => {
    const records = [entrant(51, 85), entrant(52, 80, { top50BestPhase: "Pré-playoff" })];
    const result = projectResidualTop50(records, participants, []);
    expect(result.entries[0].late).toBe(true);
    expect(result.entries[0].position).toBe(25);
    expect(result.entries[1].position).toBeNull();
    expect(result.unresolved).toBe(1);
  });
  it("bloqueia posição da última vaga quando o desempate continua igual", () => {
    const records = Array.from({ length: 27 }, (_, i) => entrant(100 + i, 80));
    const result = projectResidualTop50(records, participants, records.map(albumIdentity));
    expect(result.tieAtCut).toBe(true);
    expect(result.entries.filter(e => e.position !== null)).toHaveLength(0);
  });
  it("mantém a mesma posição provisória para empate interno", () => {
    const records = [entrant(140, 80), entrant(141, 80), entrant(142, 79)];
    const result = projectResidualTop50(records, participants, records.map(albumIdentity));
    expect(result.entries.map(e => e.position)).toEqual([25, 25, 27]);
  });
});

describe("seleção do corte no Drive", () => {
  const file = (n: number, modifiedTime: string): DriveFile => ({ id: `f${n}`, name: `albuns_2026_mauricio_atualizado_v${n}_synthetic.xlsx`,
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", modifiedTime, size: "4", version: "1", parents: ["fictional"] });
  it("seleciona maior versão anterior ao limite exclusivo", async () => {
    const files = [file(10, "2026-09-30T23:00:00Z"), file(11, CUTOFF_UTC), file(9, "2026-09-28T00:00:00Z")];
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async () => new Response(JSON.stringify({ files })));
    const reader = new DriveReader(async () => "fake", fetcher);
    expect((await reader.latest("fictional", 2026, CUTOFF_UTC)).sourceVersion).toBe("10");
    expect((await reader.latest("fictional", 2026, undefined, CUTOFF_UTC)).sourceVersion).toBe("11");
  });
  it("rejeita revisão modificada entre lista e download", async () => {
    const before = file(10, "2026-09-30T23:00:00Z");
    const after = { ...before, version: "2" };
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(new Uint8Array([80, 75, 3, 4]))).mockResolvedValueOnce(new Response(JSON.stringify(after)));
    await expect(new DriveReader(async () => "fake", fetcher).download({ file: before, sourceVersion: "10" })).rejects.toThrow("FILE_CHANGED_DURING_READ");
  });
  it("recusa confirmação quando arquivo, revisão ou hash mudou desde a prévia", () => {
    const candidate = { file: file(10, "2026-09-30T23:00:00Z"), sourceVersion: "10" };
    const token = { fileId: candidate.file.id, fileVersion: "10", driveRevision: "1", modifiedAt: candidate.file.modifiedTime, sha256: "a".repeat(64), activeFreezeId: null };
    expect(freezeTokenMatches(candidate, token, token.sha256)).toBe(true);
    expect(freezeTokenMatches(candidate, token, "b".repeat(64))).toBe(false);
    expect(freezeTokenMatches({ ...candidate, file: { ...candidate.file, version: "2" } }, token, token.sha256)).toBe(false);
    expect(freezeTokenMatches({ ...candidate, sourceVersion: "11" }, token, token.sha256)).toBe(false);
  });
});
