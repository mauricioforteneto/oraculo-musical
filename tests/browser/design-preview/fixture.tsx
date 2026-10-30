import { useState } from "react";
import { createRoot } from "react-dom/client";
import Image from "next/image";
import { AudioLines, LibraryBig, Trophy, GitBranch, MoreHorizontal, Search, Disc3, ChevronDown, ArrowLeft, BarChart3, History, RefreshCw, ClipboardList } from "lucide-react";
import "../../../src/app/globals.css";
import "./preview.css";
import photos from "./photos.json";
import { syntheticAlbum } from "../../fixtures/synthetic/top50";
import { rankAnnualAlbums } from "../../../src/lib/catalog/ranking";
import { scoreLabel } from "../../../src/lib/catalog/presentation";
import { AppShell } from "../../../src/components/app-shell";
import { CatalogPage } from "../../../src/components/catalog-page";
import catalogStyles from "../../../src/components/catalog-page.module.css";
import { AlbumDetails } from "../../../src/components/album-details";
import Link, { usePathname, useSearchParams } from "../navigation";

const titles = ["Entre marés", "Cidade suspensa", "Depois da chuva", "Vento do norte", "Casa de vidro", "Linha do horizonte", "Um lugar inteiro", "O lado de dentro"];
const scores = [90,90,85,85,80,78,70,null];
const countries = ["Brasil","Inglaterra","Escócia","França"];
const albums = titles.map((title,index)=>syntheticAlbum(index+1,{
  title,artist:`Artista fictício ${index+1}`,country:countries[index%countries.length],
  originalScore:scores[index],reportedScore:scores[index],
  albumId:`00000000-0000-4000-8000-${String(index+1).padStart(12,"0")}`,
  artwork:{status:index===7 ? "ambiguous":"found",selection:"automatic",releaseGroupId:null,
    thumbnailUrl:`https://archive.org/download/oraculo-design-preview/${index%photos.length}.jpg`,
    imageUrl:`https://archive.org/download/oraculo-design-preview/${index%photos.length}.jpg`,checkedAt:"2026-10-01",nextAttemptAt:null},
}));
const primary = [
  {href:"/",label:"Início",icon:AudioLines},{href:"/albuns",label:"Álbuns",icon:LibraryBig},
  {href:"/top-50",label:"Top 50",icon:Trophy},{href:"/playoffs",label:"Playoffs",icon:GitBranch},
];
const secondary = [
  {href:"/pendencias",label:"Pendências",icon:ClipboardList},{href:"/estatisticas",label:"Estatísticas",icon:BarChart3},
  {href:"/historico",label:"Histórico de versões",icon:History},{href:"/sincronizacao",label:"Sincronização",icon:RefreshCw},
];

