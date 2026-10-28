# Navegação e responsabilidades

O Oráculo mantém o tema verde escuro e cobre. A estrutura compartilhada contém marca, título, versão da fonte e navegação; o conteúdo de cada rota tem uma responsabilidade.

| Rota | Conteúdo |
| --- | --- |
| `/` | Resumo da escuta, três destaques e acesso à temporada |
| `/albuns` | Ranking anual, busca, filtros por nota e mais resultados |
| `/albuns/[id]` | Avaliação completa, registros competitivos e proveniência |
| `/top-50` | Classificação calculada, regras e pendências |
| `/playoffs` | Chave e resultados; `?aba=historico` abre as fases anteriores |
| `/estatisticas` | Gêneros, países, artistas e links para as avaliações |
| `/historico` | Comparação de publicações de álbuns e resultados |
| `/sincronizacao` | Importação, relatórios, tentativas e operação auditada do corte |

No celular e tablet, a barra inferior oferece Início, Álbuns, Top 50, Playoffs e Mais. O diálogo Mais reúne Estatísticas, Histórico de versões, Sincronização e Sair. Permite fechar pelo botão, Escape e toque fora; mantém o foco dentro do menu e o devolve ao acionador. O fundo fica sem rolagem enquanto o menu está aberto. A barra e o conteúdo reservam espaço para a área segura inferior. No desktop, todas as páginas ficam na lateral.

A busca do catálogo usa `q`, a nota mínima usa `nota` e a quantidade exibida usa `limite`. Esses parâmetros acompanham o link da avaliação e o retorno para a lista, inclusive pelo botão Voltar do navegador. A identidade de leitura `albumId` vem do UUID existente no banco; não altera a identidade de importação nem requer migração. As avaliações são procuradas exclusivamente na fonte configurada, após autenticação; IDs inválidos ou de outra fonte retornam 404. Registros ausentes preservam a última avaliação conhecida.

A exceção de prévia local privada em desenvolvimento permanece apenas no início, no loopback. As demais rotas exigem proprietário antes de qualquer leitura. Acesso e endpoints de autenticação permanecem iguais.

Visitar as páginas não inicia sincronização nem prévia do corte. Na Sincronização, as ações são explícitas e mantêm as confirmações e justificativas existentes. Após importar, o aplicativo atualiza a publicação exibida; os cálculos continuam sendo os mesmos.

## Backlog temporariamente oculto

O backlog foi retirado de menus, início e histórico, incluindo contagens, filtros e resultados de busca. Avisos não bloqueantes específicos do backlog ficam ocultos. Erros que impedem a importação continuam disponíveis no relatório de Sincronização. Parsing, armazenamento, comparações e dados antigos permanecem preservados para uma solução futura.

## Links anteriores

`/#acervo`, `/#top-50`, `/#chaveamento` e `/#historico-competitivo` redirecionam para as páginas correspondentes. `/#backlog` retorna ao início e `/#visao-geral` continua no início. Estatísticas e Histórico mantêm suas URLs.

## Verificações

`npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration` e `npm run test:e2e` verificam código, regras, isolamento da fonte, persistência e acesso HTTP. `npm run test:layout` usa o Vite já instalado pelo Vitest e Chromium local (`CHROMIUM_PATH` pode selecionar outro executável) para renderizar os componentes reais com dados sintéticos e um adaptador de navegação exclusivo de teste. Não cria rotas ou exceções de autenticação na aplicação.

O ensaio de interface cobre nove telas em 360, 390, 768 e 1280 px, ausência de overflow, acesso ao menu, Tab/Escape, foco, fechamento, links, filtros/retorno, sincronização, confirmação auditada e hashes antigos. Não substitui a conferência autenticada no Railway com a fonte pessoal, que permanece pendente para este novo layout.
