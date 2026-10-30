import { MONTHLY_RULES } from "@/lib/seasons/definitions";
import { CUTOFF_UTC, RULES_VERSION } from "@/lib/competition/rules";
import { TOP50_BONUSES, TOP50_RULES_VERSION } from "@/lib/competition/top50";
import { SeasonLink as Link } from "./season-context";
import styles from "./season-pages.module.css";

function plain(text: string) { return text.replace(/\*\*/g, "").replace(/`/g, "").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1"); }
function Document({ text }: { text: string }) {
  const blocks = text.split(/\n\s*\n/);
  return <div className={styles.document}>{blocks.map((block, index) => {
    const value = plain(block.trim());
    if (value.startsWith("#")) return <h3 key={index}>{value.replace(/^#+\s*/, "")}</h3>;
    if (value.startsWith("- ")) return <ul key={index}>{value.split("\n").map((line, i) => <li key={i}>{line.replace(/^-\s*/, "")}</li>)}</ul>;
    if (/^\d+\. /.test(value)) return <ol key={index}>{value.split("\n").map((line, i) => <li key={i}>{line.replace(/^\d+\.\s*/, "")}</li>)}</ol>;
    return <p key={index}>{value}</p>;
  })}</div>;
}
export function RulesContent({ year, originalText }: { year: number; originalText: string }) {
  const monthly = year === 2027;
  const sections = monthly ? [
    { id: "elegibilidade", title: "Quem participa", text: `Lançamentos de ${year} cuja avaliação original seja concluída em ${year}. Discos de outros anos continuam no catálogo e no ranking anual, sem disputar as vagas mensais.` },
    { id: "classificacao", title: "Como classificar", text: `${MONTHLY_RULES.slotsPerMonth} vagas por mês, pelas maiores notas originais. O mês é definido pela conclusão da avaliação. São ${MONTHLY_RULES.slotsPerMonth * 12} vagas e até ${MONTHLY_RULES.slotsPerMonth * 12} classificados; vagas vazias não são redistribuídas.` },
    { id: "desempates", title: "Empates e reescuta", text: "Empates que alterem quem ocupa uma vaga exigem reescuta e decisão registrada na planilha, com o grupo completo, ordem e confirmação. Notas originais permanecem preservadas." },
    { id: "calendario", title: "Calendário e fechamento", text: `Janeiro a novembro usam meses completos no fuso ${MONTHLY_RULES.timezone}. Após o período, o proprietário confirma o fechamento na planilha; o app importa e valida o contexto. Corte de dezembro, prazo do Year-End do AOTY e data da final: em aberto.` },
    { id: "pendencias", title: "Ainda em definição", text: "O mata-mata será uma próxima entrega. Para um campo completo de 24, foram escolhidos oito byes para as maiores notas entre os classificados, com reescuta em empates relevantes. O tratamento de um campo menor que 24 e as regras das partidas continuam pendentes." },
  ] : [
    { id: "elegibilidade", title: "Avaliação e classificação", text: "Ranking anual por nota original, independente de bônus e promoções competitivas. Notas originais são preservadas. Participantes e seeds do campeonato vêm da fonte de corte e do snapshot confirmado." },
    { id: "classificacao", title: "Corte e chave", text: `Corte exclusivo: ${new Date(CUTOFF_UTC).toLocaleString("pt-BR", {timeZone:"America/Sao_Paulo"})}, no fuso de São Paulo. De 24 a 32 participantes: 32−N byes e N−16 jogos. Um único reseeding após a primeira rodada; depois, caminhos fixos até a final.` },
    { id: "desempates", title: "Top 50 vigente", text: `Regra ${TOP50_RULES_VERSION}: vagas reservadas dinamicamente aos sobreviventes; eliminados entram pelo índice. Campeão e vice ficam em primeiro e segundo. Bônus não cumulativos: Repescagem +${TOP50_BONUSES.rep}, Play-in +${TOP50_BONUSES.playin}, Pré-playoff +${TOP50_BONUSES.pre}, primeira rodada +${TOP50_BONUSES.first}, oitavas +${TOP50_BONUSES.roundOf16}, quartas +${TOP50_BONUSES.quarters}, semifinais +${TOP50_BONUSES.semis}.` },
    { id: "calendario", title: "Desempates e evidência", text: "Eliminados da mesma fase são ordenados pelo seed original. Empate irredutível no corte residual exige decisão explícita válida em Desempates Top 50. Resultados ambíguos e contradições da fonte ficam sinalizados; nenhum vencedor é presumido." },
    { id: "pendencias", title: "Limites e pendências", text: "Resultados /20, Late Challenger, métricas anuais oficiais e reprodução algorítmica geral das fases históricas continuam fora do recorte confirmado. As fases encerradas são apresentadas como evidências da fonte." },
  ];
  return <div className={styles.stack}>
    <p><strong>{monthly ? "Em preparação" : "Regulamento vigente"}</strong> — {monthly ? MONTHLY_RULES.version : `${RULES_VERSION} e ${TOP50_RULES_VERSION}`}</p>
    <nav className={styles.index} aria-label="Índice das regras">{sections.map(section => <a href={`#${section.id}`} key={section.id}>{section.title}</a>)}<a href="#texto-integral">Regulamento completo</a><a href="#alteracoes">Histórico</a></nav>
    {sections.map(section => <section id={section.id} key={section.id} className={styles.ruleSection}><h2>{section.title}</h2><p>{section.text}</p></section>)}
    <section id="texto-integral" className={styles.ruleSection}><h2>Regulamento completo</h2>
      <details className={styles.disclosure}><summary>{monthly ? "Ler as definições de 2027 e seus pontos pendentes" : "Ler o texto original e os adendos de 2026"}</summary>
        {!monthly && <p>Registro histórico preservado. As disposições substituídas pelos adendos não prevalecem sobre o resumo vigente acima, especialmente a ordenação do Top 50.</p>}
        <Document text={originalText} />
      </details>
    </section>
    <section id="alteracoes" className={styles.ruleSection}><h2>Histórico de alterações</h2>{monthly ? <ul><li><strong>Confirmado nesta proposta:</strong> seleção mensal, elegibilidade, desempate por reescuta, vagas vazias e fechamento pela planilha.</li><li><strong>Em aberto:</strong> corte de dezembro, prazo do AOTY, calendário final e regras do mata-mata.</li></ul> : <ul>
      <li>27/09/2026: texto original dos 22 tópicos, preservado como histórico.</li><li>28/09/2026: adendo aprovado de corte, congelamento, participantes, seeds e chave.</li><li>27/10/2026: {TOP50_RULES_VERSION} substitui as disposições anteriores de reservas e ordenação do Top 50 nos pontos conflitantes.</li>
    </ul>}</section>
    <div className={styles.intro}><Link href="/playoffs">Consultar campeonato de {year}</Link><Link href="/albuns">Consultar álbuns de {year}</Link></div>
  </div>;
}
