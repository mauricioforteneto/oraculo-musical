# Backlog e critérios de aceite

## Atualização — histórico de versões

- [x] Página privada `/historico` com versões importadas e comparação com a anterior disponível; snapshots de álbuns, backlog e resultados dos Playoffs.
- [x] Adições, alterações, ausências e reaparecimentos com proveniência; distinção entre extração vazia comprovada e histórico indisponível, sem presumir exclusões ou datas de escuta/partida.
- [x] Busca, filtros de bloco/tipo, controle separado de posições e índices, expansão antes/depois e paginação numérica de publicações.
- [x] Testes unitários e consultas reais em PGlite para isolamento de fontes, papel leitor, compatibilidade de extração e autorização. Comparação local v99 → v100: 37 álbuns com mudanças somente derivadas, sem alterações em backlog ou resultados. Contrato em [version-history.md](version-history.md).
- [ ] Conferir a página autenticada no Railway após o deploy, com as versões disponíveis no banco.


## Atualização — estatísticas do acervo

- [x] Página privada `/estatisticas`, ligada à navegação, com contagens e médias originais por gênero, país e artista.
- [x] Todos os gêneros por álbum, sem duplicação dentro da categoria; países e créditos de colaborações preservados; recorte somente da versão atual e notas ausentes tratadas separadamente.
- [x] Seleção dos álbuns por grupo, troca de dimensão, limpeza, expansão e uso em 360 px. Totais gerais permanecem estáveis durante a exploração.
- [x] Testes de cálculo e apresentação, autorização antes da leitura, build, E2E HTTP e conferência local da v100. Detalhes em [statistics.md](statistics.md).
- [x] Conferir a página de estatísticas no Railway (confirmado pelo proprietário).


## Atualização — Top 50 2026-top50-2

- [x] Reservas dinâmicas, eliminados por índice com bônus de +8/+10/+12/+14 e finalistas protegidos; seed desempata eliminados da mesma fase. Contrato e mensagem para o chat da planilha em [top50-2026.md](top50-2026.md).
- [x] Recalcular pela chave validada, preservando a nota congelada e sem duplicar álbuns. Resultados ausentes, inválidos ou corrigidos não deixam eliminações presumidas persistirem.
- [x] Distinguir avisos de colunas derivadas da planilha de conflitos em fatos; mostrar regra, reservas, bônus, índices e posições provisórias no painel.
- [x] Importação da v100 confirmada pelo proprietário; conferência local mostrou reservas, eliminados, bônus, índices e posições compatíveis com a nova regra. A contradição factual de Interpol e o empate no corte continuam sinalizados.
- [ ] Resolver as contradições factuais já documentadas de participação na Repescagem e eventual empate na última vaga; não inventar resolução automática.

## Atualização — navegação da chave até a final

- [x] Resolver os vencedores publicados da primeira rodada, incluindo o formato `Artista (#seed)`, e materializar as oitavas com os byes e o único reseeding.
- [x] Navegar entre primeira rodada, oitavas, quartas, semifinais e final. Abrir nas oitavas quando os 16 participantes estiverem definidos; caso contrário, abrir na primeira rodada.
- [x] Mostrar os caminhos fixos A×B, C×D, E×F e G×H nas quartas, quartas 1×2 e 3×4 nas semis e seus vencedores na final. Nenhum participante ou resultado é presumido.
- [x] Explicar por jogo os bloqueios da primeira rodada: resultado não associado, duplicidade, vencedor ausente ou incompatível. Preservar versão, linha e texto dos resultados publicados.
- [x] Exibir um confronto por linha em telas pequenas, com nomes de artistas e álbuns sem truncamento.
- [x] Confirmar o formato na v99 e implementar a leitura de `Resultados Playoffs` e o avanço dos vencedores até o campeão, preservando o caminho fixo e os seeds originais. A v99 contém oito resultados da primeira rodada; as fases seguintes continuam sem resultados reais.
- [x] Sincronizar a v99 e conferir a importação hospedada da nova aba (confirmado pelo proprietário).
- [ ] Validar resultados das fases seguintes quando forem publicados; progressão completa e campeão foram exercitados somente com dados fictícios.

Validação desta atualização: testes unitários de resolução, caminhos e apresentação; integração em PGlite; navegação em Chromium com fonte sintética a 360 px, incluindo primeira rodada incompleta, byes, evidência da fonte e ausência de rolagem horizontal. A confirmação visual das oitavas no Railway foi fornecida pelo proprietário antes desta atualização; não valida o deploy da nova navegação.