function Preview() {
  const params=useSearchParams(); const path=usePathname();
  const direction=params.get("design")==="discoteca" ? "discoteca" : params.get("design")==="atual" ? "atual":"revista";
  const [menuOpen,setMenuOpen]=useState(false);
  const query=params.get("q") ?? "", minimum=params.get("nota") ?? "all", review=params.get("capas")==="revisar";
  const ranked=rankAnnualAlbums(albums);
  const visible=ranked.filter(a=>[a.title,a.artist,a.country].join(" ").toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"))
    && (minimum==="all" || (a.originalScore ?? -1)>=Number(minimum)) && (!review || a.artwork?.status==="ambiguous"));
  function update(changes:Record<string,string|undefined>) {
    const next=new URLSearchParams(params);
    for(const [key,value] of Object.entries(changes)) { if(value) next.set(key,value); else next.delete(key); }
    history.replaceState(null,"",`${path}?${next}`);
  }
  function href(destination:string) { return `${destination}?${params}`; }
  if(direction==="atual") return <AppShell title="Álbuns" description="Explore o ranking anual pela nota original e consulte cada avaliação." headingClassName={catalogStyles.pageHeading}><CatalogPage albums={albums}/><details data-credits><summary>Créditos das capas demonstrativas</summary><ul>{photos.map(photo=><li key={photo.id}><a href={photo.page}>{photo.author}</a> ({photo.license}, Wikimedia Commons)</li>)}</ul></details></AppShell>;
  const detail=path.startsWith("/albuns/") ? ranked.find(a=>a.albumId===path.split("/")[2]):undefined;
  const isCatalogue=path==="/albuns";
  return <div className="prototype">
    <a className="preview-skip" href="#preview-main">Ir para o conteúdo</a>
    <header className="preview-masthead">
      <Link className="preview-brand" href={href("/")} aria-label="Oráculo Musical, início"><Disc3 size={28} strokeWidth={1.5} aria-hidden="true"/><span>oráculo <span>musical</span></span></Link>
      <span className="preview-season">Temporada 2026</span>
      <button type="button" className="preview-menu" onClick={()=>setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="preview-extra">Mais <MoreHorizontal size={20} aria-hidden="true"/></button>
    </header>
    <div className="preview-workspace">
      <aside className="preview-sidebar">
        <nav aria-label="Navegação principal">{primary.map(item=><Link href={href(item.href)} key={item.href} aria-current={path===item.href ? "page":undefined}><item.icon size={20} strokeWidth={1.5} aria-hidden="true"/>{item.label}</Link>)}</nav>
        <nav aria-label="Ferramentas do acervo">{secondary.map(item=><Link href={href(item.href)} key={item.href}><item.icon size={20} strokeWidth={1.5} aria-hidden="true"/>{item.label}</Link>)}</nav>
        <p>Acervo privado</p>
      </aside>
      <main id="preview-main" className="preview-main">
        {detail ? <><Link className="preview-back" href={href("/albuns")}><ArrowLeft size={20} aria-hidden="true"/>Voltar aos álbuns</Link><AlbumDetails album={detail}/></>
          : !isCatalogue ? <div className="preview-scope"><h1>Prévia de álbuns</h1><p>Esta comparação apresenta somente a página de álbuns.</p><Link href={href("/albuns")}>Abrir catálogo demonstrativo</Link></div>
          : <>
            <div className="preview-heading"><h1>Álbuns</h1><p>Explore o ranking anual pela nota original e consulte cada avaliação.</p></div>
            <section className="preview-controls" aria-label="Buscar e filtrar álbuns">
              <label className="preview-search"><span>Buscar por álbum, artista, gênero ou país</span><span><Search size={20} strokeWidth={1.5} aria-hidden="true"/><input type="search" value={query} maxLength={200} placeholder="Encontre seu próximo disco" onChange={e=>update({q:e.target.value})}/></span></label>
              <div className="preview-score-filter" role="group" aria-label="Filtrar por nota original"><span>Nota original</span><div>{["all","90","80","70"].map(value=><button type="button" key={value} aria-pressed={minimum===value} onClick={()=>update({nota:value})}>{value==="all" ? "Todos":`${value}+`}</button>)}</div></div>
            </section>
            <div className="preview-result-line"><h2>{review ? "Capas para revisar":"Ranking anual"}</h2><p role="status">{visible.length} de {ranked.length} álbuns</p><details className="preview-artwork"><summary>Revisão de capas <ChevronDown size={16} aria-hidden="true"/></summary><div><p>Encontre as capas que precisam da sua escolha ou de uma nova pesquisa.</p><button type="button" aria-pressed={!review} onClick={()=>update({capas:undefined})}>Todas as capas</button><button type="button" aria-pressed={review} onClick={()=>update({capas:"revisar"})}>Para revisar ({albums.filter(a=>a.artwork?.status==="ambiguous").length})</button></div></details></div>
            <p className="preview-tie-note">Empates compartilham posição.</p>
            <ol className="preview-albums">{visible.map(album=><li className="preview-album" key={album.albumId}>
              <Link className="preview-album-link" href={href(`/albuns/${album.albumId}`)}>
                <span className="preview-position"><span className="preview-sr">Posição </span>{album.annualPosition || "—"}</span>
                <span className="preview-cover"><Image unoptimized src={album.artwork!.thumbnailUrl!} alt={`Capa demonstrativa de ${album.title}`} width={400} height={400}/></span>
                <span className="preview-identity"><strong>{album.title}</strong><span>{album.artist}</span><small>{album.country}</small></span>
                <span className="preview-score">{scoreLabel(album.originalScore)}<small>Original</small></span>
              </Link>
            </li>)}</ol>
            {!visible.length && <p className="preview-empty">Nenhum álbum encontrado. Tente outro artista, título ou país.</p>}
          </>}
        <footer className="preview-footer"><p>Prévia visual com títulos, artistas e notas fictícios. Fotografias usadas como capas demonstrativas.</p><details data-credits><summary>Créditos das fotografias</summary><ul>{photos.map(photo=><li key={photo.id}><a href={photo.page} target="_blank" rel="noreferrer">{photo.author}</a> ({photo.license}, Wikimedia Commons)</li>)}</ul></details></footer>
      </main>
    </div>
    {menuOpen && <nav id="preview-extra" className="preview-extra" aria-label="Mais páginas">{secondary.map(item=><Link key={item.href} href={href(item.href)} onClick={()=>setMenuOpen(false)}><item.icon size={20} strokeWidth={1.5} aria-hidden="true"/>{item.label}</Link>)}</nav>}
    <nav className="preview-bottom" aria-label="Navegação mobile">{primary.map(item=><Link key={item.href} href={href(item.href)} aria-current={path===item.href ? "page":undefined}><item.icon size={20} strokeWidth={1.5} aria-hidden="true"/><span>{item.label}</span></Link>)}<button type="button" onClick={()=>setMenuOpen(!menuOpen)} aria-expanded={menuOpen} aria-controls="preview-extra"><MoreHorizontal size={20} strokeWidth={1.5} aria-hidden="true"/><span>Mais</span></button></nav>
  </div>;
}

const initialDirection=new URLSearchParams(location.search).get("design");
if(initialDirection && initialDirection!=="atual") document.documentElement.dataset.theme=initialDirection;
createRoot(document.getElementById("root")!).render(<Preview/>);
