# Especificação do produto

Status: especificação do MVP revisada em 28/09/2026. Decisões técnicas adotadas e regras competitivas ainda pendentes estão em [decisions.md](decisions.md). O mapeamento inicial foi conferido na cópia local v80; parser de produção, publicação no banco e acesso privado pelo backend ainda não foram validados em conjunto.

## Objetivo e limites

Oferecer a um único usuário uma visão privada de sua escuta anual. A planilha é a origem dos registros; o [regulamento 2026](campeonato/regras-2026.md) é a origem das regras. O banco guarda registros normalizados, proveniência, histórico e resultados calculados. O app não gera novas versões da planilha e não oferece CRUD de avaliações, regras, backlog ou resultados.

No MVP: autenticação pessoal, ranking anual, detalhe da avaliação, sincronização manual e relatório de importação. Depois: Top 50, histórico competitivo, chave, backlog/reescutas e Last.fm. Mixtapes e análises de gosto ficam futuras. Chatbot, escrita no Drive, sincronização bidirecional, Actions/MCP públicos e agendamento ficam fora do MVP.

## Jornada de consulta

1. Entrar com a conta previamente cadastrada. Sem cadastro público.
2. Ver ranking anual pela nota original /100, buscar artista/álbum e abrir detalhes.
3. Consultar nota original, pilares disponíveis, revisão separada, estado competitivo e proveniência. Ausência de dado aparece como “não informado”, nunca zero.
4. Acionar Sincronizar. Durante a leitura, manter o último ranking válido na tela.
5. Receber resultado com versão, horário, contagens de novos/alterados/inalterados/ausentes e alertas. Falha informa a causa sem apagar dados anteriores.

A tela deve distinguir “última tentativa” de “última sincronização bem-sucedida”. Antes da primeira importação, mostrar estado vazio real; nenhum dado de demonstração deve parecer pessoal. Erros de banco podem tornar a consulta indisponível: preservar dados não significa garantir leitura durante indisponibilidade do banco.

Interface em português, datas em America/Sao_Paulo; instantes armazenados em UTC. Layout utilizável em 360 px, controles acessíveis por teclado, rótulos claros e mensagens de carregamento/erro anunciadas por tecnologia assistiva. Nenhuma nota editável nas telas.

## Ranking anual

Ordenar por nota original decrescente. Nunca usar `Nota` promovida, seed, índice Top 50 ou score competitivo como nota anual. Comparar o resultado com o rank informado na fonte e reportar diferenças.

Empates de nota recebem a mesma posição por competição (exemplo fictício: 90, 90, 88 → 1, 1, 3). Ordenação alfabética de artista/álbum dentro do grupo serve somente à apresentação e não desempata competição. Ranking anual residual para o Top 50 permanece bloqueado até decisão P07. Nenhum seed é calculado usando esse fallback.

Registros com total original válido e sem todos os pilares podem entrar no ranking, marcados como avaliação incompleta. Não distribuir o total artificialmente entre os pilares. Quando os quatro pilares estiverem presentes, validar limites e soma; para registros sem o conjunto completo, manter os valores ausentes como nulos e sinalizar que a soma não foi validada.

## Publicação da importação

Uma importação é preparada e validada antes da transação de publicação. Erros estruturais, identidade ambígua, total inválido ou alteração de nota original sem justificativa impedem a publicação do lote inteiro. Não misturar linhas da nova versão com linhas antigas após erro de validação.

Divergências em resultados derivados não invalidam fatos básicos válidos. Preservar o valor informado na fonte, calcular somente regras confirmadas e marcar os cálculos afetados por pendências como indisponíveis. Resultados competitivos históricos são importados como fatos, sem simular fases encerradas. Datas do calendário não provam realização de partidas.

Linhas ausentes são mantidas e sinalizadas. Exclusão, fusão de álbuns e correção de identidade não têm fluxo automático no MVP; devem ser esclarecidas na fonte e, se necessário, em manutenção técnica posterior explicitamente autorizada.

## Sucesso da primeira entrega funcional

Uma avaliação válida publicada em nova versão do Excel é encontrada pelo botão, persistida uma única vez e aparece na posição correta do ranking anual. Repetir a sincronização não duplica a avaliação. Fonte inacessível ou inválida mantém a versão anterior. Usuário não autorizado não consulta dados nem inicia sincronização.

Integração real exige ensaio com as credenciais do backend e persistência real; mocks validam comportamento isolado, não comprovam acesso ao Drive ou ao banco hospedado.
