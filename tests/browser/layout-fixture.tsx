import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import "../../src/app/globals.css";
import { PendingIssuesPage } from "../../src/components/pending-issues-page";
import { buildIssueReport } from "../../src/lib/issues/report";
import { syntheticIssues } from "../fixtures/synthetic/issues";
import { AppShell } from "../../src/components/app-shell";
import { Dashboard } from "../../src/components/dashboard";
import { CatalogPage } from "../../src/components/catalog-page";
import catalogStyles from "../../src/components/catalog-page.module.css";
import { ArtworkEditor } from "../../src/components/artwork-editor";
import { AlbumDetails } from "../../src/components/album-details";
import { StatisticsPage } from "../../src/components/statistics-page";
import { VersionHistoryPage } from "../../src/components/version-history-page";
import { SynchronizationPage } from "../../src/components/synchronization-page";
import { CompetitionBracket } from "../../src/components/competition-bracket";
import { CompetitionHistory } from "../../src/components/competition-history";
import { Top50Panel } from "../../src/components/top50-panel";
import type { AlbumRecord } from "../../src/lib/catalog/types";
import { syntheticField, syntheticFirstResults, syntheticAlbum } from "../fixtures/synthetic/top50";
import { projectTop50 } from "../../src/lib/competition/top50";
import { rankAnnualAlbums } from "../../src/lib/catalog/ranking";
import { buildCatalogStatistics } from "../../src/lib/catalog/statistics";
import { buildCompetitionPhaseHistory } from "../../src/lib/competition/history";
import { comparePublishedVersions } from "../../src/lib/catalog/version-history";
import { historySnapshot } from "../fixtures/synthetic/version-history";
import { catalogFilters, catalogQuery } from "../../src/lib/catalog/catalog-navigation";
import { usePathname, useSearchParams } from "./navigation";
import { SeasonLink as Link } from "../../src/components/season-context";
import { RulesContent } from "../../src/components/rules-content";
import { MonthlyCompetition } from "../../src/components/monthly-competition";
import { buildMonthlyState } from "../../src/lib/competition/monthly";
import rules2026 from "../../docs/campeonato/regras-2026.md?raw";
import consolidated2026 from "../../docs/campeonato/regras-2026-vigentes.md?raw";
import rules2027 from "../../docs/campeonato/regras-2027.md?raw";
const field = syntheticField();
const albums: AlbumRecord[] = [...field.albums,...Array.from({length:20},(_,i) => syntheticAlbum(i+30,{playoffSeed:null,originalScore:85}))].map((a,i) => ({...a, albumId:`00000000-0000-4000-8000-${String(i+1).padStart(12,"0")}`}));
albums[0].artist = "Artista de nome muito longo para verificar a quebra de linha no celular";
albums[0].source = "Referência completa de avaliação muito extensa que deve permanecer visível sem truncamento";
albums[0].artwork = {status:"found",selection:"automatic",releaseGroupId:"11111111-1111-4111-8111-111111111111",thumbnailUrl:"https://archive.org/download/synthetic/250.jpg",imageUrl:"https://archive.org/download/synthetic/500.jpg",checkedAt:"2026-10-01",nextAttemptAt:null};
albums[0].artwork = {...albums[0].artwork!,provider:"itunes",releaseGroupId:null,itunesCollectionId:"123",providerUrl:"https://music.apple.com/br/album/synthetic/123",thumbnailUrl:"https://is1-ssl.mzstatic.com/image/thumb/synthetic/250.jpg",imageUrl:"https://is1-ssl.mzstatic.com/image/thumb/synthetic/500.jpg"};
albums[1].artwork = {...albums[0].artwork!,thumbnailUrl:"https://archive.org/download/synthetic/broken.jpg"};
albums[2].artwork = {status:"error",selection:"automatic",releaseGroupId:null,thumbnailUrl:null,imageUrl:null,checkedAt:"2026-10-01",nextAttemptAt:"2026-10-01",errorCode:"ARTWORK_PROVIDER_UNAVAILABLE:MUSICBRAINZ:HTTP_503"};
albums[3].artwork = {...albums[2].artwork!,errorCode:"ARTWORK_PROVIDER_UNAVAILABLE"};
albums[4].artwork = {...albums[2].artwork!,status:"ambiguous",errorCode:null};
albums[5].artwork = {...albums[2].artwork!,status:"missing",errorCode:null};
// A small in-memory API store makes refreshed routes see confirmed choices.
const fixtureFetch=window.fetch.bind(window);
window.fetch=async (input,init)=>{
  const response=await fixtureFetch(input,init);
  const match=String(input).match(/\/api\/artwork\/([^/]+)\/selection(?:\?.*)?$/);
  if(match && response.ok && typeof init?.body==='string') {
    const action=JSON.parse(init.body).action;
    const album=albums.find(a=>a.albumId===match[1]);
    if(album && ['select','hide','automatic'].includes(action)) {
      const result=await response.clone().json();
      album.artwork=result.artwork ?? {...albums[2].artwork!,status:action==='hide'?'hidden':'pending',selection:action==='hide'?'manual':'automatic',errorCode:null};
    }
  }
  return response;
};
const monthlyAlbums = albums.slice(0,7).map((album,i)=>({...album,
  albumId:`00000000-0000-4027-8000-${String(i+1).padStart(12,"0")}`,
  artist:`Artista fictício de 2027 ${i+1}`,title:`Disco fictício de 2027 ${i+1}`,
  originalScore:[95,91,90,99,88,88,92][i],releaseYear:i===6?null:2027,
  evaluatedOn:i<3?`2027-01-${15+i}`:i<6?`2027-02-${10+i}`:"2027-03-04"}));
