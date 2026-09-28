# Decisões e pendências

Referência: 27/09/2026. “Confirmado” significa instrução explícita do usuário. “Proposta” não autoriza regra competitiva nem provisionamento. Nenhuma pendência abaixo foi resolvida automaticamente pela descoberta.

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

## Propostas técnicas para revisão

| ID | Proposta | Consequência |
| --- | --- | --- |
| T01 | Next.js/TypeScript + Supabase Free + Vercel Hobby | App único; pausa do banco e backup próprio documentados |
| T02 | Supabase Auth com usuário pré-criado e UUID permitido | Cadastro público desligado; demais usuários recebem 403 |
| T03 | Conta de serviço Drive, acesso de leitor à pasta e escopo read-only | Aplicação independente do conector da conversa |
| T04 | Lote atômico; maior versão inválida mantém última publicação | Evita estado parcialmente atualizado |
| T05 | Ranking anual por nota original, mesma posição para empate (1,1,3) | Ordem alfabética só visual; não resolve P07 |
| T06 | Aceitar legado com total original e pilares incompletos sinalizados | Ranking funciona sem inventar notas de pilares |
| T07 | Identidade provisória por temporada/artista/título/edição | Renomeação ou colisão exige esclarecimento; preferir ID da fonte quando disponível |
| T08 | Last.fm inicialmente 90 dias, sobreposição de 48 h | Limita volume; cobertura histórica aparece explicitamente |

Esses defaults orientam a próxima revisão; não foram apresentados como regras confirmadas. Detalhes em [arquitetura](architecture.md), [modelo](data-model.md) e [integrações](integrations.md).

### Avanço autorizado

Após a entrega documental, o usuário pediu “Seguir para proxima etapa”. Isso autoriza a preparação funcional: Next.js, login Supabase, migrações, permissões e verificações locais. T01/T02 orientam essa implementação sem provisionar serviços ou ativar cobranças. T04–T08 e P01–P14 não foram convertidos em decisões competitivas por essa instrução; importação e desempates ainda não implementados. Não trocar a arquitetura Next.js/PostgreSQL por um starter de hospedagem com outro banco.

Na continuação, o usuário escolheu login com Google e pediu para seguir o backlog, recebendo instruções de configuração na etapa correspondente. Implementado OAuth/PKCE com callback e autorização por UUID; removida entrada por senha. A leitura de versões do Drive avançou em módulo isolado com testes sintéticos, sem fechar parser físico, publicar importações ou validar credenciais remotas.

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
