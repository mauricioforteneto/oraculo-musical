import { describe, expect, it, vi } from "vitest";
import { DriveReader, selectCandidate, type DriveFile } from "../../src/lib/ingestion/drive";
const file = (version: string, overrides: Partial<DriveFile> = {}): DriveFile => ({
  id: `fake-${version}`, name: `albuns_2026_mauricio_atualizado_v${version}_synthetic.xlsx`,
  mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  modifiedTime: "2026-01-01T00:00:00Z", size: "4", version: "1", parents: ["fictional-folder"], ...overrides,
});
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });

describe("seleção da fonte", () => {
  it("compara versões numericamente, não pela data", () => {
    expect(selectCandidate([file("9", { modifiedTime: "2026-02-01T00:00:00Z" }), file("10")], 2026, "fictional-folder").sourceVersion).toBe("10");
  });
  it("bloqueia empates incluindo zeros à esquerda", () => {
    expect(() => selectCandidate([file("10"), file("010")], 2026, "fictional-folder")).toThrow("AMBIGUOUS_VERSION");
  });
  it("ignora outro ano, tipo, pasta e lixeira", () => {
    for (const overrides of [{ name: "albuns_2025_mauricio_atualizado_v10_synthetic.xlsx" }, { mimeType: "application/pdf" }, { parents: ["other"] }, { trashed: true }]) {
      expect(() => selectCandidate([file("10", overrides)], 2026, "fictional-folder")).toThrow("SOURCE_NOT_FOUND");
    }
  });
  it("preserva precisão de bigint e rejeita overflow do banco", () => {
    expect(selectCandidate([file("9007199254740993"), file("9007199254740992")], 2026, "fictional-folder").sourceVersion).toBe("9007199254740993");
    expect(() => selectCandidate([file("9223372036854775808")], 2026, "fictional-folder")).toThrow("VERSION_OUT_OF_RANGE");
  });
});
describe("leitor Drive somente leitura", () => {
  it("pagina e seleciona arquivo da segunda página", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(json({ files: [file("9")], nextPageToken: "page2" })).mockResolvedValueOnce(json({ files: [file("10")] }));
    const reader = new DriveReader(async () => "synthetic-token", fetcher);
    expect((await reader.latest("fictional-folder", 2026)).sourceVersion).toBe("10");
    expect(String(fetcher.mock.calls[1][0])).toContain("pageToken=page2");
    expect(fetcher.mock.calls[0][1]?.headers).toEqual({ Authorization: "Bearer synthetic-token" });
    expect(fetcher.mock.calls.every(call => !call[1]?.method)).toBe(true);
  });
  it("recusa busca incompleta ou ciclo de paginação", async () => {
    const incomplete = new DriveReader(async () => "t", vi.fn<typeof fetch>().mockResolvedValue(json({ files: [], incompleteSearch: true })));
    await expect(incomplete.latest("fictional-folder", 2026)).rejects.toThrow("INCOMPLETE_DRIVE_LIST");
    const cycle = new DriveReader(async () => "t", vi.fn<typeof fetch>().mockImplementation(async () => json({ files: [], nextPageToken: "again" })));
    await expect(cycle.latest("fictional-folder", 2026)).rejects.toThrow("INVALID_DRIVE_PAGINATION");
  });
  it("403 não tem retry e 503 tem limite de três tentativas", async () => {
    const denied = vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 403 }));
    await expect(new DriveReader(async () => "t", denied).latest("fictional-folder", 2026)).rejects.toThrow("DRIVE_ACCESS_DENIED");
    expect(denied).toHaveBeenCalledTimes(1);
    const unavailable = vi.fn<typeof fetch>().mockImplementation(async () => new Response("", { status: 503 }));
    const sleep = vi.fn(async () => {});
    await expect(new DriveReader(async () => "t", unavailable, sleep).latest("fictional-folder", 2026)).rejects.toThrow("DRIVE_UNAVAILABLE");
    expect(unavailable).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });
  it("baixa bytes, confere revisão e calcula hash sem publicar", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(new Uint8Array([80,75,3,4]))).mockResolvedValueOnce(json(file("10")));
    const result = await new DriveReader(async () => "t", fetcher).download({ file: file("10"), sourceVersion: "10" });
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result.bytes.length).toBe(4);
  });
  it("mudança de revisão ou tamanho invalida download", async () => {
    const changed = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(new Uint8Array([80,75,3,4]))).mockResolvedValueOnce(json(file("10", { version: "2" })));
    await expect(new DriveReader(async () => "t", changed).download({ file: file("10"), sourceVersion: "10" })).rejects.toThrow("FILE_CHANGED_DURING_READ");
    const short = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(new Uint8Array([80,75])));
    await expect(new DriveReader(async () => "t", short).download({ file: file("10"), sourceVersion: "10" })).rejects.toThrow("FILE_CHANGED_DURING_READ");
  });
  it("limita tamanho antes do download", async () => {
    const fetcher = vi.fn<typeof fetch>();
    await expect(new DriveReader(async () => "t", fetcher).download({ file: file("10", { size: "10485761" }), sourceVersion: "10" })).rejects.toThrow("FILE_TOO_LARGE");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
