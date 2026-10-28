import { expect, test } from "@playwright/test";

test("rota privada redireciona sem sessão e configuração", async ({ request }) => {
  const response = await request.get("/", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login");
});
test("estado de preparação não expõe dados pessoais", async ({ request }) => {
  const response = await request.get("/login");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.text()).toContain("Seu espaço está em preparação");
});
test("estatísticas exigem sessão e não expõem dados sem configuração", async ({ request }) => {
  const response = await request.get("/estatisticas", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.text()).not.toContain("Resumo estatístico");
});
test("POST exige origem válida e autenticação configurada", async ({ request }) => {
  const foreign = await request.post("/auth/login", { headers: { origin: "https://foreign.example" }, form: { email: "synthetic@example.com", password: "fictional" } });
  expect(foreign.status()).toBe(403);
  const local = await request.post("/auth/login", { headers: { origin: "http://localhost:3100" }, form: { email: "synthetic@example.com", password: "fictional" } });
  expect(local.status()).toBe(503);
  expect((await request.get("/auth/logout")).status()).toBe(405);
  expect((await request.get("/auth/callback?code=synthetic")).status()).toBe(503);
});
