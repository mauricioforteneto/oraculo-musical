# Backlog e critérios de aceite

Status inicial em 27/09/2026: documentação e base funcional de acesso implementadas após instrução de avançar. Autenticação real, serviços hospedados e importação ainda não validados.

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
- [ ] Conta pessoal pré-criada; cadastro público fechado; autorização em cada entrada HTTP e cache privado.
- [ ] Credenciais SQL de leitura, sincronização e migração segregadas; credenciais Drive exclusivas do servidor.

Código de login/logout e autorização de dono implementado, com estado fechado sem configuração e proteção de origem nos POSTs. Testes de permissões SQL implementados; ainda falta ensaio com Supabase real e usuário proprietário/usuário não autorizado. CI criada, ainda não executada no GitHub nesta sessão.

Atualização: login agora usa Google OAuth/PKCE, sem formulário de senha; callback bloqueia contas diferentes e redirecionamentos externos. Passo a passo do login e banco está preparado em [setup.md](setup.md) para a etapa de configuração manual, conforme solicitado. Não é necessário fornecer credenciais na conversa para continuar o código testável localmente.

Aceite: visitante sem sessão e outra conta não leem dados nem acionam sync; papel leitor falha em tentativa SQL de escrita; segredo ausente no bundle, logs e repositório. CI não usa segredos de produção em PRs. Backup/restauração em ambiente isolado documentado e ensaiado antes de migração de produção.

## Entrega 2 — fonte → banco → ranking anual

- [x] Listagem paginada, escolha de maior versão numérica, download privado, validação e auditoria.
- [x] Persistência transacional, idempotência, histórico, relatório, preservação de ausentes e último estado válido.
- [x] Tela de ranking, busca, detalhes, sincronização e versões/horários/pendências.
- [ ] Ensaio real com credenciais da aplicação, além de mocks.

Progresso parcial: leitor Drive isolado com paginação, seleção de versão numérica, ambiguidades, limites, revalidação e hash; parser XLSX; persistência transacional idempotente com histórico de snapshots, preservação de ausentes e última publicação válida; consulta DB para ranking; endpoint POST com autorização do dono e validação de origem. A cópia local v80 foi auditada e a interface privada exibe ranking pela nota original, busca, filtros, detalhes, backlog e divergências da fonte. Ainda pendem aplicação e revisão da migração 0002, configuração e ensaio de Drive/OAuth/PostgreSQL reais, validação de backup e relatório completo de versões/tentativas.

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

Depende das decisões pertinentes P01/P03/P04/P05/P07/P12/P13/P14. Importar fases encerradas como histórico, preservando evidência; nunca reexecutar a seleção para inventar resultados.

Testar: bônus máximo e não cumulativo (+1, +3, +6); Repescagem Etapas 1 e 2 ambas +1, Etapa 2 vence desempate; sem fase 79 elegível e 78 inelegível; participantes podem ter original menor; Play-in inteiro /25 e Pré-playoff meios pontos /25; desempates por fase/desempenho/original/residual aprovado. Índice não ordena participantes dos Playoffs. Casos N=24 e N>24 devem respeitar decisão P01; enquanto não resolvida, resultado final indisponível.

## Entrega 4 — Playoffs e calendário

Depende de P02/P06/P08/P10/P11. Testar todos os N de 24 a 32: byes=32−N, jogos=N−16, exatamente 16 sobreviventes e nenhum participante repetido. N=24 produz 8 byes e pares 9×24 até 16×17; N=25 produz 7 byes e 9 jogos; N=32 não tem bye.

Testar: 85+ no prazo pode entrar; 84 não entra em fase encerrada; 90+ é Elite e Playoff direto; nenhum classificado é expulso. Após corte, não entrar automaticamente. Congelamento cria snapshot imutável e ajuste de calendário não inventa partida realizada.

Testar empate /20 por Replay, depois Consistência, depois seed original. Reseeding acontece exatamente uma vez com sobreviventes + byes; depois zebra herda posição e não reorganiza quartas/semis/final. P08 define pares A–H. Temporada futura não altera campeonato de 2026. Late Challenger não altera campeão/Top 50 sem regra aprovada.

## Entrega 5 — Last.fm, backlog e reescutas

Validar janela inicial e orçamento. Testar paginação com limite de 200, janela estável, nowplaying, timestamps ausentes, faixas repetidas em horários distintos, retries, deduplicação e retomada sem avançar checkpoint incompleto. Diferentes edições não são fundidas. Medir volume real; não afirmar integração validada só com fixtures.

Backlog e reescutas continuam vindo da fonte, após resolver divergências de descoberta. AOTY depende de exportação comprovada e não sobrescreve avaliação oficial. Mixtapes, análise de gosto e eventual adaptador de consulta para Chat ficam em backlog futuro, sem compromisso de implantação nesta fase.

## Critério de publicação

Verificações correspondentes à entrega passam; banco e Drive reais são acessíveis pelo backend; backup restaurável; limite gratuito e ausência de cobrança automática reconfirmados; credenciais nunca chegam ao cliente. Publicação não é condição para encerrar esta entrega de documentação.