## Estado atual — 02/10/2026

O corte de 30/09 seleciona a v82 para participantes e seeds porque v83 e v84 foram modificadas após o horário de corte. A interface separa os dois papéis: a chave usa a fonte de corte; o resultado de partida vem da versão sincronizada. A leitura do banco em 02/10 confirmou v84 como publicação atual, um resultado de playoff armazenado e o snapshot v82 ativo. Os registros imutáveis de álbuns estão nas versões importadas v81 (120 linhas) e v84 (122 linhas); a v84 contém 29 evidências de Repescagem, 16 de Play-in e 14 de Pré-playoff. A planilha v82 de corte é lida diretamente do Drive para o snapshot, sem exigir publicação no catálogo.

### Próximos itens, em ordem

- [x] Mostrar primeira rodada, byes, oitavas condicionais e projeção residual do Top 50 em um painel visual.
- [x] Ler resultados publicados da aba `Playoffs` sem trocar participantes ou seeds do corte; associar cada resultado por seeds e artistas e exibir versão/linha da fonte.
- [x] Criar visão de histórico da Repescagem, Play-in e Pré-playoff a partir dos registros imutáveis por versão já armazenados em `source_album_records`. Exibir score, resultado literal, versão da primeira evidência, versão atual/última evidência e alterações observadas. Implementado localmente nesta atualização; a consulta de leitura confirmou que há registros nas três fases, mas a renderização no navegador ainda não foi conferida.
- [x] Auditar a divergência de Repescagem da v84. A linha 52 informa fase e bônus de Repescagem, mas a observação afirma que a avaliação ocorreu após o fechamento da fase e ficou fora da pós-temporada; a mesma combinação já constava na v81. O app mantém o registro sem posição provisória.
- [ ] Resolver a contradição desse registro na planilha ou por decisão explícita documentada. Conferir se o bônus e a indicação de fase devem permanecer; nenhuma interpretação automática pode substituí-los sem evidência.
- [ ] Fechar as regras ainda necessárias para posições definitivas dos participantes e empate na última vaga residual, incluindo comparabilidade de desempenho entre eliminados da mesma rodada e critérios que a fonte não resolve. Registrar adendo datado em [decisions.md](decisions.md) antes de calcular posições finais.
- [ ] Consolidar Top 50 definitivo quando resultados e regras estiverem completos; manter 1–N reservados até conhecer a ordem final dos participantes.
- [x] Identificar os vencedores da primeira rodada com segurança e fazer o único reseeding antes das oitavas. A importação das fases seguintes está implementada conforme a atualização acima; sua validação com resultados reais permanece pendente. Não inferir vencedor de texto ambíguo.

P01, P02, P04, P08, P10, P12 e P14 tiveram seu recorte de 2026 definido pelo adendo aprovado em [decisions.md](decisions.md); a matriz antiga abaixo continua como registro das propostas originais e não deve ser lida como bloqueio integral dessas partes. Resultados /20, Late Challenger, médias/projeções anuais e reprodução algorítmica de todas as fases históricas continuam fora do recorte confirmado.

Atualização da entrega competitiva em 28/09/2026: prévia privada do arquivo de corte, validação de participantes/seeds, chave da primeira rodada, espaços condicionais das oitavas e projeção residual do Top 50 implementados. As migrações 0003/0004 adicionam snapshots imutáveis de participantes, ponteiro ativo e declarações auditáveis; foram aplicadas no Supabase, cada uma após nova cópia GPG criptografada. A leitura hospedada confirmou zero snapshots ativos e papel leitor sem permissão de inserção. A confirmação exige corte atingido, nova leitura/hash do XLSX e declaração de backup restaurável; essa declaração é do proprietário, não uma verificação automática da restauração naquele momento. Correções exigem XLSX posterior ao corte, versão superior, justificativa, comparação auditável e declarações de elegibilidade e ausência de primeira partida. Testes fictícios, integração PostgreSQL isolada, build, lint e tipos passaram. A leitura privada atual aponta 24 participantes e uma divergência de Repescagem sem posição provisória. Resultados de partidas, posições finais, Late Challenger, médias/projeções anuais e reprodução geral das fases históricas seguem fora desta entrega. O congelamento real não foi executado: depende do corte e de ação explícita do proprietário. A segunda conta e a pasta de teste no Drive continuam dispensadas e não constam como validadas.

