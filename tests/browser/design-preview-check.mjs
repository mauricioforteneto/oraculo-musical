import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { createServer } from "vite";
import { chromium } from "playwright-core";

const repo=fileURLToPath(new URL("../../",import.meta.url));
const root=await mkdtemp(resolve(repo,".private-design-preview-"));
const output=resolve(repo,"test-results/design-previews");
const photos=JSON.parse(await readFile(resolve(repo,"tests/browser/design-preview/photos.json"),"utf8"));
let server,browser,page;
await mkdir(output,{recursive:true});
try {
  const photoBytes=[];
  for(const photo of photos) {
    let lastError;
    for(const url of [photo.thumbnail,photo.file]) {
      try {
        const response=await fetch(url,{headers:{"User-Agent":"OraculoMusical-DesignPreview/1.0 (licensed Wikimedia Commons photographs)"},signal:AbortSignal.timeout(20000)});
        if(!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
        photoBytes.push({body:Buffer.from(await response.arrayBuffer()),contentType:response.headers.get("content-type") || "image/jpeg"});
        lastError=null; break;
      } catch(error) { lastError=error; }
    }
    if(lastError) throw lastError;
  }
  const fonts="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,500..800&family=Source+Serif+4:opsz,wght@8..60,400&family=Instrument+Sans:wght@400;500&family=Figtree:wght@400;500&display=swap";
  await writeFile(resolve(root,"index.html"),`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Oráculo Musical — comparação de direções</title><meta name="description" content="Duas propostas de identidade para o catálogo de álbuns, com dados fictícios."><link rel="stylesheet" href="${fonts}"></head><body><div id="root"></div><script type="module" src="/tests/browser/design-preview/fixture.tsx"></script></body></html>`);
  server=await createServer({root,configFile:false,define:{"process.env":"{}"},resolve:{alias:{"@":resolve(repo,"src"),"next/navigation":resolve(repo,"tests/browser/navigation.tsx"),"next/link":resolve(repo,"tests/browser/navigation.tsx")}},server:{host:"127.0.0.1",port:3217,strictPort:true,fs:{allow:[repo]}},plugins:[{name:"preview-source",resolveId(id){if(id.startsWith("/tests/")||id.startsWith("/src/")) return repo+id;}}]});
  await server.listen();
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || (existsSync(chromium.executablePath()) ? chromium.executablePath():"/usr/bin/chromium"),headless:true,args:["--no-sandbox"]});
  page=await browser.newPage();
  const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.route("https://archive.org/download/oraculo-design-preview/**",async route=>{
    const index=Number(new URL(route.request().url()).pathname.split("/").at(-1).split(".")[0]);
    assert(photoBytes[index],"A capa precisa corresponder à fotografia licenciada");
    await route.fulfill(photoBytes[index]);
  });
  await page.route("**/api/**",route=>{errors.push("A prévia tentou consultar uma API da aplicação");return route.abort();});
  const origin="http://127.0.0.1:3217";
  for(const width of [360,390,768,1280]) {
    await page.setViewportSize({width,height:width>=1000 ? 900:844});
    for(const direction of ["revista","discoteca",...([390,1280].includes(width) ? ["atual"]:[])]) {
      await page.goto(`${origin}/albuns?design=${direction}`);
      await page.getByRole("heading",{name:"Álbuns",exact:true}).waitFor();
      if(direction!=="atual") {
        const font=direction==="revista" ? '800 32px "Bricolage Grotesque"':'400 32px "Instrument Sans"';
        await page.evaluate(async font=>{await document.fonts.load(font);await document.fonts.ready;},font);
        assert(await page.evaluate(font=>document.fonts.check(font),font),`Fonte não carregou: ${direction}`);
      }
      await page.locator("img").evaluateAll(images=>images.forEach(image=>{image.loading="eager";}));
      await page.waitForFunction(()=>Array.from(document.images).every(image=>image.complete && image.naturalWidth>0),undefined,{timeout:15000});
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow: ${direction} em ${width}`);
      assert.equal(await page.locator("h1").count(),1);
      if(direction!=="atual") {
        const first=await page.locator(".preview-album-link").first().boundingBox();
        const available=await page.evaluate(()=>innerWidth<=1000 ? innerHeight-72:innerHeight);
        assert(first && first.y+first.height<=available,`Primeiro álbum não cabe na primeira tela: ${direction} em ${width}`);
      }
      const name=`oraculo-preview-${direction}-${width}`;
      await page.screenshot({path:resolve(output,`${name}-viewport.png`)});
      await page.screenshot({path:resolve(output,`${name}.png`),fullPage:true});
      console.log(`Prévia ${direction}: ${width}px, imagens e fonte carregadas, sem overflow.`);
      if(direction!=="atual") {
        await page.getByRole("searchbox").fill("Entre marés");
        assert.equal(await page.locator(".preview-albums > li").count(),1);
        assert.equal(new URL(page.url()).searchParams.get("q"),"Entre marés");
        await page.locator(".preview-album-link").click();
        await page.getByRole("link",{name:"Voltar aos álbuns",exact:true}).click();
        assert.equal(await page.getByRole("searchbox").inputValue(),"Entre marés");
        await page.getByRole("searchbox").fill("inexistente");
        assert(await page.getByText("Nenhum álbum encontrado. Tente outro artista, título ou país.",{exact:true}).isVisible());
        await page.getByRole("searchbox").fill("");
        await page.getByRole("button",{name:"90+",exact:true}).click();
        assert.equal(await page.locator(".preview-albums > li").count(),2);
        await page.getByText("Revisão de capas",{exact:true}).click();
        await page.getByRole("button",{name:"Para revisar (1)",exact:true}).click();
        assert.equal(new URL(page.url()).searchParams.get("capas"),"revisar");
      }
    }
  }
  assert.deepEqual(errors,[]);
  await writeFile(resolve(output,"index.html"),'<!doctype html><html lang="pt-BR"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Comparação Hallmark</title><style>:root{--paper:#f6f4f1;--ink:#191b20;--font:Arial,sans-serif}body{margin:24px;background:var(--paper);color:var(--ink);font-family:var(--font)}main{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px;max-width:1280px;margin:auto}img{width:100%;height:auto}a{color:inherit}h1{font-size:28px}p{line-height:1.5}</style><h1>Oráculo Musical: duas direções visuais</h1><p>Mesmos dados fictícios e fotografias demonstrativas. Prévia para escolha; a aplicação publicada permanece preservada.</p><main><section><h2>A. Revista musical</h2><a href="oraculo-preview-revista-1280-viewport.png">Ver desktop</a><img src="oraculo-preview-revista-390-viewport.png" alt="Revista musical no celular"></section><section><h2>B. Discoteca escura</h2><a href="oraculo-preview-discoteca-1280-viewport.png">Ver desktop</a><img src="oraculo-preview-discoteca-390-viewport.png" alt="Discoteca escura no celular"></section></main></html>');
  console.log("Prévia Hallmark: duas direções em quatro larguras; busca, filtros, retorno e vazio passaram. Comparação com a versão atual em 390 e 1280px.");
} catch(error) {
  await page?.screenshot({path:resolve(output,"failure.png"),fullPage:true}).catch(()=>{});
  throw error;
} finally {await browser?.close();await server?.close();await rm(root,{recursive:true,force:true});}
