# Desempates manuais do Top 50

O parser `2026.4` lê decisões da aba opcional `Desempates Top 50`. O aplicativo valida e aplica decisões confirmadas depois de esgotar os critérios automáticos da regra `2026-top50-2`. A ordem manual resolve apenas o grupo empatado: não muda notas, bônus, fases, seeds, elegibilidade ou resultados.

## Contrato do XLSX

Uma linha por álbum do grupo completo, incluindo quem ficará fora das vagas. Os cabeçalhos abaixo são obrigatórios; a ordem das colunas é livre. Datas podem ser células de data do Excel ou texto `AAAA-MM-DD`. Os valores numéricos devem ser células numéricas.

| Cabeçalho | Conteúdo |
| --- | --- |
| Decisão | Identificador comum a todas as linhas da mesma decisão |
| Temporada | `2026` |
| Regra | `2026-top50-2` |
| Artista | Identidade exata de `Albuns 2026` |
| Álbum | Título exato de `Albuns 2026` |
| Nota original | Nota original usada no empate |
| Melhor fase | Fase calculada, por exemplo `Repescagem` |
| Desempenho da fase | Etapa `1` ou `2` na Repescagem; score no Play-in/Pré-playoff; `0` sem fase |
| Índice | Índice calculado do empate |
| Ordem no grupo | Todos os inteiros de `1` a `N`, sem repetição, após confirmação |
| Status | `Pendente` ou `Confirmada` |
| Confirmado por | Autor real da confirmação |
| Confirmado em | Data real da confirmação, em `AAAA-MM-DD` |
| Referência da confirmação | Referência real à decisão explícita do proprietário |

Status e metadados de confirmação devem ser iguais em todas as linhas da decisão. Sem confirmação real, ordem e campos de confirmação ficam vazios e o status permanece `Pendente`. A ordem visual da tabela não desempata. Observações e posições derivadas nunca substituem essa tabela.

O contexto do trio da v104 é: nota original `78`, fase `Repescagem`, desempenho `2`, índice `79`. A ordem registrada no histórico só deve ser transcrita como `Confirmada` com a confirmação real, seu autor, data e referência; não preencher esses campos por inferência. Esta documentação não confirma uma decisão pessoal.

## Validação e cálculo

O grupo deve corresponder exatamente ao grupo atualmente empatado pelos critérios automáticos. Uma decisão incompleta, com identidade desconhecida/duplicada, ordem inválida, contexto alterado, confirmação ausente ou data impossível não é aplicada e gera pendência específica. Duas decisões confirmadas aplicáveis ao mesmo grupo são conflitantes; nenhuma é escolhida silenciosamente.

Se o grupo ou os fatos do empate mudarem, a decisão exige revisão. Se apenas outros álbuns passarem à frente, a preferência relativa permanece válida e as posições absolutas são recalculadas. Uma decisão não fixa permanentemente alguém em 49º ou 50º. Sem decisão aplicável, o grupo no corte continua sem posição; empates internos não resolvidos mantêm posições compartilhadas.

Um cabeçalho incompatível gera aviso de importação e impede a aplicação da tabela, preservando a importação dos demais dados válidos. Linhas inválidas são preservadas na extração para impedir aplicação parcial de um grupo. A central mostra o identificador da decisão, os álbuns, o motivo e a versão/aba/linha da fonte. O Top 50 mostra as decisões aplicadas, a ordem e os dados de confirmação.

## Publicação e implantação

Aplicar `0008_top50_manual_decisions.sql` com o fluxo administrativo de migrações antes da sincronização com o novo código. A tabela é somente leitura para `oraculo_reader` e permite apenas inserção ao sincronizador; versões antigas permanecem preservadas. O backup do schema `oraculo` inclui a nova tabela.

A extração é vinculada à versão publicada e à revisão do parser de decisões. Tanto uma nova publicação quanto uma sincronização `unchanged` gravam a extração na mesma transação do relatório de sucesso. Reprocessar a mesma versão é idempotente. Ausência da tabela no XLSX significa extração vazia: não recuperar decisões de uma versão anterior. Uma tentativa recusada não substitui decisões da publicação ativa, e outra fonte não pode fornecê-las.

O catálogo continua disponível antes da migração, com aviso de indisponibilidade do suporte na central. O formato dos resultados dos Playoffs permanece `2026.3`, independente do parser global `2026.4`, para preservar resultados já publicados sem exigir reimportação.

Após implantar, sincronizar um XLSX com a tabela preenchida e conferir as decisões aplicadas e as pendências. A v104 sem a tabela continua aceita e continua apresentando o empate: texto histórico não é convertido automaticamente em decisão.