Status inicial em 27/09/2026: documentação e base funcional de acesso implementadas após instrução de avançar. Autenticação real, serviços hospedados e importação ainda não validados.

Validação local em 28/09/2026: login Google do proprietário, conexões SQL segregadas, leitura da pasta privada no Drive e publicação da fonte pessoal em PostgreSQL concluídos. Uma segunda sincronização retornou `unchanged` sem duplicar dados. A URL administrativa foi separada de `.env.local` e movida para `.env.migration.local`, ignorado pelo Git. Os ensaios com outra conta e fonte de teste privada foram dispensados por ora pelo usuário.

Recuperação em 28/09/2026: `pg_dump` dos esquemas `oraculo` e `oraculo_migrations` gerou uma cópia GPG criptografada em `.private/backups/` usando TLS verificado. A restauração em PostgreSQL 17 local e isolado foi concluída; contagens e conteúdo das 12 tabelas conferiram com a origem após normalização de horários e JSON. O banco temporário foi removido. A cópia ainda precisa ser guardada fora deste computador, e a senha deve ter guarda separada. Procedimento em [backup.md](backup.md).

Fonte de teste em 28/09/2026: duas planilhas inteiramente fictícias, v1 com um álbum e v2 com dois, foram preparadas em `.private/test-source/`. O parser as leu como publicáveis, sem erros ou avisos. O usuário dispensou por ora o ensaio Drive → banco → ranking com pasta de teste e o ensaio de acesso com segunda conta; não há esses recursos disponíveis. Esses resultados não são considerados validados.

Evidência competitiva em 28/09/2026: os campos já importados da planilha passaram a aparecer no detalhe de cada álbum como registros da fonte, incluindo scores, resultados, seed, bônus, índice e posição Top 50 provisória quando presentes. A publicação atual possui 26 posições provisórias registradas. Nenhum cálculo oficial de Top 50 ou chaveamento foi liberado; P01–P14 seguem pendentes.

Consulta do backlog em 28/09/2026: o painel agora permite abrir todos os registros publicados da aba `Backlog` e consultar prioridade e referência de cada item; a lista inicial continua compacta. Os 15 itens importados seguem somente leitura. Reescutas ainda não têm mapeamento confiável na fonte.

Auditoria local em 28/09/2026: os papéis `anon` e `authenticated` não têm acesso ao esquema `oraculo`; `oraculo_web` não escreve e `oraculo_importer` não altera nem exclui avaliações originais. Uma busca por valores completos de credenciais nos arquivos versionados e nos bundles de navegador existentes não encontrou correspondências. Isso não substitui a revisão da configuração hospedada nem um ensaio de acesso com outra conta.

Revisão do MVP em 28/09/2026: desempates posicionais do ranking anual, chave conservadora de identidade e tratamento de totais com pilares incompletos registrados em [decisions.md](decisions.md), [spec.md](spec.md) e [data-model.md](data-model.md). P01–P14 permanecem pendentes porque afetam regras competitivas/Top 50, fora do MVP de ranking anual.

Atualização em 27/09/2026: prévia do dashboard liberada para consulta local em `http://127.0.0.1:3000`, sem login apenas em desenvolvimento e enquanto a autenticação não estiver configurada. O servidor fica vinculado ao loopback; produção segue protegida. Build, lint e verificação de tipos passaram, e a rota principal respondeu HTTP 200 com a prévia de 118 álbuns. A fonte local permanece em `.private/`, fora do Git.

Suporte local em 27/09/2026: reproduzido bloqueio do PowerShell ao executar `npm run dev` (`npm.ps1` barrado pela Execution Policy). Instrução documentada em [setup.md](setup.md): usar `npm.cmd run dev` no PowerShell ou `npm run dev` no Prompt de Comando.

Falha do servidor em 27/09/2026: reproduzido no Ubuntu WSL. `node_modules` continha apenas o binário Windows de Lightning CSS, embora o Next estivesse rodando em Linux por `/mnt/c`. Encerrada a instância com erro, `npm ci` foi executado no WSL e o servidor reiniciado lá. A rota `/` respondeu HTTP 200, exibindo prévia local de 118 álbuns. A instância foi encerrada em 28/09/2026; o setup instrui instalar dependências no mesmo sistema operacional que executará a aplicação.

