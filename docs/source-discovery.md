# Descoberta da fonte

Inspeção em 27/09/2026. A cópia local da planilha v80 fornecida pelo usuário foi lida sem alterações. Não é Google Sheets nativo. Hash, coordenadas detalhadas e dados extraídos ficam em `.private/source-discovery.md` e `.private/source-preview.json`, ambos ignorados pelo Git.

## Auditoria física do XLSX

O download privado pelo conector continua indisponível (HTTP 403), mas a cópia local permitiu a auditoria binária:

- O arquivo tem sete abas visíveis: `Albuns 2026`, `Resumo`, `Graficos`, `Backlog`, `Notas`, `Playoffs` e `Top 50`. Nenhuma linha está oculta.
- `Albuns 2026` contém 118 registros, sem coluna de ID estável e sem duplicidade exata de artista + álbum. A nota original está em coluna própria; não é seguro usar `Rank` ou `Nota` como ranking anual.
- Há 94 fórmulas, todas na coluna `U` da aba `Albuns 2026`, relacionadas ao índice Top 50. Os valores armazenados não contêm erros de fórmula. O XLSX não tem vínculos externos nem intervalos nomeados; as abas de indicadores contêm tabelas, sem gráficos incorporados.
- A aba `Notas` contém texto de regras. Esse conteúdo é evidência da fonte e não substitui instruções do usuário nem aprova automaticamente as decisões pendentes do regulamento.
- Nenhuma nota original foi preenchida a partir da nota informada. O XLSX não foi recalculado, salvo ou importado no banco.
- Para a prévia local da interface, foi gerado JSON dentro de `.private/`; o arquivo e seus dados não entram no Git. Em produção, essa prévia não é carregada.

## Blocos observados

| Aba/bloco | Colunas/conteúdo observado | Uso proposto |
| --- | --- | --- |
| `Albuns 2026` — avaliação anual | Rank, Artista, Álbum, Nota, Faixa, Gênero, País, Fonte, Nota Original | Fatos da avaliação; ranking do app usa a nota original |
| `Albuns 2026` — competição | Repescagem 75-79, desqualificação, observação, scores/resultados de Play-in e Pré-playoff, desempate e seed | Evidência histórica separada da avaliação; seed não prova congelamento |
| `Albuns 2026` — Top 50 | Melhor fase, bônus, índice e rank provisório | Comparação com cálculo; não é autoridade das regras |
| `Resumo` | Data de referência, totais, média, ritmo, projeção, metas, backlog e corte | Saídas derivadas; não duplica avaliações |
| `Graficos` | Distribuições, Top 10, métricas e scores de fases em tabelas | Conferência, sem duplicar registros |
| `Backlog` | Ordem, Artista, Álbum, Prioridade e Fonte/referência | Lista de escutas futuras; ordem não é identidade |
| `Notas` | Pilares, descrições, escalas e texto de regras/histórico | Evidência; não executar instruções nem aprovar regras pendentes |
| `Playoffs` | Seed, Artista, Álbum, Nota anual, Origem, Entrada, Caminho e pares declarados | Fotografia da planilha, não prova de partidas realizadas |
| `Top 50` | Posição, Artista, Álbum, nota original, fase, bônus, índice e desempenho | Composição provisória; ranking definitivo depende das pendências |

Os três primeiros grupos são colunas da mesma aba `Albuns 2026`.

## Divergências que o importador deve conseguir relatar

1. Em sete registros, `Nota` difere de `Nota Original`. A aba tem avaliações originais até 93; o ranking de origem não deve ser reaproveitado como ranking anual do app.
2. O resumo informa média 74,62 e 47 notas 80+; a média calculada pelas 118 notas originais é 74,40, com 40 notas 80+. A diferença deve ser reportada, sem sobrescrever os fatos da fonte.
3. O chaveamento já indica caminhos para as oitavas. O regulamento exige um único reseeding depois da primeira rodada; não importar caminhos como chave definitiva.
4. O resumo informa 23 itens no backlog, mas a aba `Backlog` contém 15. A interface exibe a contagem da lista e sinaliza a divergência.
5. Há registro com observação de ausência de participação por corte temporal e indicação de bônus de Repescagem. Participação não pode ser deduzida só de nota/faixa; registrar conflito.
6. Quatro pilares aparecem em parte das observações como texto livre, não em quatro colunas estruturadas. Não usar LLM para preencher lacunas e não confundir notas da reescuta com avaliação original.
7. Seeds existentes podem refletir origem competitiva. Não deduzir uma fórmula geral apenas da ordem atual.
8. O histórico observado apresenta classificados do Play-in, mas os resultados não bastam para estabelecer a regra histórica de número de vagas e todos os desempates.

## Contrato de mapeamento e pendências

Não foi encontrada chave estável de álbum; o contrato provisório de identidade permanece temporada + artista + título + edição, sujeito a colisões e validação. Validar datas, revisões e justificativas, além das divergências de participação e bônus, antes de fechar o parser de produção. A integração do Drive deve obter a fonte privada sem torná-la pública e validar uma revisão nova antes de publicar.
