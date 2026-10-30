# Auditoria Hallmark da página de álbuns

Página: `/albuns`. Escopo: tela de aplicação, com refatoração da composição
interna e preservação da identidade verde escura e cobre do Oráculo Musical.
Skill: `.agents/skills/hallmark/SKILL.md`, versão 2.0.0.

## Diagnóstico por código

| Achado | Efeito | Alteração |
| --- | --- | --- |
| Busca, revisão de capas e ranking em três cartões grandes | Controles administrativos antecediam o conteúdo principal com muito peso | Busca e notas na mesma barra; revisão de capas em faixa compacta; ranking sem moldura externa |
| Capas de 44–56 px e metadados com pouca separação | Identificação do álbum e leitura da nota disputavam espaço | Capas de 80 px no desktop e 48 px no celular; colunas de posição, identidade e nota |
| CSS do catálogo compartilhado com outras telas | Mudanças visuais podiam afetar Início e Sincronização | CSS exclusivo e tokens de catálogo derivados da marca existente |
| `ORIGINAL` em maiúsculas e seta decorativa no atalho de capa | Ruído na tipografia dos dados | Caixa normal e rótulo direto |
| Foco dependente do shell global | Estilo isolado não definia seus próprios estados de teclado | Foco visível local, alvos de 44–48 px e estados de interação explícitos |

O ranking por nota original, as capas reais com atribuição e os filtros em URL
já eram adequados e foram preservados. Não foram acrescentadas métricas,
depoimentos, imagens ilustrativas ou dados de acervo.

## Refatoração

- Busca, limites de notas e situações de capa mantêm seus rótulos, ações e
  parâmetros `q`, `nota`, `limite` e `capas`.
- Links de avaliação mantêm o contexto de filtros; "Mostrar mais álbuns"
  mantém o incremento de quinze registros e a contagem restante.
- Empates, avaliações ausentes, estados vazios e nota original conservam seus
  critérios; nenhuma regra competitiva foi modificada.
- A atribuição Apple Music/iTunes continua um link próprio fora do link da avaliação.
- O cabeçalho do catálogo usa uma classe opcional do shell. Outras rotas
  mantêm o cabeçalho anterior.
- Os filtros empilham abaixo de 760 px; abaixo de 520 px a grade reduz capa,
  posição e nota e permite quebra integral dos nomes.

Mudanças de texto: `ORIGINAL` → `Original`; a seta de "Buscar ou corrigir capa"
foi retirada; contagem e aviso de empates agora ocupam elementos separados;
a ausência de um álbum aparece separada do país. O rótulo repetido de temporada
foi ocultado somente no cabeçalho desta página; a temporada permanece no shell.

## Verificação e limites

O `sloplint` estático verifica o componente e os dois novos arquivos CSS,
com `--scope app --genre atmospheric --kept`. O inventário anterior registra
dois links e cinco handlers; ambos devem continuar integralmente preservados.
Os resultados completos ficam em `.hallmark/`, ignorada pelo Git.

Resultado final estático: **0 FAIL, 0 REFLEX e 0 WARN**, com dois links e cinco
handlers preservados. Isso não representa aprovação de renderização no navegador.

A medição anterior incluiu `workspace.module.css`, que também contém regras de
outras telas. Seus totais não são uma comparação isolada da página de álbuns.

Lint, TypeScript e os 213 testes unitários passaram após a refatoração.
A revisão independente por código não encontrou bloqueios de comportamento,
teclado ou contraste dos novos controles.

O build padrão com Turbopack não concluiu neste ambiente e foi encerrado. A
alternativa `npm run build -- --webpack` falhou com `Could not parse output from
TypeScript's --showConfig`. Executar `tsc --showConfig` diretamente produziu JSON
válido, com 135 arquivos. Na reprodução isolada da chamada feita pelo Next, o
subprocesso terminou sem fornecer conteúdo em stdout; interpretar a saída vazia
como JSON causa a mensagem acima. Um subprocesso mínimo de Node com captura por
pipe também apresentou `EPERM`; a mesma execução com saída em arquivo funcionou.

Uma cópia limpa do commit anterior à refatoração, `d3f3518`, apresentou exatamente
a mesma falha no build com webpack. Portanto, essa falha reproduzida neste ambiente
não foi introduzida pelas alterações visuais. Não há evidência suficiente para
afirmar se as permissões de execuções anteriores eram diferentes.

**Compilação adicional concluída:** uma cópia temporária do código atual passou
pelo build completo com webpack, checagem TypeScript e geração das rotas, usando
as opções documentadas `experimental.useTypeScriptCli: false`, `workerThreads:
true`, `webpackBuildWorker: false` e `cpus: 1`. Essa execução usa a API JavaScript
do compilador e threads, sem desativar a verificação de tipos. Essas opções foram
aplicadas somente à cópia de diagnóstico; `next.config.ts`, dependências e scripts
do projeto foram preservados. O build na configuração original permanece sem
validação, apesar do sucesso dessa compilação alternativa.

