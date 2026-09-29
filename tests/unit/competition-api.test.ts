import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, previewFreeze, confirmFreeze } = vi.hoisted(() => ({ getUser: vi.fn(), previewFreeze: vi.fn(), confirmFreeze: vi.fn() }));
vi.mock("@/lib/auth", () => ({ authConfigured: () => true, authClient: async () => ({ auth: { getUser } }) }));
vi.mock("@/lib/competition/service", () => ({ previewFreeze, confirmFreeze, competitionFailure: () => ({ code: "COMPETITION_FAILED", status: 503 }) }));

import { POST as preview } from "../../src/app/api/competition/preview/route";
import { POST as freeze } from "../../src/app/api/competition/freeze/route";

const request = (path: string, origin: string | null, body: unknown) => new Request(`http://localhost:3000${path}`, {
  method: "POST", headers: { ...(origin ? { Origin: origin } : {}), "Content-Type": "application/json" }, body: JSON.stringify(body),
});
beforeEach(() => { vi.stubEnv("APP_ORIGIN", "http://localhost:3000"); vi.stubEnv("OWNER_USER_ID", "owner-id"); getUser.mockResolvedValue({ data: { user: { id: "owner-id" } }, error: null }); });
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });

describe("rotas privadas da competição", () => {
  it("bloqueia origem ausente ou divergente antes de consultar autenticação", async () => {
    for (const origin of [null, "http://evil.test"]) {
      expect((await preview(request("/api/competition/preview", origin, { mode: "initial" }))).status).toBe(403);
      expect((await freeze(request("/api/competition/freeze", origin, {}))).status).toBe(403);
    }
    expect(getUser).not.toHaveBeenCalled();
  });
  it("nega outra conta e não executa a prévia", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "visitor" } }, error: null });
    const response = await preview(request("/api/competition/preview", "http://localhost:3000", { mode: "initial" }));
    expect(response.status).toBe(403);
    expect(previewFreeze).not.toHaveBeenCalled();
  });
  it("aceita apenas proprietário e inclui no-store", async () => {
    previewFreeze.mockResolvedValue({ mode: "initial", canConfirm: false });
    const response = await preview(request("/api/competition/preview", "http://localhost:3000", { mode: "initial" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(previewFreeze).toHaveBeenCalledWith("initial");
  });
});
