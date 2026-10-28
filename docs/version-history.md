# Histórico de versões

Página privada em `/historico`, acessível por **Histórico de versões** na navegação principal. Mostra alterações em álbuns e resultados dos Playoffs; o histórico das fases competitivas continua separado.

## Publicações e comparação

A página abre na publicação atual e compara cada versão com a anterior importada disponível no banco. Não baixa arquivos antigos do Drive nem presume versões intermediárias que nunca foram importadas. A lista usa ordem numérica, vinte publicações por página. Arquivo e horários de importação/modificação são apresentados separadamente; nenhum horário é tratado como data de escuta ou de partida.

Uma publicação é comprovada por execução `succeeded`/`unchanged` associada à versão ou pelo ponteiro atual. Versões falhas e versões posteriores ao ponteiro atual não são expostas. O horário mostrado é o da primeira execução bem-sucedida; quando não registrado, fica explicitamente indisponível, sem usar o horário do arquivo como substituto.

A primeira publicação disponível é um ponto inicial: mostra a quantidade de registros preservados, sem inventar adições ou declarar que nada mudou antes dela. Quando uma extração antiga não existe ou não corresponde às contagens conhecidas da importação, o bloco fica **indisponível para comparação**, sem transformar essa falta de evidência em uma lista vazia ou em ausências.

## Registros e mudanças

- Álbuns usam a identidade estável armazenada. Artista, título, gênero, país, fonte, notas registradas e campos competitivos podem ser comparados. Não inferir renomeações nem alterar avaliações originais.
- O modelo preservado de backlog (temporariamente oculto na interface) usa artista creditado e título, com NFC e espaços externos removidos. Ordem, prioridade e referência são campos alteráveis, não identidade. Duplicidades são sinalizadas e a associação afetada fica pendente.
- Playoffs usam fase/jogo; a primeira rodada usa o par de seeds para compatibilidade com os registros legados. Resultado, vencedor, critério e participantes são comparados literalmente. Mudanças apenas de linha, aba de origem, ID adicionado ao formato legado ou parser não viram alterações de resultado.
- Registros novos são **adicionados**; os que deixam de aparecer ficam **ausentes nesta versão**, sem afirmar exclusão definitiva ou cancelamento. Se uma identidade ausente retorna e há evidência anterior, aparece como **reaparecida**.
- Para reaparecimentos, a página informa a publicação em que o registro estava ausente e sua última evidência anterior. O antes/depois usa essa última evidência, identificando sua versão, mesmo quando os valores continuam iguais.

Os valores são os registrados nos snapshots, sem recalcular rankings antigos pelas regras atuais. Ausência de campo, nulo e texto vazio são equivalentes na comparação; zero é um valor. Número da linha e localização da célula aparecem como proveniência, mas não geram mudanças por si só. Reprocessamento de uma extração não cria uma nova publicação do XLSX.

## Exploração

Há contagens globais por bloco e tipo de mudança; expandir um item mostra os campos antes/depois. A busca encontra artista, álbum, jogo ou conteúdo dos campos. Filtros de bloco e tipo restringem a lista.

**Incluir posições e índices** começa ligado. Desligá-lo oculta ranking anual informado e campos derivados do Top 50 (fase, bônus, índice e posição). Alterações exclusivamente derivadas saem da lista; alterações mistas continuam mostrando os campos de conteúdo. As contagens totais permanecem identificadas, separadas da quantidade filtrada. A lista renderiza cinquenta mudanças por vez, com expansão progressiva.

Versão inválida ou indisponível abre a atual com aviso; página inválida retorna à primeira página da lista. Erro de consulta, ausência de publicações, ponto inicial, bloco indisponível e comparação sem mudanças têm estados distintos. Resumo, Gráficos, Notas e diferenças de formatação/fórmulas célula a célula não fazem parte desta entrega.

## Dados, acesso e validação

O servidor autoriza o proprietário antes de consultar o banco, também em desenvolvimento. A fonte vem da configuração do servidor; a URL aceita apenas versão e página. Não há endpoint público, escrita no Drive, migração ou nova credencial. A leitura usa o papel existente `oraculo_reader` e uma transação `REPEATABLE READ READ ONLY`, mantendo lista, contagens e snapshots consistentes durante uma sincronização concorrente.

As consultas carregam os dois snapshots selecionados e buscam apenas a última evidência anterior das identidades candidatas a reaparecimento. A extração de resultados escolhida é a mesma do catálogo: versão compatível anterior até o reprocessamento atual, depois a nova extração inteira, inclusive vazia. Isso evita ressuscitar resultados antigos ou contar duplicidades de parser.

Testes cobrem adição, alteração, ausência, reaparecimento, identidade ambígua, campos derivados, metadados ignorados, ponto inicial, extração indisponível, isolamento de fontes, limites de versões, paginação e autorização antes da leitura. A integração executa as consultas reais em PGlite com as migrações existentes, inclusive usando o papel leitor. Na comparação local dos XLSX v99 e v100, foram encontrados 37 álbuns com mudanças somente em campos derivados; não houve novos álbuns, alterações factuais, mudanças de backlog ou resultados.

O usuário confirmou a página anterior no Railway. O novo layout compartilhado precisa ser conferido após o deploy, com as publicações efetivamente disponíveis no banco. Essa conferência é distinta da comparação local dos arquivos anexados.

A ocultação temporária do backlog também vale para blocos, contagens, filtros e busca do histórico. O comparador e os snapshots continuam preservados para uso futuro. Consulte [navigation.md](navigation.md).
