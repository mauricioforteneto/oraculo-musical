import { createHash } from "node:crypto";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const ROOT = "https://www.googleapis.com/drive/v3/files";
const MAX_BYTES = 10 * 1024 * 1024;
export class SourceError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "SourceError"; }
}
export type DriveFile = {
  id: string; name: string; mimeType: string; modifiedTime: string; size: string;
  version: string; parents: string[]; trashed?: boolean;
};
export type Candidate = { file: DriveFile; sourceVersion: string };

export function selectCandidate(files: DriveFile[], season: number, folder: string): Candidate {
  if (!Number.isInteger(season) || season < 2000 || season > 9999) throw new SourceError("INVALID_SEASON");
  const pattern = new RegExp(`^albuns_${season}_mauricio_atualizado_v([0-9]+)_.+\\.xlsx$`);
  const candidates = files.flatMap(file => {
    const match = pattern.exec(file.name);
    if (!match || file.trashed || file.mimeType !== XLSX || !file.parents.includes(folder)) return [];
    const version = BigInt(match[1]);
    if (version > 9223372036854775807n) throw new SourceError("VERSION_OUT_OF_RANGE");
    return [{ file, sourceVersion: version.toString() }];
  });
  if (!candidates.length) throw new SourceError("SOURCE_NOT_FOUND");
  const highest = candidates.reduce((a, b) => BigInt(a.sourceVersion) > BigInt(b.sourceVersion) ? a : b);
  if (candidates.filter(c => c.sourceVersion === highest.sourceVersion).length !== 1) throw new SourceError("AMBIGUOUS_VERSION");
  return highest;
}

function fileMetadata(value: unknown): DriveFile {
  if (!value || typeof value !== "object") throw new SourceError("INVALID_DRIVE_RESPONSE");
  const item = value as Record<string, unknown>;
  for (const key of ["id", "name", "mimeType", "modifiedTime", "size", "version"]) {
    if (typeof item[key] !== "string" || !item[key]) throw new SourceError("INVALID_DRIVE_RESPONSE");
  }
  if (!Array.isArray(item.parents) || !item.parents.every(p => typeof p === "string")) throw new SourceError("INVALID_DRIVE_RESPONSE");
  if (!/^\d+$/.test(item.size as string) || !/^\d+$/.test(item.version as string) || Number.isNaN(Date.parse(item.modifiedTime as string))) throw new SourceError("INVALID_DRIVE_RESPONSE");
  return item as DriveFile;
}

export class DriveReader {
  constructor(
    private readonly token: () => Promise<string>,
    private readonly fetcher: typeof fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
  ) {}

  private async request(url: URL): Promise<Response> {
    for (let attempt = 0; attempt < 3; attempt++) {
      let response: Response;
      try {
        response = await this.fetcher(url, {
          headers: { Authorization: `Bearer ${await this.token()}` },
          cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000),
        });
      } catch { throw new SourceError("DRIVE_UNAVAILABLE"); }
      if (response.ok) return response;
      const transient = response.status === 429 || response.status >= 500;
      if (transient && attempt < 2) {
        await response.body?.cancel();
        const retry = response.headers.get("retry-after");
        const retryMs = retry ? (/^\d+$/.test(retry) ? Number(retry) * 1000 : Date.parse(retry) - Date.now()) : 0;
        // Do not retry earlier than requested or wait past this request's budget.
        if (retryMs > 10_000) throw new SourceError("DRIVE_RETRY_LATER");
        await this.sleep(Math.max(Number.isFinite(retryMs) ? retryMs : 0, 500 * 2 ** attempt + Math.random() * 200));
        continue;
      }
      await response.body?.cancel();
      throw new SourceError(response.status === 401 || response.status === 403 ? "DRIVE_ACCESS_DENIED" : response.status === 404 ? "SOURCE_NOT_FOUND" : "DRIVE_UNAVAILABLE");
    }
    throw new SourceError("DRIVE_UNAVAILABLE");
  }

  async latest(folder: string, season: number): Promise<Candidate> {
    if (!/^[a-zA-Z0-9_-]+$/.test(folder)) throw new SourceError("INVALID_FOLDER");
    const files: DriveFile[] = [], seen = new Set<string>(), ids = new Set<string>();
    let pageToken: string | undefined;
    for (let page = 0; page < 100; page++) {
      const url = new URL(ROOT);
      url.searchParams.set("q", `'${folder}' in parents and trashed = false and mimeType = '${XLSX}'`);
      url.searchParams.set("fields", "nextPageToken,incompleteSearch,files(id,name,mimeType,modifiedTime,size,version,parents,trashed)");
      url.searchParams.set("pageSize", "100");
      if (pageToken) url.searchParams.set("pageToken", pageToken);
      const body = await (await this.request(url)).json();
      if (!Array.isArray(body.files) || body.incompleteSearch === true) throw new SourceError("INCOMPLETE_DRIVE_LIST");
      for (const raw of body.files) {
        const file = fileMetadata(raw);
        if (ids.has(file.id)) throw new SourceError("UNSTABLE_DRIVE_LIST");
        ids.add(file.id); files.push(file);
      }
      if (!body.nextPageToken) return selectCandidate(files, season, folder);
      if (typeof body.nextPageToken !== "string" || seen.has(body.nextPageToken)) throw new SourceError("INVALID_DRIVE_PAGINATION");
      pageToken = body.nextPageToken; seen.add(pageToken!);
    }
    throw new SourceError("DRIVE_LIST_LIMIT");
  }

  async download(candidate: Candidate) {
    const before = candidate.file;
    if (BigInt(before.size) > BigInt(MAX_BYTES)) throw new SourceError("FILE_TOO_LARGE");
    const url = new URL(`${ROOT}/${encodeURIComponent(before.id)}`);
    url.searchParams.set("alt", "media");
    const response = await this.request(url);
    if (!response.body) throw new SourceError("EMPTY_FILE");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = []; let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) throw new SourceError("FILE_TOO_LARGE");
        chunks.push(value);
      }
    } catch (error) { await reader.cancel(); throw error instanceof SourceError ? error : new SourceError("DRIVE_UNAVAILABLE"); }
    finally { reader.releaseLock(); }
    if (BigInt(total) !== BigInt(before.size)) throw new SourceError("FILE_CHANGED_DURING_READ");
    const metaUrl = new URL(`${ROOT}/${encodeURIComponent(before.id)}`);
    metaUrl.searchParams.set("fields", "id,name,mimeType,modifiedTime,size,version,parents,trashed");
    const after = fileMetadata(await (await this.request(metaUrl)).json());
    if (after.trashed || after.id !== before.id || after.name !== before.name || after.mimeType !== XLSX ||
      after.version !== before.version || after.modifiedTime !== before.modifiedTime || after.size !== before.size ||
      [...after.parents].sort().join() !== [...before.parents].sort().join()) throw new SourceError("FILE_CHANGED_DURING_READ");
    const bytes = Buffer.concat(chunks);
    if (bytes.length < 4 || bytes.readUInt32LE(0) !== 0x04034b50) throw new SourceError("INVALID_XLSX_CONTAINER");
    return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), candidate };
  }
}
