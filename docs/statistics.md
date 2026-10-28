# Estatísticas do acervo

Página privada em `/estatisticas`, acessível pelo link **Estatísticas** na navegação principal. Usa somente o catálogo já publicado e o acesso do proprietário existente. Não exige novas credenciais, alterações na planilha ou migração de banco.

## Recorte e cálculos

- Considerar apenas registros com `isPresent !== false`. Registros ausentes ficam preservados no histórico, sem entrar nas estatísticas da publicação atual. Esse recorte não altera o ranking anual nem o Top 50.
- Mostrar total de álbuns, quantidade de notas originais disponíveis, média original e números de gêneros, países e artistas informados.
- Médias usam exclusivamente notas originais válidas; zero conta como nota. Sem notas disponíveis, mostrar ausência de média, sem fabricar zero. Promoção 80*, nota informada e índice Top 50 não entram nesse cálculo.
- Separar gêneros por `/`. Cada álbum conta uma vez em cada gênero, mesmo que a categoria se repita com caixa ou espaços diferentes. Os percentuais usam o total de álbuns presentes e podem somar mais de 100%.
- Gêneros e países usam NFC, espaços normalizados e agrupamento sem distinguir caixa. Não fundir sinônimos, traduzir rótulos ou agrupar países: Inglaterra, Escócia e Irlanda do Norte permanecem separados.
- Créditos de artistas usam NFC e remoção apenas de espaços externos. Não separar colaborações por `&` nem fundir nomes semelhantes ou com caixa diferente.
- Campos vazios aparecem em **Não informado**, com contagem e percentual próprios. Esse grupo não aumenta o total de categorias informadas.

O agregador puro `buildCatalogStatistics` retorna totais, álbuns ordenados por nota original e grupos com chave, rótulo, contagem, percentual, número de notas, média e chaves dos álbuns associados. `albumsForStatisticsGroup` obtém a lista por pertencimento exato, sem busca por substring.

## Exploração

A página abre em Gêneros e permite alternar para Países e Artistas. Gêneros e países usam barras horizontais por contagem; artistas usam lista. A ordem é quantidade decrescente e nome nos empates. Mostrar os dez primeiros grupos, com opção de expandir todos e recolher novamente.

Selecionar um grupo mostra seus discos na própria página, por nota original decrescente, com notas ausentes ao final. A seleção não altera o resumo geral. Trocar de dimensão ou usar **Limpar seleção** limpa o recorte. A página mostra versão da fonte e caminho de volta ao acervo; a sincronização fica em `/sincronizacao`. Cada disco listado oferece um link para sua avaliação completa.

Quando todos os artistas têm um álbum, a página informa que a média descreve esse disco e não representa preferência recorrente. Não há ranking por gosto, evolução mensal, inferência de data de escuta ou integração com Last.fm nesta entrega.

## Acesso e validação

O servidor executa `requireOwner` antes de consultar o catálogo. A página exige autenticação também em desenvolvimento; não há prévia pública nem exceção de acesso para testes. Falhas na leitura mostram indisponibilidade, sem detalhes internos e sem apresentar o catálogo como vazio. Uma fonte sem álbuns presentes tem um estado vazio distinto.

Validação: testes unitários de agregação, apresentação e autorização antes da leitura; integração existente; build e E2E HTTP incluindo redirecionamento para login e cache privado. O componente foi exercitado em Chromium a 360 px com dados fictícios, cobrindo seleção, limpeza, dimensões, teclado, expansão, estados de erro/vazio e ausência de rolagem horizontal. Na v100 fornecida pelo proprietário, a conferência local encontrou 126 álbuns, 20 países e 126 artistas; contagens e listas de todos os grupos coincidiram. Essa conferência não acessou o banco hospedado.

Após o deploy, entrar como proprietário e abrir **Estatísticas** para conferir a publicação efetivamente disponível no Railway. A página anterior foi confirmada pelo usuário; a conferência do novo layout compartilhado no ambiente hospedado permanece pendente.
