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
test("histórico exige sessão antes de consultar versões", async ({ request }) => {
  const response = await request.get("/historico?versao=100&pagina=2", { maxRedirects: 0 });
  expect(response.status()).toBe(307);
  expect(response.headers().location).toContain("/login");
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.text()).not.toContain("Comparação selecionada");
});
test("POST exige origem válida e autenticação configurada", async ({ request }) => {
  const foreign = await request.post("/auth/login", { headers: { origin: "https://foreign.example" }, form: { email: "synthetic@example.com", password: "fictional" } });
  expect(foreign.status()).toBe(403);
  const local = await request.post("/auth/login", { headers: { origin: "http://localhost:3100" }, form: { email: "synthetic@example.com", password: "fictional" } });
  expect(local.status()).toBe(503);
  expect((await request.get("/auth/logout")).status()).toBe(405);
  expect((await request.get("/auth/callback?code=synthetic")).status()).toBe(503);
});

for (const path of ["/pendencias?tipo=facts&origem=publication", "/albuns?capas=revisar", "/albuns?q=jazz&nota=80&limite=45", "/albuns/00000000-0000-4000-8000-000000000001", "/albuns/invalid", "/top-50", "/playoffs", "/playoffs?aba=historico", "/sincronizacao"]) {
  test(`nova rota exige sessão: ${path}`, async ({ request }) => {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(307);
    expect(response.headers().location).toContain("/login");
    expect(response.headers()["cache-control"]).toContain("no-store");
    expect(await response.text()).not.toContain('id="conteudo"');
  });
}

test('capas exigem proprietário e origem válida; GET não inicia operações',async({request})=>{
  for(const path of ['/api/artwork/batch','/api/artwork/00000000-0000-4000-8000-000000000001/search','/api/artwork/00000000-0000-4000-8000-000000000001/selection']) {
    expect((await request.get(path)).status()).toBe(405);
    expect((await request.post(path,{headers:{origin:'https://foreign.example'},data:{}})).status()).toBe(403);
    const response=await request.post(path,{headers:{origin:'http://localhost:3100'},data:{}});
    expect(response.status()).toBe(401);expect(response.headers()['cache-control']).toContain('no-store');
  }
});