const monthly=buildMonthlyState(monthlyAlbums,[],new Date("2027-04-02T12:00:00Z"));
monthly.sourceVersion="100";
for(const month of monthly.months) month.contextHash="a".repeat(64);
monthly.months[0].confirmed={closureId:"jan-ficticio-1",month:1,sourceVersion:"99",rulesVersion:monthly.rulesVersion,
 contextHash:"a".repeat(64),qualified:monthly.months[0].provisional,vacancies:0,
 confirmedBy:"Proprietário fictício",confirmedOn:"2027-02-01",reference:"Demonstração de confirmação, sem dados reais",supersedes:"",reason:""};
const results = syntheticFirstResults();
const competition = { cutoff:"2026-10-01", active:{id:"synthetic",fileName:"synthetic-v100.xlsx",fileVersion:"100",sha256:"a".repeat(64),frozenAt:"2026-10-01T03:00:00Z",frozenBy:"synthetic",participants:field.participants,correctionReason:null,bracket:field.bracket}, projection:projectTop50(albums,field.participants,results,field.cutoff)!, history:[] };
let version = "100";
window.addEventListener("fixture-refresh", () => { version = "101"; });
const subscribeVersion = (fn: () => void) => { window.addEventListener("fixture-refresh",fn); return () => window.removeEventListener("fixture-refresh",fn); };
let pendingCorrected=false;
window.addEventListener("fixture-pending-corrected",()=>{pendingCorrected=true;});
const subscribePending=(fn:()=>void)=>{window.addEventListener("fixture-pending-corrected",fn);return ()=>window.removeEventListener("fixture-pending-corrected",fn);};
function Fixture() {
  const path = usePathname(); const params = useSearchParams();
  const year=params.get("temporada")==="2027"?2027:2026; const selectedAlbums=year===2027?monthlyAlbums:albums;
  const currentVersion = useSyncExternalStore(subscribeVersion,() => version);
  const corrected=useSyncExternalStore(subscribePending,()=>pendingCorrected);
  if(path==="/pendencias" && year===2026) { const fixture=syntheticIssues(corrected ? "102":currentVersion,corrected);return <PendingIssuesPage report={buildIssueReport(fixture.source,fixture.competition)}/>; }
  const source = {season:year,artworkSummary:{ready:true,total:44,found:2,missing:1,ambiguous:1,error:2,hidden:0,pending:38,due:38},version:currentVersion,referenceDate:"2026-10-01",summary:{},albums:selectedAlbums,playoffResults:year===2027?[]:results,monthly:year===2027?monthly:undefined,backlog:[{order:1,artist:"OCULTO BACKLOG",title:"Oculto",priority:"",source:""}],lastAttempt:{status:"failed" as const,startedAt:"2026-10-01T03:00:00Z",finishedAt:null,errorCode:"SYNTHETIC",counts:{},issues:[{severity:"warning" as const,code:"BACKLOG_WARNING",sourceLocator:"Backlog",message:"OCULTO BACKLOG"},{severity:"error" as const,code:"MISSING_SHEET",sourceLocator:"Backlog",message:"Aba obrigatória ausente"}]}};
  if(path==="/pendencias") return <PendingIssuesPage season={year} report={buildIssueReport(source,null)} />;
  if (path === "/estatisticas") return <StatisticsPage season={year} statistics={buildCatalogStatistics(selectedAlbums)} version={currentVersion} />;
  if (path === "/historico") {
    const before = historySnapshot("99",{albums:[albums[0]],backlog:[]});
    const after = historySnapshot("100",{albums:albums.slice(0,2),backlog:source.backlog});
    return <VersionHistoryPage season={year} history={{versions:[after.version,before.version],selected:after.version,previous:before.version,comparison:comparePublishedVersions(before,after),page:1,hasMore:false,notices:[]}} />;
  }
  const title = path === "/regras" ? `Regras de ${year}` : path === "/playoffs" && year===2027 ? "Classificação mensal" : path === "/albuns" ? "Álbuns" : path.startsWith("/albuns/") ? "Detalhe do álbum" : path === "/top-50" ? "Top 50" : path === "/playoffs" ? "Playoffs" : path === "/sincronizacao" ? "Sincronização" : "O ano em discos.";
  return <AppShell season={year} publicationLabel={path==="/regras"?"Regulamento":undefined} title={title} version={currentVersion} headingClassName={path === "/albuns" ? catalogStyles.pageHeading : undefined} description={path === "/albuns" ? "Explore o ranking anual pela nota original e consulte cada avaliação." : undefined}>
    {path==="/regras" ? <RulesContent year={year} originalText={year===2027?rules2027:rules2026} consolidatedText={year===2026?consolidated2026:undefined} /> : path === "/albuns" ? <CatalogPage albums={selectedAlbums} /> : path.startsWith("/albuns/") ? <><Link href={`/albuns${catalogQuery(catalogFilters(params))}`}>Voltar aos álbuns</Link><ArtworkEditor key={path} initialOpen={Boolean(catalogFilters(params).capas)} album={(selectedAlbums.find(a => a.albumId === path.split("/")[2]) ?? syntheticIssues().source.albums.find(a=>a.albumId===path.split("/")[2]))!} /><AlbumDetails album={rankAnnualAlbums(selectedAlbums).find(a => a.albumId === path.split("/")[2]) ?? rankAnnualAlbums(syntheticIssues().source.albums).find(a=>a.albumId===path.split("/")[2]) ?? null} /></> : path === "/top-50" && year===2027 ? <p>O Top 50 competitivo de 2027 está em definição. <Link href="/regras">Consultar regras</Link></p> : path === "/top-50" ? <Top50Panel projection={competition.projection} /> : path === "/playoffs" && year===2027 ? <MonthlyCompetition state={monthly} /> : path === "/playoffs" ? <><Link href="/playoffs?aba=historico">Histórico das fases</Link>{params.get("aba") === "historico" ? <CompetitionHistory history={buildCompetitionPhaseHistory(albums.map(a => ({identityKey:a.albumId!,version:"100",current:true,record:a})),"100")} /> : <CompetitionBracket bracket={field.bracket} results={results} resultsVersion={currentVersion} />}</> : path === "/sincronizacao" ? <SynchronizationPage source={source} competition={year===2027?null:competition} ready /> : <Dashboard monthly={year===2027} source={source} competition={year===2027?null:competition} />}
  </AppShell>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