Ambiente local em 28/09/2026: checkout de trabalho copiado para `~/projects/oraculo-musical` no filesystem Linux do WSL, preservando a cópia Windows. Dependências reinstaladas no WSL; `npm run test` (25 testes), `npm run typecheck`, `npm run lint` e `npm run build` passaram. O Git do WSL reutiliza o Git Credential Manager do Windows; push validado e commit `731c947` publicado em `origin/main`. A rota `/` respondeu HTTP 200 pelo WSL e pelo Windows; o servidor de desenvolvimento está ativo em `http://127.0.0.1:3000`.

Implementação local em 28/09/2026: criada a migração 0002 para snapshots por versão, estado de ausências, publicação e leases; criado o serviço transacional que conecta Drive → XLSX → PostgreSQL, o endpoint POST protegido e a consulta privada do snapshot publicado. O painel agora conserva a última publicação válida quando uma tentativa falha e exibe estado, versão, horários, contagens, apontamentos e até oito tentativas recentes. Typecheck, lint e `git diff --check` passaram após as alterações. Ainda não houve aplicação da migração nem ensaio das integrações reais; essa implementação aguarda configuração externa.

## Entrega 0 — revisão e descoberta

- [x] Inspecionar repositório/Git e preservar arquivos existentes.
- [x] Identificar tipo da fonte e analisar a extração disponível sem modificá-la.
- [x] Documentar escopo read-only, infraestrutura, modelo, integrações, regulamento e decisões.
- [x] Preparar `.gitignore` e `.env.example` sem credenciais.
- [x] Obter uma cópia local do XLSX e auditar abas/fórmulas. Relatório e prévia com dados reais permanecem em `.private/`, fora do Git; a leitura pelo conector Drive ainda retorna HTTP 403.
- [x] Revisar propostas técnicas e pendências necessárias ao MVP. Aceite: empate anual, identidade e legado incompleto registrados; pendências competitivas separadas do ranking anual.

## Entrega 1 — preparação funcional e segurança

- [x] Scaffold Next.js/TypeScript, versões fixadas e package-lock.json. Migração inicial de fontes, versões, tentativas, álbuns, originais e problemas; outras entidades virão com os respectivos recursos.
- [x] Criar scripts lint/typecheck/test/test:integration/test:e2e/build/db:migrate e CI com `npm ci`; PostgreSQL efêmero na CI e PGlite isolado localmente.
- [x] Fixtures exclusivamente fictícias em `tests/fixtures/synthetic`; nenhuma exportação pessoal no Git. Fixture XLSX fica para a implementação do parser.
- [ ] Conta pessoal pré-criada; cadastro público fechado; autorização em cada entrada HTTP e cache privado. Ensaio com segunda conta dispensado por ora pelo usuário.
- [x] Credenciais SQL de leitura, sincronização e migração segregadas no ambiente local; credenciais Drive exclusivas do servidor.
- [ ] Conferir segregação no ambiente hospedado e ausência de segredos no bundle e nos logs.
- [x] Criar backup criptografado local e ensaiar restauração em banco isolado; cópia externa e rotação semanal pendentes.

Código de login/logout e autorização de dono implementado, com estado fechado sem configuração e proteção de origem nos POSTs. O login real do proprietário e a leitura/importação por papéis SQL distintos foram observados; ainda falta conferir cadastro público fechado e acesso negado a outra conta. CI criada, ainda não executada no GitHub nesta sessão.

Atualização: login agora usa Google OAuth/PKCE, sem formulário de senha; callback bloqueia contas diferentes e redirecionamentos externos. Passo a passo do login e banco está preparado em [setup.md](setup.md) para a etapa de configuração manual, conforme solicitado. Não é necessário fornecer credenciais na conversa para continuar o código testável localmente.

Aceite: visitante sem sessão e outra conta não leem dados nem acionam sync; papel leitor falha em tentativa SQL de escrita; segredo ausente no bundle, logs e repositório. CI não usa segredos de produção em PRs. Backup/restauração em ambiente isolado documentado e ensaiado antes de migração de produção.

## Entrega 2 — fonte → banco → ranking anual

- [x] Listagem paginada, escolha de maior versão numérica, download privado, validação e auditoria.
- [x] Persistência transacional, idempotência, histórico, relatório, preservação de ausentes e último estado válido.
- [x] Tela de ranking, busca, detalhes, sincronização e versões/horários/pendências.
- [x] Ensaio real com credenciais da aplicação, além de mocks: primeira publicação e repetição `unchanged`.
- [ ] Ensaio controlado com avaliação fictícia nova em fonte de teste privada. Dispensado por ora pelo usuário; arquivos fictícios locais preparados, sem publicação de teste no Drive.

