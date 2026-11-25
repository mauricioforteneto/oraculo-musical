# Integrações e contratos

Implementados login Google via Supabase, seleção/download do Drive, parser XLSX e fluxo de publicação PostgreSQL. Verificações locais usam dados ou respostas sintéticas; nenhuma integração remota foi validada com credenciais da aplicação. A leitura pelo conector confirma descoberta parcial da fonte, não acesso do backend.

## Login Google

`POST /auth/login` valida origem e inicia Google OAuth por Supabase com PKCE. `GET /auth/callback` troca código pela sessão e consulta usuário autenticado; só OWNER_USER_ID recebe acesso. Cancelamento, código inválido e conta diferente retornam ao login. Destino é fixo em APP_ORIGIN, sem aceitar `next` ou Host do cliente. Sem solicitação de escopo Drive ou uso do token Google para sincronização. Setup manual em [setup.md](setup.md).

## Google Drive: entrada privada somente leitura

Proposta: conta de serviço Google dedicada, recebendo permissão de leitor apenas na pasta fonte. Usar escopo `https://www.googleapis.com/auth/drive.readonly`; o alcance efetivo depende também das permissões do principal. Não conceder acesso de domínio nem compartilhar publicamente. O escopo `drive.file` não deve ser presumido como autorização automática para todos os arquivos futuros da pasta. [Escopos oficiais](https://developers.google.com/workspace/drive/api/guides/api-specific-auth).

Na implantação, configurar conta e compartilhar a pasta explicitamente; confirmar que um novo arquivo publicado nela herda acesso. Credenciais do conector da conversa não são reutilizadas pelo código. Se a política da conta impedir conta de serviço, documentar o bloqueio e escolher OAuth de usuário offline em decisão posterior, sem ampliar permissões silenciosamente.

### Seleção determinística

1. Listar todos os filhos diretos, não excluídos, da pasta configurada, paginando até o fim. Não percorrer subpastas ou atalhos no MVP.
2. Filtrar MIME Excel e padrão exato `^albuns_2026_mauricio_atualizado_v([0-9]+)_.+\.xlsx$` para 2026. Comparar versão como inteiro, nunca lexicograficamente ou por modifiedTime.
3. Escolher a maior versão. Dois arquivos dessa versão bloqueiam, mesmo com conteúdo aparentemente igual. Arquivos de outras versões não geram ambiguidade da candidata atual.
4. Sem candidato: erro; não zerar base. Versão inferior à publicada: erro de regressão; não fazer rollback.
5. Obter metadados, baixar bytes pelo Drive API (`files.get` com `alt=media`), conferir novamente metadados para detectar edição durante download e calcular SHA-256. Para Excel não usar exportação de Google Sheets.

Referências: [listagem](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list), [download](https://developers.google.com/workspace/drive/api/guides/manage-downloads).

Implementação atual: `src/lib/ingestion/drive.ts` cobre listagem paginada limitada a 100 páginas (falha explícita ao exceder), seleção por inteiro sem perda de precisão, repetição de token/arquivo, busca incompleta, limite de download, revisão antes/depois e hash. `google.ts` fornece token de conta de serviço read-only. Essa camada não interpreta o XLSX, grava no banco nem está exposta em rota HTTP. Assinatura ZIP válida não prova workbook válido. Limites/retries cobertos por testes não comprovam acesso real.

### Leitura e validação

Limites técnicos propostos: 10 MB comprimidos, 100 MB descompactados, 10.000 registros de avaliação; exceder limites é erro acionável. Parser não executa macros, fórmulas, links externos ou instruções contidas em células. Conferir todas as abas e layout esperado; cabeçalho desconhecido obrigatório bloqueia para revisão do adaptador. Não presumir que colunas sempre estão nas mesmas posições.

Fórmulas da fonte são evidência: ler expressão e valor armazenado, detectar erro/ausência de cache; calcular o domínio com código convencional. Campo factual obrigatório cujo único valor depende de fórmula sem cache válido bloqueia o lote. Divergência em métrica derivada produz alerta. O leitor da conta de serviço acessou a fonte real; a auditoria abrangente das fórmulas ainda está pendente.

Tratar 401/403 como problema de credencial/permissão, 404 como fonte ausente e 429/5xx com até três tentativas e espera exponencial com jitter, respeitando Retry-After e orçamento total da requisição. Não repetir indefinidamente. Evitar armazenamento de bytes em logs, Git ou diretórios públicos.

## Contratos internos planejados

| Operação | Entrada | Resultado |
| --- | --- | --- |
| `getAnnualRanking` | temporada e filtros de consulta | snapshot, posições/grupos, total original, pendências |
| `getAlbum` | UUID interno | original, revisões, competição, proveniência |
| `getSyncStatus` | última execução ou UUID autorizado | tentativa, publicação, contagens e problemas |
| `syncDriveSource` | identidade do usuário autenticado; fonte configurada no servidor | status `succeeded`, `unchanged` ou `failed`, execução e relatório |

Na primeira aplicação, usar GET para consultas e POST `/api/sync` para sincronização. Não aceitar folderId, URL de download, ownerId, nota ou ruleset arbitrários no corpo. Backend deriva dono e fonte da configuração. Retornar 401 sem sessão, 403 para outra conta, 409 para concorrência/ambiguidade/regressão, 422 para dados inválidos, 502/503 para integração indisponível; detalhes sensíveis só em armazenamento privado autorizado.

Tipos devem distinguir resultado ausente por regra pendente de valor zero. Contagens de linhas novas, alteradas, inalteradas, ausentes, inválidas e avisos ficam separadas. `lastSuccessfulSyncAt` e `lastAttemptAt` são campos distintos. Nenhuma API pública de edição será criada.

Esses serviços internos permitem futura exposição de consultas por um único adaptador, Actions ou MCP, a escolher posteriormente. Nenhum deles será implementado agora. Fluxo de gravação pelo Chat comum fica fora do escopo read-only; eventual mudança exigiria outra especificação de origem e conflito.

## Resultados dos Playoffs

O parser `2026.3` lê a aba `Resultados Playoffs`, com cabeçalho `Fase | Jogo | Seed A | Artista A | Seed B | Artista B | Resultado | Vencedor | Critério`. A estrutura foi conferida no XLSX v99 fornecido pelo proprietário. Resultados, vencedores e critérios são preservados literalmente; linhas agendadas sem esses três campos não representam partidas realizadas.

Fases e IDs: `1ª rodada` com `Jogo 01` até `Jogo 16` conforme o tamanho do campo; `Oitavas` com `O1`–`O8`; `Quartas` com `QF1`–`QF4`; `Semifinais` com `SF1`–`SF2`; `Final` com `FINAL`. As posições A–H correspondem a O1, O8, O4, O5, O2, O7, O3 e O6. Vencedores seguem QF1–QF4, SF1–SF2 e FINAL, sem novo reseeding. O app valida os seeds e artistas contra os classificados de cada jogo antes de avançá-los; duplicidade e vencedor incompatível mantêm a vaga pendente.

Sem a nova aba, continua a leitura antiga de `Playoffs`. Se a nova aba declarar a primeira rodada, essa cópia é autoritativa, sem somar os resultados da aba antiga. Se trouxer apenas fases seguintes, os resultados da primeira rodada continuam vindo de `Playoffs`. Cabeçalho incompatível ou fato com fase, jogo ou participantes inválidos impede a publicação do lote e mantém a última publicação válida.

A persistência usa o JSON versionado já existente; não exige migração. Sincronizar novamente o mesmo XLSX reprocessa os resultados com a nova versão do parser sem duplicar o catálogo. Um marcador numérico em `sync_runs.counts.playoffParserRevision` identifica a extração bem-sucedida: até ela ocorrer, a leitura preserva o formato anterior. Depois, usa somente a nova extração, inclusive quando vazia. O deploy por si só não reprocessa a planilha: após disponibilizar a v99 na pasta do Drive e concluir o deploy, usar **Sincronizar** no app.

## Last.fm: etapa posterior

Usar `user.getRecentTracks`, com chave de API guardada no servidor e usuário configurado. O método documenta paginação, limite máximo de 200 e filtros `from`/`to` em Unix UTC; não exige sessão do usuário para a chamada pública. [Documentação oficial](https://www.last.fm/api/show/user.getRecentTracks).

Proposta de carga: últimos 90 dias, com teto de janela congelado no início da execução para que novas escutas não desloquem páginas. Persistir checkpoints por janela concluída; avançar watermark apenas quando todas as páginas forem persistidas. Em falha, retomar/repetir a janela com idempotência. Reconsultar sobreposição de 48 horas nas execuções incrementais para atrasos; correções mais antigas exigem reconciliação explícita.

Ignorar registro nowplaying e qualquer item sem timestamp para o histórico persistido. Deduplicar por usuário, timestamp, artista, faixa e álbum exatamente como recebidos; se houver múltiplos eventos indistinguíveis, sinalizar a limitação em vez de afirmar identidade global. Não deduplicar só por faixa. Conservar strings e MBIDs disponíveis; mapear edição para álbum somente quando inequívoco.

Tratar erro da API mesmo quando HTTP for 200, paginação incompleta, limite de taxa e falhas transitórias. Não transformar scrobble em audição integral, nota ou inscrição competitiva. Não importar histórico completo antes de medir volume e confirmar finalidade. Sem credencial/usuário real, integração fica não validada.

## AOTY e crítica

A pesquisa na documentação pública oficial, incluindo a [FAQ](https://www.albumoftheyear.org/faq/), não confirmou API oficial de leitura/escrita nem contrato de exportação acessível nesta sessão. Isso não prova inexistência. Não usar APIs de terceiros como se fossem oficiais, nem presumir scraping autorizado.

Preferir exportação que o usuário consiga obter na própria conta; inspecionar formato e permissões antes de planejar adaptador. Sem exportação verificada, manter somente referências externas. Notas da crítica e AOTY ficam em namespace separado e não alteram notas pessoais, ranking, elegibilidade, seeds ou resultados.


## MusicBrainz e Cover Art Archive

Enriquecimento de capas implementado separadamente da fonte de avaliações, sem credencial de API. Consulta grupos de lançamento por artista/título no MusicBrainz e suas capas frontais aprovadas no Cover Art Archive. Correspondência conservadora, revisão manual, cache, limitação global no banco e retomada de lotes estão descritos em [artwork.md](artwork.md). A migração em produção foi confirmada pelo usuário e houve associações de capas na busca real. Testes locais usam respostas sintéticas. Falhas externas agora recebem diagnóstico por provedor/motivo; sua conferência em produção permanece pendente.

## Temporadas e regras

A configuração por ano, os adaptadores de campeonato, as rotas com `temporada`, a migração aditiva e o procedimento de ativação de 2027 estão em [temporadas.md](temporadas.md). A página privada de regras independe de uma fonte importada.