Não houve aceite visual no navegador: Chromium foi tentado por Playwright e
pela linha de comando e foi bloqueado pelo sandbox (`setsockopt: Operation not
permitted`). Desativar o coletor de falhas apenas expôs outro bloqueio de socket:
`shutdown: Operation not permitted`. O renderizador do Hallmark também depende de `puppeteer-core`,
ausente neste ambiente. Não há screenshots antes/depois nem aprovação de
responsividade renderizada. A revisão visual deve ser concluída num ambiente
com navegador funcional, inclusive em 360, 390, 768 e 1280 px.

## Continuação em GitHub Actions

O pacote foi restaurado sobre a base exata `d3f3518`, com árvore inicialmente
limpa e `git apply --check` aprovado. Lint, TypeScript e os 213 testes unitários
passaram novamente. O inventário estático foi refeito a partir do componente
original em `HEAD`: **0 FAIL, 0 REFLEX, 0 WARN**, links **2/2** e handlers **5/5**.

O teste de layout voltou a falhar antes do navegador com `listen EPERM:
operation not permitted 127.0.0.1:3216`. O build padrão iniciou a compilação,
sem conclusão confirmada no sandbox. As solicitações de permissão adicional
foram interrompidas antes da execução; não comprovaram se a permissão bastaria.

A branch `codex/hallmark-albuns-ci` prepara a execução no GitHub Actions:
build com a configuração original e testes de layout com Chromium instalado
pelo Playwright. As capturas e o trace são guardados como artefatos por sete
dias, inclusive quando o teste falha. As asserções anteriores foram preservadas.
A fixture de álbuns agora também aplica a descrição e a classe de cabeçalho da
rota real, para que as capturas representem a refatoração completa.

Na primeira execução remota, [Verify #26](https://github.com/mauricioforteneto/oraculo-musical/actions/runs/41043565767),
passaram lint, TypeScript, 213 testes unitários, 37 testes de integração,
o **build padrão com Turbopack e configuração original** e 15 testes de acesso.
O coletor de imagens tinha uma espera sem limite por `decode()` de capas lazy
fora da tela; a preparação de captura foi ajustada para solicitar essas imagens
e aguardar sua conclusão por no máximo dez segundos, preservando as asserções.
Na execução seguinte, [Verify #27](https://github.com/mauricioforteneto/oraculo-musical/actions/runs/41044153581),
passaram novamente o trabalho `verify` completo e o comando `npm run test:layout`.
A revisão visual das capturas estava pendente. Uma exportação das imagens PNG
no log do trabalho de layout permite obtê-las pelo conector, que disponibiliza o
ZIP apenas como link de download; o artefato com PNGs e trace foi preservado.
O fluxo pelo celular está em [github-actions.md](github-actions.md).

### Revisão visual independente

A execução [Verify #28](https://github.com/mauricioforteneto/oraculo-musical/actions/runs/41044547639)
passou os dois trabalhos e disponibilizou 16 PNGs do catálogo e da revisão de
capas, em página inteira e viewport, nas quatro larguras. As imagens originais
foram reconstruídas dos logs do GitHub sem edição visual.

A revisão independente Hallmark retornou `fix`: **um achado de acabamento,
nenhum Floor identificado e nenhuma lacuna relevante**. Em 360 e 390 px,
os rótulos “Posição” e “Álbum” encostavam porque a primeira coluna do cabeçalho
tinha 32 px. A correção reserva 44 px, preserva ambos os textos e acrescenta ao
teste uma medição da separação entre os rótulos nas quatro larguras.

Busca, filtros, títulos extensos, notas, atribuição, paginação e rodapé foram
considerados legíveis nas 16 capturas. A barra inferior fixa pertence ao shell
preservado. Não foi identificada perda de ação ou informação comparando o código
anterior; a ausência de capturas anteriores impede uma comparação visual direta.
Os cenários capturados são catálogo cheio e revisão filtrada; carregamento,
erro e vazio não receberam aceite visual por essas imagens.

**Achado resolvido:** a execução [Verify #29](https://github.com/mauricioforteneto/oraculo-musical/actions/runs/41045260635)
passou os dois trabalhos, incluindo a nova medição dos rótulos nas quatro
larguras. As novas capturas em 360 e 390 px confirmaram a separação visual.
Pontuação da revisão: **finish-review: subagent · 1 achado · 1 resolvido · gap:
none**. O achado era de acabamento, sem Floor identificado.

Resultado da entrega: build padrão na configuração original aprovado, lint e
TypeScript aprovados, **213 unitários + 37 de integração + 15 de acesso** aprovados,
layout e comportamento aprovados em **11 telas × 4 larguras**, e revisão visual
do catálogo e da revisão de capas concluída dentro dos limites registrados acima.
Auditoria estática final: **0 FAIL, 0 REFLEX, 0 WARN**, links **2/2** e handlers
**5/5** preservados. A branch e o [PR #1 em rascunho](https://github.com/mauricioforteneto/oraculo-musical/pull/1)
guardam as alterações; não houve merge nem publicação do aplicativo.
