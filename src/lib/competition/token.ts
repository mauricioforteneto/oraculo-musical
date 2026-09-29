import type { Candidate } from "@/lib/ingestion/drive";

export type FreezeToken = { fileId: string; fileVersion: string; driveRevision: string; modifiedAt: string; sha256: string; activeFreezeId: string | null };
export function freezeTokenMatches(candidate: Candidate, token: FreezeToken, hash: string) {
  return candidate.file.id === token.fileId && candidate.sourceVersion === token.fileVersion &&
    candidate.file.version === token.driveRevision && candidate.file.modifiedTime === token.modifiedAt && hash === token.sha256;
}
