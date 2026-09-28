import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(), exchangeCodeForSession: vi.fn(), getUser: vi.fn(), signOut: vi.fn(),
}));
const configured = vi.hoisted(() => vi.fn(() => true));
vi.mock("../../src/lib/auth", () => ({ authClient: async () => ({ auth }), authConfigured: configured }));
// These handlers import through the same alias as the real application.
vi.mock("@/lib/auth", () => ({ authClient: async () => ({ auth }), authConfigured: configured }));
import { POST } from "../../src/app/auth/login/route";
import { GET } from "../../src/app/auth/callback/route";

beforeEach(() => {
  vi.stubEnv("APP_ORIGIN", "https://music.example");
  vi.stubEnv("OWNER_USER_ID", "owner");
  vi.clearAllMocks(); configured.mockReturnValue(true);
  auth.signInWithOAuth.mockResolvedValue({ data: { url: "https://auth.example/authorize" }, error: null });
  auth.exchangeCodeForSession.mockResolvedValue({ error: null });
  auth.getUser.mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  auth.signOut.mockResolvedValue({ error: null });
});
afterEach(() => vi.unstubAllEnvs());
describe("Google OAuth / PKCE", () => {
  it("inicia somente Google, com callback fixo e sem pedir acesso ao Drive", async () => {
    const response = await POST(new Request("https://music.example/auth/login", { method: "POST", headers: { origin: "https://music.example" } }));
    expect(response.headers.get("location")).toBe("https://auth.example/authorize");
    expect(auth.signInWithOAuth).toHaveBeenCalledWith({ provider: "google", options: {
      redirectTo: "https://music.example/auth/callback", skipBrowserRedirect: true, queryParams: { prompt: "select_account" },
    } });
  });
  it("não inicia fluxo a partir de origem estrangeira", async () => {
    expect((await POST(new Request("https://music.example/auth/login", { method: "POST", headers: { origin: "https://evil.example" } }))).status).toBe(403);
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  });
  it("exige código e rejeita cancelamento sem trocar sessão", async () => {
    for (const query of ["", "?error=access_denied", "?error=denied&code=abc"]) {
      expect((await GET(new Request("https://music.example/auth/callback" + query))).headers.get("location")).toBe("https://music.example/login?error=oauth");
    }
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
  it("código inválido, expirado ou sem verifier não dá acesso", async () => {
    auth.exchangeCodeForSession.mockResolvedValue({ error: { message: "invalid code" } });
    expect((await GET(new Request("https://music.example/auth/callback?code=bad"))).headers.get("location")).toContain("error=oauth");
    expect(auth.getUser).not.toHaveBeenCalled();
  });
  it("outra conta é desconectada mesmo com código válido", async () => {
    auth.getUser.mockResolvedValue({ data: { user: { id: "other" } }, error: null });
    expect((await GET(new Request("https://music.example/auth/callback?code=valid"))).headers.get("location")).toBe("https://music.example/login?error=access");
    expect(auth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });
  it("ignora next e Host externos após autorizar dono", async () => {
    const response = await GET(new Request("https://evil.example/auth/callback?code=valid&next=https://evil.example", { headers: { "x-forwarded-host": "evil.example" } }));
    expect(auth.exchangeCodeForSession).toHaveBeenCalledWith("valid");
    expect(response.headers.get("location")).toBe("https://music.example/");
  });
  it("configuração ausente permanece fechada", async () => {
    configured.mockReturnValue(false);
    expect((await GET(new Request("https://music.example/auth/callback?code=valid"))).status).toBe(503);
    expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
  });
});
