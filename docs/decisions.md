# Decisões e pendências

## Adendo aprovado em 27/10/2026 — 2026-top50-2

O proprietário aprovou substituir a reserva permanente de todos os participantes por reservas dinâmicas dos sobreviventes. Somente campeão e vice ficam protegidos em 1º e 2º. Eliminados disputam o restante por nota original + maior bônus de fase: +8 primeira rodada dos Playoffs, +10 oitavas, +12 quartas e +14 semifinais; mantêm-se +6 Pré-playoff, +3 Play-in, +1 Repescagem e +0 sem fase. Bônus não se acumulam; bye conta como chegada às oitavas. No empate de índice e fase dos Playoffs, usar o melhor seed original. Nos estágios anteriores, manter score/etapa; empates persistentes compartilham posição, com decisão manual no corte. A final não congela as vagas 3–50 do ano.

O adendo substitui as reservas e a ordenação dos eliminados descritas abaixo onde houver conflito. Notas, identidade, corte e seeds congelados permanecem válidos. [Contrato completo e mensagem para o chat que gera a planilha](top50-2026.md). Fatos competitivos ambíguos deixam a classificação afetada pendente; divergências em colunas derivadas da fonte geram avisos.

## Adendo aprovado para a entrega de 2026 (28/09/2026)

As decisões explícitas mais recentes para esta entrega substituem as propostas pendentes abaixo onde houver conflito: corte exclusivo em `2026-10-01T03:00:00Z`; maior versão numérica do XLSX ainda no Drive modificada antes do corte; seeds da fonte são autoritativos, e ordem por rota/nota apenas indica divergências; 24–32 participantes, com `32−N` byes e `N−16` jogos; único reseeding depois da primeira rodada e distribuição A=1×16, B=8×9, C=4×13, D=5×12, E=2×15, F=7×10, G=3×14, H=6×11. Top 50 reserva 1–N sem ordem final e projeta N+1–50 por original e maior bônus comprovado (+6 Pré-playoff, +3 Play-in, +1 Repescagem, +0 sem fase); entradas posteriores ao corte concorrem só no residual, com 79+ se sem fase. Empate irredutível na última vaga exige decisão manual. Revisões não mudam cálculos de 2026; álbuns avaliados no ano contam independentemente de lançamento ou formato. Eliminados na mesma rodada serão ordenados por seed original, sem terceiro lugar. Snapshot real exige confirmação explícita do dono após backup restaurável; correção anterior à primeira partida exige nova versão, justificativa, comparação e declaração de elegibilidade no corte. Resultados /20, Late Challenger, médias/projeções anuais e algoritmo geral de fases históricas continuam pendentes.

Revisado em 28/09/2026. “Confirmado” significa instrução explícita do usuário. “Adotado para o MVP” registra uma escolha técnica feita na revisão do backlog; não autoriza provisionamento de serviços nem resolve regra competitiva. A descoberta da planilha, por si só, não aprova decisões.

## Confirmados

| ID | Decisão |
| --- | --- |
| C01 | App pessoal read-only. Atualizações vêm de arquivos Excel versionados na pasta do Drive. |
| C02 | Botão de sincronização no MVP; agendamento posterior. |
| C03 | Banco e backend calculam pelo regulamento confirmado e relatam diferenças da planilha. |
| C04 | Fonte oficial dos fatos é a planilha; regras fornecidas prevalecem sobre fórmulas divergentes. |
| C05 | Preservar original, revisões justificadas, 80*, scores, seed, ranking e índice/posição Top 50 separadamente. |
| C06 | Sem escrita no Drive, geração de planilha, CRUD pessoal no app, LLMs ou agentes na operação. |
| C07 | Importação idempotente, sem exclusão silenciosa; preservar último estado válido. |
| C08 | America/Sao_Paulo; sem resultados históricos inventados, sem reabrir fases encerradas pela nota. |
| C09 | Não habilitar cobranças/serviços pagos; credenciais e dados pessoais fora do Git. |
| C10 | Primeiro documentação, revisão da especificação e só depois implementação da aplicação. |
| C11 | Login via Google; configuração de login e banco Supabase será feita pelo usuário seguindo passo a passo, na etapa correspondente. |
| C12 | Interface escura, seguindo direção editorial musical; Tailwind e componentes locais no padrão shadcn/ui. Gráficos entram na etapa correspondente. |

## Decisões técnicas para o MVP

