import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
const repo = fileURLToPath(new URL("../../",import.meta.url));
const root = await mkdtemp(resolve(repo,".private-layout-check-"));
let server, browser;
try {
  await writeFile(resolve(root,"index.html"),'<html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><body><div id="root"></div><script type="module" src="/tests/browser/layout-fixture.tsx"></script></body></html>');
  server = await createServer({root,configFile:false,define:{"process.env":"{}"},resolve:{alias:{"@":resolve(repo,"src"),"next/navigation":resolve(repo,"tests/browser/navigation.tsx"),"next/link":resolve(repo,"tests/browser/navigation.tsx")}},server:{host:"127.0.0.1",port:3216,strictPort:true,fs:{allow:[repo]}},plugins:[{name:"fixture-source",resolveId(id){ if(id.startsWith("/tests/")||id.startsWith("/src/")) return repo+id; }}]});
  await server.listen();
  browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || "/usr/bin/chromium",headless:true,args:["--no-sandbox"]});
  const page = await browser.newPage({viewport:{width:390,height:844}});
  const errors = []; const mutations = [];
  page.on("pageerror",error => errors.push(error.message));
  await page.route("**/api/**",async route => {
    mutations.push({url:new URL(route.request().url()).pathname,body:route.request().postDataJSON()});
    const url = new URL(route.request().url()).pathname;
    await route.fulfill({json: url.endsWith("/preview") ? {
      mode:"correction",draft:false,canConfirm:true,token:{synthetic:"review-token"},participants:[],issues:[],
      file:{version:"101",name:"synthetic-v101.xlsx",modifiedAt:"2026-10-01T03:00:00Z",sha256:"a".repeat(64)},
      changes:{added:[],removed:[],changed:[]},
    } : url.endsWith("/freeze") ? {participants:24,fileVersion:"101"} : {status:"succeeded",version:"101"}});
  });
  const origin = "http://127.0.0.1:3216";
  for (const width of [360,390,768,1280]) {
    await page.setViewportSize({width,height:844});
    for (const path of ["/","/albuns","/albuns/00000000-0000-4000-8000-000000000001","/top-50","/playoffs","/playoffs?aba=historico","/estatisticas","/historico","/sincronizacao"]) {
      await page.goto(origin+path);
      await page.locator("main h1").waitFor();
      assert.equal(await page.locator("main").count(),1);
      assert.equal(await page.locator("h1").count(),1);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`overflow: ${path} at ${width}`);
      assert.equal(await page.getByText("OCULTO BACKLOG",{exact:true}).count(),0);
      if (width < 1000) {
        const nav = page.getByRole("navigation",{name:"Navegação mobile",exact:true});
        assert(await nav.isVisible());
        const sizes = await nav.locator("a,button").evaluateAll(items => items.map(i => i.getBoundingClientRect().height));
        assert(sizes.every(h => h >= 44));
        assert.equal(await nav.getByRole("link").count(),4);
        if (path.startsWith("/albuns/")) assert.equal(await nav.getByRole("link",{name:"Álbuns",exact:true}).getAttribute("aria-current"),"page");
        if (["/estatisticas","/historico","/sincronizacao"].includes(path)) assert.equal(await nav.getByRole("button",{name:"Mais",exact:true}).getAttribute("aria-current"),"page");
        await page.evaluate(() => scrollTo(0,document.body.scrollHeight));
        const footer = await page.locator("footer").boundingBox(); const bar = await nav.boundingBox();
        assert(footer.y+footer.height <= bar.y,`covered footer at ${width}`);
      }
    }
    await page.goto(origin+"/albuns");
    await page.screenshot({path:`/tmp/oraculo-albuns-${width}.png`,fullPage:true});
  }
  assert.equal(mutations.length,0,"Visiting pages must never issue mutations or previews");
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin+"/albuns");
  const more = page.getByRole("navigation",{name:"Navegação mobile",exact:true}).getByRole("button",{name:"Mais",exact:true});
  await more.click(); const menu = page.getByRole("dialog",{name:"Mais do Oráculo"}); await menu.waitFor();
  assert.equal(await page.evaluate(() => document.body.style.overflow),"hidden");
  for(let i=0;i<12;i++) { await page.keyboard.press("Tab"); assert(await page.evaluate(() => document.querySelector("dialog").contains(document.activeElement)),"focus escaped the dialog"); }
  await page.keyboard.press("Escape"); await menu.waitFor({state:"hidden"}); assert(await more.evaluate(el => el === document.activeElement));
  assert.equal(await page.evaluate(() => document.body.style.overflow),"");
  await more.click(); await menu.getByRole("button",{name:"Fechar menu"}).click(); await menu.waitFor({state:"hidden"});
  await more.click(); await page.mouse.click(3,3); await menu.waitFor({state:"hidden"});
  await more.click(); await menu.getByRole("link",{name:"Estatísticas",exact:true}).click(); await page.getByRole("heading",{name:"Estatísticas",exact:true}).waitFor();
  assert.equal(await page.locator("dialog[open]").count(),0); assert.equal(await page.evaluate(() => document.body.style.overflow),"");
  // Statistics drill-down links lead to evaluations.
  await page.getByRole("button",{name:/^Não informado/}).click();
  assert((await page.getByRole("region",{name:"Álbuns do grupo selecionado"}).getByRole("link").count()) > 0);
  await page.goto(origin+"/albuns");
  await page.getByRole("searchbox").fill("fictício"); await page.getByRole("button",{name:"80+",exact:true}).click();
  await page.getByRole("button",{name:/Mostrar mais álbuns/}).click();
  const saved = new URL(page.url()).search;
  assert.equal(await page.getByRole("region",{name:"Ranking anual"}).locator("ol li").count(),30);
  await page.getByRole("region",{name:"Ranking anual"}).getByRole("link").first().click();
  await page.getByRole("heading",{name:"Detalhe do álbum"}).waitFor();
  assert.equal(new URL(page.url()).search,saved);
  await page.getByRole("link",{name:"Voltar aos álbuns",exact:true}).click();
  assert.equal(new URL(page.url()).search,saved);
  assert.equal(await page.getByRole("searchbox").inputValue(),"fictício");
  assert.equal(await page.getByRole("region",{name:"Ranking anual"}).locator("ol li").count(),30);
  await page.getByRole("region",{name:"Ranking anual"}).getByRole("link").first().click(); await page.goBack();
  assert.equal(new URL(page.url()).search,saved);
  await page.goto(origin+"/sincronizacao");
  await page.getByRole("button",{name:"Sincronizar",exact:true}).click();
  await page.getByRole("status").filter({hasText:"Versão 101 publicada."}).waitFor();
  assert.equal(mutations.length,1); assert.equal(mutations[0].url,"/api/sync");
  await page.getByText("Operação do corte e auditoria",{exact:true}).click();
  await page.getByRole("button",{name:"Prévia de correção",exact:true}).click();
  await page.getByText("Comparação com snapshot ativo",{exact:true}).waitFor();
  const confirm = page.getByRole("button",{name:"Confirmar correção auditada",exact:true});
  assert(await confirm.isDisabled());
  await page.getByLabel("Confirmo que há backup restaurável atualizado antes desta operação.").check();
  await page.getByLabel("Justificativa da correção").fill("Correção fictícia revisada no teste");
  assert(await confirm.isDisabled());
  await page.getByLabel("Confirmo a elegibilidade de cada participante no corte de 30/09.").check();
  await page.getByLabel("Confirmo que nenhuma primeira partida foi realizada.").check();
  await confirm.click();
  await page.getByRole("status").filter({hasText:"Snapshot confirmado"}).waitFor();
  assert.deepEqual(mutations.map(m => m.url),["/api/sync","/api/competition/preview","/api/competition/freeze"]);
  assert.deepEqual(mutations[2].body,{mode:"correction",token:{synthetic:"review-token"},backupAttested:true,eligibilityAttested:true,noMatchAttested:true,reason:"Correção fictícia revisada no teste"});
  await page.getByRole("navigation",{name:"Navegação mobile",exact:true}).getByRole("link",{name:"Início",exact:true}).click();
  await page.getByRole("heading",{name:"O ano em discos."}).waitFor();
  assert(await page.getByText("Fonte v101",{exact:true}).isVisible());
  for (const [hash,path] of [["#acervo","/albuns"],["#top-50","/top-50"],["#chaveamento","/playoffs"],["#historico-competitivo","/playoffs?aba=historico"],["#backlog","/"]]) {
    await page.goto(origin+"/"+hash); await page.waitForURL(origin+path);
  }
  assert.deepEqual(errors,[]);
  console.log("Layout Chromium: 9 telas × 4 larguras; menu, foco, teclado, busca/retorno, links, sincronização e hashes passaram.");
} finally { await browser?.close(); await server?.close(); await rm(root,{recursive:true,force:true}); }