Progresso: leitor Drive com paginação, seleção de versão numérica, revalidação e hash; parser XLSX; persistência transacional idempotente com histórico de snapshots, preservação de ausentes e última publicação válida; consulta DB para ranking; endpoint POST com autorização do dono e validação de origem. A migração 0002 foi aplicada e a fonte pessoal foi publicada com OAuth, Drive e PostgreSQL reais. A repetição retornou `unchanged`; backup/restauração isolada conferiu. O ensaio com fonte fictícia foi dispensado por ora; cenários de falha com serviços reais seguem sem exercício.

Aceite central: nova avaliação fictícia em fonte de teste privada → botão → um registro no banco → posição correta. Em seguida, teste controlado com fonte pessoal sem escrita nela. Nenhuma edição de avaliação ou upload arbitrário pelo app.

### Cenários obrigatórios do importador

| Cenário | Resultado esperado |
| --- | --- |
| v9 e v10; datas de modificação invertidas | Seleciona v10 |
| Candidato só na segunda página do Drive | Paginação encontra maior versão |
| Dois arquivos da maior versão | 409, sem publicação |
| Maior versão inválida e anterior válida | Mantém última publicação, não faz fallback oculto |
| Nenhum arquivo, pasta inacessível, token inválido, 429/5xx | Erro distinto, retries limitados quando cabíveis; nenhuma perda |
| Mesmo arquivo/hash reimportado | `unchanged`, sem duplicar avaliação/histórico |
| Versão nova, mesmos registros | Nova proveniência; sem novas avaliações ou revisões |
| Mesmo número com bytes alterados; versão inferior | Conflito/regressão, sem sobrescrita |
| Arquivo muda durante download | Rejeita leitura instável |
| Linha adicionada e metadado alterado | Insere/atualiza com antes/depois e proveniência |
| Linha ausente e depois reaparece | Mantém e sinaliza; reaparecimento reutiliza identidade |
| Duplicidade, possível renomeação ou edição distinta | Bloqueia ambiguidades; não funde silenciosamente |
| Original alterada sem justificativa | Lote rejeitado; original intacta |
| Cabeçalhos incompatíveis, total inválido, fórmula factual sem cache | Relatório por causa; nenhuma publicação parcial |
| Dois cliques/sessões simultâneos | Uma execução por fonte; versão antiga não vence corrida |
| Crash antes/depois do commit | Rollback ou publicação íntegra; retry não duplica |

### Cenários de notas e interface

- Limites 0/25 por pilar e 0/100 total; soma divergente é erro. Vazio não vira zero.
- Legado com total válido sem pilares aparece como incompleto, sem alegar soma validada.
- Exemplo **fictício**: álbum A tem original 78 e promoção 80*; álbum B tem original 79. B precede A no ranking anual.
- Empates anuais seguem decisão registrada; desempate visual não vira seed nem ranking residual.
- Fonte sem mudanças mantém a tela; falha mostra tentativa malsucedida separada da última sincronização válida.
- Verificar celular 360 px, teclado, estado vazio, loading, erro e sessão expirada. Não exibir dados pessoais em página pública/cache compartilhado.

## Entrega 3 — Top 50 e histórico competitivo

Recorte histórico de 28/09, substituído por [2026-top50-2](top50-2026.md): posições 1–N reservadas sem ordem final; vagas N+1–50 usam a maior fase comprovada, bônus não cumulativo e fonte publicada mais recente. Álbuns após o corte disputam apenas as vagas residuais. Divergências de fase ficam sem posição provisória; empate irredutível na última vaga aguarda decisão manual. Os campos históricos das fases anteriores seguem como evidência, sem algoritmo geral para reexecutar torneios encerrados.

O recorte de 2026 para reserva de vagas, revisões e elegibilidade posterior ao corte está aprovado no adendo de [decisions.md](decisions.md). Ainda faltam critérios para posições finais dos participantes, empate irredutível na vaga residual e métricas anuais oficiais. O histórico de fases exibe evidências por versão publicada; seleção histórica não é reexecutada para inventar resultados.

Os campos competitivos da versão publicada estão preservados no detalhe de cada álbum. A nova visão reúne evidências das três fases encerradas e suas alterações observadas entre versões publicadas, reutilizando `source_album_records`; não atribui data real à partida nem recalcula classificados históricos. A conferência das divergências da fonte e os critérios para posições finais continuam pendentes.