| ID | Decisão e estado | Consequência / limite |
| --- | --- | --- |
| T01 | Adotado: Next.js/TypeScript, PostgreSQL/Supabase e hospedagem compatível com Next.js | Arquitetura de app único; nenhum serviço foi provisionado. Plano, preços e limites serão conferidos antes de publicar. |
| T02 | Adotado: Google OAuth via Supabase, usuário pré-criado e autorização pelo UUID | Cadastro público fechado; outras contas recebem 403. Login real ainda não foi validado. |
| T03 | Adotado como desenho: conta de serviço Drive com acesso de leitor à pasta e escopo read-only | Acesso independente do conector da conversa; credencial e permissão reais ainda não foram validadas. Se a política da conta impedir esse modelo, interromper e rever a integração. |
| T04 | Adotado: preparar e validar o lote antes da transação; publicar tudo de forma atômica; versão candidata inválida preserva a última publicação | Nenhuma mescla parcial nem fallback silencioso. Falhas de infraestrutura permanecem tentativas separadas da última publicação válida. |
| T05 | Adotado para o ranking anual: nota original decrescente e posição por competição; notas iguais compartilham posição (90, 90, 88 → 1, 1, 3) | Artista/álbum só ordenam visualmente dentro do empate. Não criam desempate competitivo nem resolvem P07, que trata do residual do Top 50. |
| T06 | Adotado: total original válido pode ser usado mesmo quando pilares estejam ausentes ou incompletos; sinalizar avaliação incompleta | Não converter vazio em zero nem inferir pilares. Se os quatro pilares forem fornecidos, cada um deve respeitar /25 e a soma deve ser igual ao total; divergência é erro. |
| T07 | Adotado como identidade conservadora: temporada + artista creditado + título exato + edição explícita, quando houver | O XLSX auditado não tem ID estável nem coluna de edição. Aplicar NFC e remover apenas espaços externos para a chave; preservar caixa, pontuação e espaços internos. Colisão exata bloqueia; semelhança gera alerta, nunca fusão. Mudança/renomeação ambígua exige esclarecimento. |
| T08 | Proposta futura, fora do MVP: Last.fm começar com 90 dias e sobreposição de 48 h | Não importar nem fixar orçamento histórico antes de validar objetivo e volume reais. |

### Resultado da revisão de MVP (28/09/2026)

O ranking anual, a identidade de álbuns e as avaliações incompletas têm contrato definido acima. Como a fonte não apresenta pilares em colunas estruturadas, ausência ou preenchimento parcial não bloqueia um total original válido; o registro fica marcado como incompleto e não participa de validação de soma. Quando os quatro pilares estiverem disponíveis, a validação é integral. O parser não extrai pilares de texto livre por aproximação.

A identidade atual não distingue reedições que compartilhem exatamente artista e título, pois a planilha não fornece essa informação em coluna própria. Não fundir nem inventar edições: preservar o título recebido e a edição explícita se uma coluna verificável vier a existir. Se um ID persistente surgir no futuro, sua adoção exige mapeamento auditável dos IDs antigos, sem troca silenciosa de chaves.

P01–P14 seguem pendentes: dizem respeito à competição/Top 50 e não são necessários para consultar o ranking anual do MVP. Divergências em resumo, backlog ou campos competitivos devem ser reportadas como evidência da fonte; não impedem o ranking se artista, título e nota original forem válidos. Datas, revisões e resultados competitivos só entram no cálculo quando houver contrato confirmado. T08 e validações de Last.fm/AOTY seguem fora do MVP.

### Avanço autorizado

Após a entrega documental, o usuário pediu “Seguir para proxima etapa”. Isso autorizou a preparação funcional de acesso, migrações e verificações locais, sem provisionar serviços ou ativar cobranças. A revisão atual adota T04–T07 para o MVP; não converte P01–P14 em regras competitivas. Não trocar a arquitetura Next.js/PostgreSQL por um starter com outro banco.

Na continuação, o usuário escolheu login com Google e pediu para seguir o backlog, recebendo instruções de configuração na etapa correspondente. Implementado OAuth/PKCE com callback e autorização por UUID; removida entrada por senha. Depois, foram adicionados o parser XLSX, o serviço de publicação transacional, o endpoint protegido e a consulta privada do snapshot. Nenhum deles foi validado com credenciais reais ou dados publicados em banco hospedado.

## As 14 pendências do regulamento

