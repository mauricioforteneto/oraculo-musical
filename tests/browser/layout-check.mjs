import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "../../src/lib/theme-init.mjs";
const repo = fileURLToPath(new URL("../../",import.meta.url));
const root = await mkdtemp(resolve(repo,".private-layout-check-"));
const artifactDir = resolve(repo,process.env.LAYOUT_ARTIFACT_DIR || "test-results/layout");
await mkdir(artifactDir,{recursive:true});
let server, browser, context, page;
try {
  const fonts = "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,200..800&family=Source+Serif+4:opsz,wght@8..60,200..900&display=swap";
  await writeFile(resolve(root,"index.html"),`<html lang="pt-BR"><head><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Oráculo Musical — teste com dados fictícios</title><meta name="description" content="Verificação de layout com componentes reais e dados sintéticos."><script>${THEME_INIT_SCRIPT}</script><link rel="stylesheet" href="${fonts}"></head><body><div id="root"></div><script type="module" src="/tests/browser/layout-fixture.tsx"></script></body></html>`);
  server = await createServer({root,configFile:false,define:{"process.env":"{}"},resolve:{alias:{"@":resolve(repo,"src"),"next/navigation":resolve(repo,"tests/browser/navigation.tsx"),"next/link":resolve(repo,"tests/browser/navigation.tsx")}},server:{host:"127.0.0.1",port:3216,strictPort:true,fs:{allow:[repo]}},plugins:[{name:"fixture-source",resolveId(id){ if(id.startsWith("/tests/")||id.startsWith("/src/")) return repo+id; }}]});
  await server.listen();
  const executablePath = process.env.CHROMIUM_PATH || (existsSync(chromium.executablePath()) ? chromium.executablePath() : "/usr/bin/chromium");
  browser = await chromium.launch({executablePath,headless:true,args:["--no-sandbox"]});
  context = await browser.newContext({viewport:{width:390,height:844}});
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});
  page = await context.newPage();
  await page.addInitScript(()=>{
    Object.defineProperty(navigator,"clipboard",{configurable:true,value:{writeText:async text=>{
      if(window.fixtureClipboardBlocked) throw new Error("synthetic clipboard denial");
      window.fixtureClipboardText=text;
    }}});
  });
  const errors = []; const mutations = [];
  const artworkSummary={ready:true,total:44,found:44,missing:0,ambiguous:0,error:0,hidden:0,pending:0,due:0};
  const artworkValue={status:"found",selection:"manual",releaseGroupId:"11111111-1111-4111-8111-111111111111",thumbnailUrl:"https://archive.org/download/synthetic/250.jpg",imageUrl:"https://archive.org/download/synthetic/500.jpg",checkedAt:"2026-10-01",nextAttemptAt:null};
  const artworkCandidate={id:artworkValue.releaseGroupId,artist:"Artista de capa fictícia",title:"Disco fictício",year:"2026",score:100};
  const appleArtwork={...artworkValue,provider:"itunes",releaseGroupId:null,itunesCollectionId:"123",providerUrl:"https://music.apple.com/br/album/synthetic/123",thumbnailUrl:"https://is1-ssl.mzstatic.com/image/thumb/synthetic/250.jpg",imageUrl:"https://is1-ssl.mzstatic.com/image/thumb/synthetic/500.jpg"};
  const appleCandidate={...artworkCandidate,id:"itunes:123",provider:"itunes"};
  let slowBatch=false,batchCalls=0,recoveryMode=null,recoveryCalls=0;
  await page.route(/^https:\/\/(?:archive\.org|is1-ssl\.mzstatic\.com)\//,async route=>{
    if(route.request().url().endsWith("broken.jpg")) return route.fulfill({status:404,body:""});
    await route.fulfill({contentType:"image/svg+xml",body:'<svg xmlns="http://www.w3.org/2000/svg" width="250" height="250"><rect width="250" height="250" fill="#7c563b"/><circle cx="125" cy="125" r="76" fill="#182019"/><circle cx="125" cy="125" r="22" fill="#dfa775"/></svg>'});
  });
  page.on("pageerror",error => errors.push(error.message));
  await page.route("**/api/**",async route => {
    mutations.push({url:new URL(route.request().url()).pathname,season:new URL(route.request().url()).searchParams.get("temporada"),body:route.request().postDataJSON()});
    const url = new URL(route.request().url()).pathname;
    if(url==="/api/artwork/batch") {
      batchCalls++;
      if(recoveryMode && recoveryCalls++===0) return route.fulfill({json:{processed:1,remaining:0,paused:false,summary:{...artworkSummary,found:43,error:1},nextRetryAt:new Date(Date.now()+(recoveryMode==='recover'?1200:60000)).toISOString()}});
      if(slowBatch) {
        await new Promise(resolve=>setTimeout(resolve,300));
        return route.fulfill({json:{processed:5,remaining:30,paused:false,summary:{...artworkSummary,found:14,pending:30,due:30}}});
      }
      return route.fulfill({json:{processed:5,remaining:0,paused:false,summary:artworkSummary}});
    }
    if(url.endsWith("/search")) return route.fulfill({json:{candidates:[route.request().postDataJSON().provider==="itunes" ? appleCandidate : artworkCandidate]}});
    if(url.endsWith("/selection")) {
      const {action,groupId}=route.request().postDataJSON();
      return route.fulfill({json:action==="hide" || action==="automatic" ? {status:action==="hide"?"hidden":"pending"} : {candidate:groupId?.startsWith("itunes:")?appleCandidate:artworkCandidate,artwork:groupId?.startsWith("itunes:")?appleArtwork:artworkValue}});
    }
    await route.fulfill({json: url.endsWith("/preview") ? {
      mode:"correction",draft:false,canConfirm:true,token:{synthetic:"review-token"},participants:[],issues:[],
      file:{version:"101",name:"synthetic-v101.xlsx",modifiedAt:"2026-10-01T03:00:00Z",sha256:"a".repeat(64)},
      changes:{added:[],removed:[],changed:[]},
    } : url.endsWith("/freeze") ? {participants:24,fileVersion:"101"} : {status:"succeeded",version:"101"}});
  });
  const origin = "http://127.0.0.1:3216";
  await page.goto(origin+"/albuns");
  for (const mode of ["light","dark"]) {
  await page.evaluate(({key,mode})=>localStorage.setItem(key,mode),{key:THEME_STORAGE_KEY,mode});
  for (const width of [360,390,768,1280]) {
    await page.setViewportSize({width,height:844});
    for (const path of ["/","/pendencias","/albuns","/albuns?capas=revisar","/albuns/00000000-0000-4000-8000-000000000001","/top-50","/playoffs","/playoffs?aba=historico","/estatisticas","/historico","/sincronizacao","/regras?temporada=2026","/regras?temporada=2027","/albuns?temporada=2027","/playoffs?temporada=2027"]) {
      await page.goto(origin+path);
      await page.locator("main h1").waitFor();
      await page.evaluate(async()=>{await document.fonts.load('800 28px "Bricolage Grotesque"');await document.fonts.load('400 17px "Source Serif 4"');await document.fonts.ready;});
      assert(await page.evaluate(()=>document.fonts.check('800 28px "Bricolage Grotesque"')), "Fonte editorial indisponível");
      assert(await page.evaluate(()=>["Bricolage Grotesque","Source Serif 4"].every(name=>Array.from(document.fonts).some(face=>face.family.includes(name) && face.status==="loaded"))), "Famílias editoriais não carregadas");
      assert.equal(await page.locator("html").getAttribute("data-mode"),mode);
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
        if (["/pendencias","/estatisticas","/historico","/sincronizacao"].includes(path)) assert.equal(await nav.getByRole("button",{name:"Mais",exact:true}).getAttribute("aria-current"),"page");
        await page.evaluate(() => scrollTo(0,document.body.scrollHeight));
        const footer = await page.locator("footer").boundingBox(); const bar = await nav.boundingBox();
        assert(footer.y+footer.height <= bar.y,`covered footer at ${width}`);
      }
      if(path.includes("temporada=")) {
        const kind=path.startsWith("/regras")?`regras-${path.endsWith("2026")?2026:2027}`:path.startsWith("/playoffs")?"mensal-2027":"albuns-2027";
        await page.evaluate(()=>scrollTo(0,0));
        await page.screenshot({path:resolve(artifactDir,`oraculo-${kind}-${mode}-${width}-viewport.jpg`),type:"jpeg",quality:90});
        await page.screenshot({path:resolve(artifactDir,`oraculo-${kind}-${mode}-${width}.png`),fullPage:true});
        if(path.startsWith("/playoffs")) {
          await page.getByRole("button",{name:/Dezembro/}).click();
          await page.getByText("Preparar fechamento na planilha",{exact:true}).click();
          assert(await page.getByRole("button",{name:"Copiar orientação de fechamento"}).isDisabled());
          assert(await page.getByText(/O corte de dezembro e o prazo do AOTY/).isVisible());
        }
      }
      if(path === "/albuns" || path === "/albuns?capas=revisar") {
        const shot = `${path.includes("?") ? "oraculo-capas-revisar" : "oraculo-albuns"}-${mode}`;
        // Text can overflow a grid cell without overflowing the page itself.
        const positionRight = await page.getByText("Posição",{exact:true}).evaluate(element=>{
          const range=document.createRange(); range.selectNodeContents(element);
          return range.getBoundingClientRect().right;
        });
        const albumHeading = await page.getByText("Álbum",{exact:true}).boundingBox();
        assert(albumHeading && positionRight + 4 <= albumHeading.x,`Cabeçalhos Posição e Álbum encostados em ${width}px (${path})`);
        // Load off-screen lazy covers before capturing the entire list.
        await page.locator("img").evaluateAll(images=>images.forEach(image=>{image.loading="eager";}));
        await page.waitForFunction(()=>Array.from(document.images).every(image=>image.complete),undefined,{timeout:10000});
        await page.evaluate(()=>scrollTo(0,0));
        await page.screenshot({path:resolve(artifactDir,`${shot}-${width}.png`),fullPage:true});
        await page.screenshot({path:resolve(artifactDir,`${shot}-${width}-viewport.png`)});
        await page.screenshot({path:resolve(artifactDir,`${shot}-${width}-viewport.jpg`),type:"jpeg",quality:90});
        await page.screenshot({path:resolve(artifactDir,`${shot}-${width}.jpg`),type:"jpeg",quality:90,fullPage:true});
        if(path==="/albuns") {
          const first=await page.getByRole("region",{name:"Ranking anual",exact:true}).locator("ol > li").first().boundingBox();
          const bar=width < 1000 ? await page.getByRole("navigation",{name:"Navegação mobile",exact:true}).boundingBox() : null;
          assert(first && first.y + first.height <= (width < 1000 ? bar.y : 844),`Primeiro álbum fora da primeira tela em ${width}px (${mode})`);
        }
      }
    }
    console.log(`Layout: 15 telas e capturas verificadas em ${width}px, tema ${mode}.`);
  }
  // Season switching clears source-bound filters and closes the mobile menu.
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin+"/albuns?capas=revisar&q=jazz&versao=99");
  await page.getByRole("button",{name:"Mais",exact:true}).click();
  await page.getByRole("dialog").getByLabel("Temporada",{exact:true}).selectOption("2027");
  await page.waitForFunction(()=>location.search==="?temporada=2027" && !document.querySelector("dialog[open]"));
  assert.equal(new URL(page.url()).search,"?temporada=2027");
  assert(!(await page.getByRole("dialog").isVisible()));
  assert.equal(await page.evaluate(()=>document.body.style.overflow),"");
  await page.getByRole("region",{name:"Ranking anual",exact:true}).locator("ol > li a").first().click();
  assert(new URL(page.url()).pathname.startsWith("/albuns/"));
  assert.equal(new URL(page.url()).searchParams.get("temporada"),"2027");
  await page.getByRole("button",{name:"Mais",exact:true}).click();
  await page.getByRole("dialog").getByLabel("Temporada",{exact:true}).selectOption("2026");
  assert.equal(new URL(page.url()).pathname,"/albuns");
  assert.equal(new URL(page.url()).search,"?temporada=2026");
  await page.goto(origin+"/playoffs?temporada=2027");
  assert(await page.getByText("Classificados confirmados",{exact:true}).isVisible());
  await page.getByText("Preparar correção do fechamento",{exact:true}).click();
  await page.getByRole("button",{name:"Copiar orientação de fechamento"}).click();
  const copied=await page.evaluate(()=>window.fixtureClipboardText);
  assert(copied.includes("Status: Pendente") && copied.includes("Corrige fechamento: jan-ficticio-1"));
  await page.getByRole("button",{name:/Fevereiro/}).click();
  assert(await page.getByText(/Empate na segunda vaga/).isVisible());
  assert(await page.getByRole("button",{name:"Copiar orientação de fechamento"}).isDisabled());
  await page.goto(origin+"/sincronizacao?temporada=2027");
  const beforeSeasonSync=mutations.length;
  await page.getByRole("button",{name:"Sincronizar",exact:true}).click();
  await page.getByRole("status").filter({hasText:/publicada/}).first().waitFor();
  assert(mutations.slice(beforeSeasonSync).some(item=>item.url==="/api/sync" && item.season==="2027"));
  assert(!mutations.slice(beforeSeasonSync).some(item=>item.season!=="2027"));
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin+"/albuns");
  await page.getByRole("button",{name:"Mais",exact:true}).click();
  await page.screenshot({path:resolve(artifactDir,`oraculo-tema-${mode}-390-viewport.jpg`),type:"jpeg",quality:90});
  await page.getByRole("button",{name:"Fechar menu",exact:true}).click();
  }
  // Exercise the real mobile menu, storage, and desktop selector together.
  await page.setViewportSize({width:390,height:844});
  await page.goto(origin+"/albuns");
  await page.getByRole("button",{name:"Mais",exact:true}).click();
  const theme=page.getByRole("dialog").getByLabel("Tema",{exact:true});
  await theme.selectOption("light");
  assert.equal(await page.locator("html").getAttribute("data-mode"),"light");
  await page.getByRole("button",{name:"Fechar menu",exact:true}).click();
  await page.reload();
  assert.equal(await page.locator("html").getAttribute("data-mode"),"light");
  await page.setViewportSize({width:1280,height:844});
  assert.equal(await page.locator("aside").getByLabel("Tema",{exact:true}).inputValue(),"light");
  await page.goto(origin+"/sincronizacao");
  await page.getByText("Ver falhas das capas (2)",{exact:true}).click();
  assert(await page.getByText(/MusicBrainz respondeu com erro HTTP 503/).isVisible());
  assert(await page.getByText(/A tentativa anterior não registrou o motivo detalhado/).isVisible());
  await page.goto(origin+"/pendencias");
  await page.getByRole("heading",{name:"Central de pendências",exact:true}).waitFor();
  const initialPending=await page.getByRole("region",{name:"Lista de pendências",exact:true}).locator("article").count();
  assert(initialPending>=5);
  await page.getByLabel("Tipo de pendência",{exact:true}).selectOption("facts");
  await page.getByRole("searchbox").fill("repescagem");
  assert.equal(await page.getByRole("region",{name:"Lista de pendências",exact:true}).locator("article").count(),1);
  assert.equal(new URL(page.url()).searchParams.get("tipo"),"facts");
  await page.getByRole("button",{name:"Copiar orientação desta pendência",exact:true}).click();
  await page.getByRole("status").filter({hasText:/Orientação copiada/}).waitFor();
  const copied=await page.evaluate(()=>window.fixtureClipboardText);
  assert(copied.includes("Albuns 2026!52"));assert(copied.includes("Preserve notas originais"));
  await page.getByRole("region",{name:"Lista de pendências",exact:true}).getByRole("link").first().click();
  await page.getByRole("heading",{name:"Detalhe do álbum",exact:true}).waitFor();
  await page.goBack();
  assert.equal(new URL(page.url()).searchParams.get("tipo"),"facts");
  await page.getByRole("button",{name:"Limpar filtros",exact:true}).click();
  await page.getByLabel("Origem da pendência",{exact:true}).selectOption("attempt");
  const rejected=page.getByRole("region",{name:"Lista de pendências",exact:true});
  assert.equal(await rejected.locator("article").count(),1);
  assert.equal(await rejected.getByRole("link").count(),0,"Rejected rows must not link to active albums");
  assert(await rejected.locator('li').filter({hasText:'Tentativa recusada · v101'}).first().isVisible());
  await page.evaluate(()=>{window.fixtureClipboardBlocked=true;});
  await page.getByRole("button",{name:"Copiar pendências filtradas",exact:true}).click();
  await page.getByRole("status").filter({hasText:/Não foi possível copiar automaticamente/}).waitFor();
  await page.getByText("Texto para o chat da planilha",{exact:true}).first().click();
  assert((await page.getByRole("textbox",{name:"Texto das pendências filtradas",exact:true}).inputValue()).includes("tentativa recusada"));
  await page.getByRole("searchbox").fill("inexistente");
  assert(await page.getByRole("heading",{name:"Nenhuma pendência corresponde aos filtros",exact:true}).isVisible());
  await page.evaluate(()=>window.dispatchEvent(new Event("fixture-pending-corrected")));
  await page.getByRole("heading",{name:"Nenhuma pendência identificada",exact:true}).waitFor();
  assert(await page.getByText("Fonte v102",{exact:true}).isVisible());
  assert.equal(mutations.length,0,"Visiting pages must never issue mutations or previews");
  await page.goto(origin+"/sincronizacao");
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("link",{name:"Revisar capas (1)",exact:true}).click();
  await page.getByRole("heading",{name:"Capas para revisar",exact:true}).waitFor();
  const review=page.getByRole("region",{name:"Capas para revisar",exact:true});
  assert.equal(await review.locator('ol li').count(),1);
  await review.getByRole("link").first().click();
  const reviewEditor=page.getByRole("region",{name:"Capa do álbum",exact:true});
  assert(await reviewEditor.getByRole("button",{name:"Pesquisar capas",exact:true}).isVisible());
  assert.equal(new URL(page.url()).search,'?capas=revisar');
  await page.getByRole("link",{name:"Voltar aos álbuns",exact:true}).click();
  assert.equal(new URL(page.url()).search,'?capas=revisar');
  await page.getByRole("button",{name:"Sem capa encontrada (1)",exact:true}).click();
  assert.equal(await page.getByRole("region",{name:"Álbuns sem capa encontrada",exact:true}).locator('ol li').count(),1);
  await page.getByRole("button",{name:"Com falha (2)",exact:true}).click();
  assert.equal(await page.getByRole("region",{name:"Capas com falha na busca",exact:true}).locator('ol li').count(),2);
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
  await page.getByRole("status").filter({hasText:/Busca concluída/}).waitFor();
  assert.equal(mutations.length,2); assert.equal(mutations[0].url,"/api/sync"); assert.equal(mutations[1].url,"/api/artwork/batch");
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
  assert.deepEqual(mutations.map(m => m.url),["/api/sync","/api/artwork/batch","/api/competition/preview","/api/competition/freeze"]);
  assert.deepEqual(mutations[3].body,{mode:"correction",token:{synthetic:"review-token"},backupAttested:true,eligibilityAttested:true,noMatchAttested:true,reason:"Correção fictícia revisada no teste"});
  await page.getByRole("navigation",{name:"Navegação mobile",exact:true}).getByRole("link",{name:"Início",exact:true}).click();
  await page.getByRole("heading",{name:"O ano em discos."}).waitFor();
  assert(await page.getByText("Fonte v101",{exact:true}).isVisible());
  for (const [hash,path] of [["#acervo","/albuns"],["#top-50","/top-50"],["#chaveamento","/playoffs"],["#historico-competitivo","/playoffs?aba=historico"],["#backlog","/"]]) {
    await page.goto(origin+"/"+hash); await page.waitForURL(origin+path);
  }
  // Explicit stop finishes the current batch and never starts the next one.
  await page.goto(origin+"/sincronizacao"); slowBatch=true; const beforeBatches=batchCalls;
  await page.getByRole("button",{name:/Retomar busca de capas/}).click();
  await page.getByRole("button",{name:"Parar busca",exact:true}).click();
  await page.getByRole("status").filter({hasText:/Busca pausada/}).waitFor();
  assert.equal(batchCalls,beforeBatches+1);
  slowBatch=false; await page.getByRole("button",{name:/Retomar busca de capas/}).click();
  await page.getByRole("status").filter({hasText:/Busca concluída/}).waitFor();
  assert.equal(batchCalls,beforeBatches+2);
  // Rendering an unavailable image falls back to a disc without an external API call.
  await page.goto(origin+"/albuns");
  await page.locator('img[src$="250.jpg"]').first().waitFor();
  const brokenRow=page.getByRole("region",{name:"Ranking anual"}).locator("li").filter({has:page.getByText("Artista fictício 2",{exact:true})});
  await brokenRow.scrollIntoViewIfNeeded();
  await brokenRow.getByRole("img",{name:"Capa indisponível",exact:true}).waitFor();
  assert.equal(await brokenRow.locator("img").count(),0);
  await page.goto(origin+"/albuns/00000000-0000-4000-8000-000000000001");
  const editor=page.getByRole("region",{name:"Capa do álbum",exact:true});
  await editor.getByText("Buscar ou corrigir capa",{exact:true}).click();
  await editor.getByLabel("Artista para buscar a capa",{exact:true}).fill("Busca ajustada");
  await editor.getByRole("button",{name:"Pesquisar capas",exact:true}).click();
  await editor.getByRole("button",{name:/Visualizar capa/}).click();
  await editor.getByRole("button",{name:"Confirmar esta capa",exact:true}).click();
  await editor.getByRole("status").filter({hasText:/Capa confirmada/}).waitFor();
  assert(await editor.getByText("Capa escolhida por você.",{exact:true}).isVisible());
  await editor.getByRole("button",{name:"Ocultar capa",exact:true}).click();
  await editor.getByRole("status").filter({hasText:/Capa ocultada/}).waitFor();
  assert(await editor.getByRole("img",{name:"Capa indisponível",exact:true}).isVisible());
  await editor.getByRole("button",{name:"Usar busca automática",exact:true}).click();
  await editor.getByRole("status").filter({hasText:/Busca automática reativada/}).waitFor();
  assert.deepEqual(mutations.filter(m=>m.url.endsWith("/selection")).map(m=>m.body.action),["preview","select","hide","automatic"]);
  // Confirming a pending cover removes it from the refreshed review list.
  await page.goto(origin+"/albuns?capas=revisar");
  await page.getByRole("region",{name:"Capas para revisar",exact:true}).getByRole("link").first().click();
  await page.getByRole("button",{name:"Pesquisar capas",exact:true}).click();
  await page.getByRole("button",{name:/Visualizar capa/}).click();
  await page.getByRole("button",{name:"Confirmar esta capa",exact:true}).click();
  await page.getByRole("status").filter({hasText:/Capa confirmada/}).waitFor();
  await page.getByRole("link",{name:"Voltar aos álbuns",exact:true}).click();
  assert.equal(await page.getByRole("region",{name:"Capas para revisar",exact:true}).locator('ol li').count(),0);
  assert(await page.getByText('Nenhum álbum nesta situação corresponde aos filtros atuais.',{exact:true}).isVisible());
  // iTunes review resolves IDs on the server and shows attribution beside the cover.
  await page.goto(origin+"/albuns/00000000-0000-4000-8000-000000000001");
  await page.getByText("Buscar ou corrigir capa",{exact:true}).click();
  await page.getByLabel("Fonte da busca",{exact:true}).selectOption("itunes");
  await page.getByRole("button",{name:"Pesquisar capas",exact:true}).click();
  await page.getByRole("button",{name:/Visualizar capa/}).click();
  await page.getByRole("button",{name:"Confirmar esta capa",exact:true}).click();
  await page.getByRole("status").filter({hasText:/Capa confirmada/}).waitFor();
  assert.equal(await page.getByRole("link",{name:/Ver álbum na Apple Music/}).getAttribute("href"),"https://music.apple.com/br/album/synthetic/123");
  assert.equal(mutations.filter(m=>m.url.endsWith("/selection")).at(-1).body.groupId,"itunes:123");
  for(const path of ["/","/albuns"]) {
    await page.goto(origin+path);
    assert(await page.getByRole("link",{name:/Ver álbum na Apple Music/}).first().isVisible());
    assert.equal(await page.locator('a a').count(),0,"Store attribution must not nest links");
  }
  // Failed albums retry without another click; Stop also interrupts the waiting period.
  await page.goto(origin+"/sincronizacao");recoveryMode='recover';recoveryCalls=0;
  const beforeRecovery=batchCalls;
  await page.getByRole("button",{name:/Retomar busca de capas/}).click();
  await page.getByRole("status").filter({hasText:/Nova tentativa automática/}).waitFor();
  await page.getByRole("status").filter({hasText:/Busca concluída/}).waitFor();
  assert.equal(batchCalls,beforeRecovery+2);
  recoveryMode='wait';recoveryCalls=0;
  const beforeWaiting=batchCalls;
  await page.getByRole("button",{name:/Retomar busca de capas/}).click();
  await page.getByRole("status").filter({hasText:/Nova tentativa automática/}).waitFor();
  await page.getByRole("button",{name:"Parar busca",exact:true}).click();
  await page.getByRole("status").filter({hasText:/Busca pausada/}).waitFor();
  assert.equal(batchCalls,beforeWaiting+1);
  recoveryMode=null;
  assert.deepEqual(errors,[]);
  console.log("Layout Chromium: 11 telas × 4 larguras × 2 temas; preferência persistida, menu, foco, teclado, busca/retorno, links, sincronização, central de pendências, cópia/fallback, correção da fonte, capas, revisão manual, iTunes, recuperação automática, parar durante a espera e hashes passaram.");
} catch(error) {
  await page?.screenshot({path:resolve(artifactDir,"failure.png"),fullPage:true}).catch(()=>{});
  throw error;
} finally {
  await context?.tracing.stop({path:resolve(artifactDir,"trace.zip")}).catch(error=>console.error("Não foi possível salvar o trace:",error.message));
  await browser?.close(); await server?.close(); await rm(root,{recursive:true,force:true});
}