Testar: bônus máximo e não cumulativo (+1, +3, +6); Repescagem Etapas 1 e 2 ambas +1, Etapa 2 vence desempate; sem fase 79 elegível e 78 inelegível; participantes podem ter original menor; Play-in inteiro /25 e Pré-playoff meios pontos /25; desempates por fase/desempenho/original/residual aprovado. Índice não ordena participantes dos Playoffs. Casos N=24 e N>24 devem respeitar decisão P01; enquanto não resolvida, resultado final indisponível.

## Entrega 4 — Playoffs e calendário

Recorte aprovado para 2026: seed da planilha governa a rodada inicial; ordem Elite → entrada direta → Pré-playoff e nota original apenas apontam divergências. Campo de 24–32: `32−N` byes, `N−16` jogos entre melhor e pior seed dos que jogam. Após resultados reais, um reseeding único posicionará A–H; até lá as oitavas são espaços condicionais. Snapshot de corte e correções são auditados, sem partidas presumidas pelo calendário.

Seeds da fonte, corte e distribuição A–H foram aprovados para 2026. Fora do intervalo de 24 a 32 participantes, a chave continua bloqueada para decisão. Incrementos de notas de confronto ainda exigem regra própria; os resultados publicados são exibidos como fatos da fonte. Conferir todos os N de 24 a 32: byes=32−N, jogos=N−16, exatamente 16 sobreviventes e nenhum participante repetido. N=24 produz 8 byes e pares 9×24 até 16×17; N=25 produz 7 byes e 9 jogos; N=32 não tem bye.

Testar: 85+ no prazo pode entrar; 84 não entra em fase encerrada; 90+ é Elite e Playoff direto; nenhum classificado é expulso. Após corte, não entrar automaticamente. Congelamento cria snapshot imutável e ajuste de calendário não inventa partida realizada.

Testar empate /20 por Replay, depois Consistência, depois seed original. Reseeding acontece exatamente uma vez com sobreviventes + byes; depois zebra herda posição e não reorganiza quartas/semis/final. P08 define pares A–H. Temporada futura não altera campeonato de 2026. Late Challenger não altera campeão/Top 50 sem regra aprovada.

## Entrega 5 — Last.fm, backlog e reescutas

Validar janela inicial e orçamento. Testar paginação com limite de 200, janela estável, nowplaying, timestamps ausentes, faixas repetidas em horários distintos, retries, deduplicação e retomada sem avançar checkpoint incompleto. Diferentes edições não são fundidas. Medir volume real; não afirmar integração validada só com fixtures.

Backlog continua sendo importado e armazenado, mas está temporariamente oculto em toda a interface. A próxima solução de escutas será decidida separadamente. Reescutas dependem de mapeamento confiável na fonte. AOTY depende de exportação comprovada e não sobrescreve avaliação oficial. Mixtapes, análise de gosto e eventual adaptador de consulta para Chat ficam em backlog futuro, sem compromisso de implantação nesta fase.

## Critério de publicação

Verificações correspondentes à entrega passam; banco e Drive reais são acessíveis pelo backend; backup restaurável; limite gratuito e ausência de cobrança automática reconfirmados; credenciais nunca chegam ao cliente. Publicação não é condição para encerrar esta entrega de documentação.


## Refatoração de navegação e layout

Implementada a divisão de páginas e o menu mobile descritos em [navigation.md](navigation.md), incluindo detalhes por UUID, preservação de filtros, controles isolados em Sincronização e ocultação do backlog sem remoção de dados. Regras competitivas e contratos de escrita preservados. Validações automatizadas e ensaio Chromium local cobrem as rotas; pendente conferir o novo layout autenticado no Railway.


## Capas dos álbuns

Implementada a busca MusicBrainz + Cover Art Archive para Início, catálogo e avaliação, com preenchimento após sincronizar, progresso retomável e revisão manual. Migração `0006` e procedimento em [artwork.md](artwork.md). A migração foi aplicada pelo usuário no Supabase e a busca em produção obteve associações; falhas externas motivaram diagnóstico por provedor/status HTTP/timeout, cuja conferência em produção permanece pendente; expandir capas para Top 50/Playoffs ou outras fontes fica para etapa posterior.

A revisão manual agora possui listas em Álbuns, com contagens e filtros por situação da capa, além do atalho em Sincronização. Não exige nova estrutura de banco.