| ID | Decisão pendente | Proposta para discussão, não aprovada | Cálculo afetado enquanto pendente |
| --- | --- | --- | --- |
| P01 | Top 50 com mais de 24 classificados | Reservar 1–N aos participantes e N+1–50 aos demais; manter texto 1–24 até aprovação | Composição final quando N > 24 |
| P02 | Fórmula de seeds e desempates | Tornar explícito se ordem privilegia nota original ou rota classificatória; depois definir cada desempate. A ordem observada não prova fórmula | Refazer seeds e congelar novo snapshot |
| P03 | Eliminados na mesma rodada e terceiro lugar | Sem jogo adicional de terceiro lugar; ordenar por fase atingida, depois desempenho comparável da rodada e seed. Comparabilidade ainda requer decisão | Posições finais dos participantes de Playoffs |
| P04 | Efeito de revisões | Manter original em ranking/elegibilidade/índice e seeds já congelados; revisão exibida separadamente | Qualquer efeito de revisão nas projeções |
| P05 | Vagas e desempates históricos do Play-in | Documentar os classificados observados como fatos; confirmar número de vagas e critérios a partir de evidência histórica | Explicação/reprodução da seleção histórica |
| P06 | Incrementos nas notas /25 e /5 de confronto | Propor inteiros /25 e meios pontos /5; não aplicar sem validação. Play-in inteiro e Pré-playoff meios pontos já estão confirmados | Validação final dos incrementos nessas escalas |
| P07 | Ranking anual residual | Definir chave estável explicitamente; não herdar rank que usa 80*. Proposta: posição anual original e depois ordem registrada de avaliação, se existir | Desempate final do índice Top 50 |
| P08 | Distribuição das oitavas A–H | Após ordenar sobreviventes como s1…s16, propor A=s1×s16, B=s8×s9, C=s4×s13, D=s5×s12, E=s2×s15, F=s7×s10, G=s3×s14, H=s6×s11 | Chave fixa depois do reseeding |
| P09 | Late Challenger: seleção, empate, formato e efeitos | Melhor nota original 90+; critérios adicionais por confirmar; confronto /20 com pilares, caráter simbólico sem mudar campeão/Top 50 | Escolha e resultado especial |
| P10 | Corte em 30/09: horário e evento | Propor avaliação concluída até 30/09 às 23:59:59 em America/Sao_Paulo; importação posterior não altera data do evento | Elegibilidade tardia e congelamento |
| P11 | Campo fora de 24–32 | Bloquear geração da rodada e apresentar total para decisão explícita | Byes/pareamento fora do intervalo |
| P12 | Ano de lançamento, EPs e ao vivo | Preservar registros legados; confirmar critérios de inclusão para novos registros. Presença na fonte não vira regra universal | Admissão de novos formatos/anos |
| P13 | Média, projeção anual e corte Top 50 | Propor média das originais; ritmo por dias decorridos até data de referência e projeção proporcional ao ano; corte exibir índice e todos os desempates da última vaga | Métricas oficiais; não copiar média que inclui 80* como original |
| P14 | Top 50 para lançamentos/escutas após 30/09 | Propor elegibilidade anual pelo índice, sem entrar em Playoffs; conflita com “apenas ranking anual” e exige aprovação | Elegibilidade tardia ao Top 50 |

P01, P03 e P07 impedem chamar de definitivo um Top 50 ainda indeterminado. P02, P08 e P10 impedem automatizar congelamento/chave. O MVP de ranking pode usar dados originais legados sem decidir essas regras.

## Pendências de descoberta e implantação

- D01: baixar XLSX privado com sucesso e auditar todas as abas/fórmulas; a extração de texto não fecha o mapeamento físico.
- D02: resolver divergências de backlog, promoção/métricas e participação/bônus descritas em [source-discovery.md](source-discovery.md).
- D03: validar presença/contrato de datas, identificadores, revisões e justificativas. Não usar data do upload como data de escuta.
- D04: confirmar T01–T08 na revisão, criar credenciais fora do Git e validar acesso real antes de declarar integração pronta.
- D05: validar formato de exportação do AOTY na conta e volume/objetivo do Last.fm, sem bloquear o ranking anual.

## Precedência e alterações futuras

Instruções explícitas mais recentes definem o escopo do app; por isso o tópico 21 foi preservado historicamente, mas não cria escrita no Drive. Alterações aprovadas de regras devem virar adendo datado por temporada, com versão, justificativa e resultados afetados. Não editar silenciosamente o texto histórico nem recalcular seed congelado. Pendências mantêm status visível até decisão registrada.
