# Verificação pelo celular com GitHub Actions

O GitHub Actions executa os comandos numa máquina temporária do GitHub.
O workflow `Verify`, em `.github/workflows/ci.yml`, verifica cada pull request,
cada atualização de `main` e também aceita execução manual depois de estar em
`main`. Não faz deploy e não usa credenciais da aplicação.

## Acompanhar uma execução

1. Abra o pull request no GitHub pelo navegador do celular.
2. Na área de verificações, toque em **Details**. Também é possível abrir a aba
   **Actions** do repositório e selecionar a execução mais recente de **Verify**.
3. Há dois trabalhos independentes: **verify** (lint, tipos, testes unitários,
   integração, build de produção e testes de acesso) e **Layout e capturas**.
4. Verde significa que o trabalho passou. Vermelho permite abrir a etapa com
   falha e consultar seu log; isso não publica nem modifica a aplicação.

O build usa a configuração original do projeto. Os testes de integração usam um
Postgres descartável. Os testes de layout usam os componentes reais, o mesmo
cabeçalho da rota de álbuns, dados fictícios e respostas simuladas de API e capas.
Eles não consultam o acervo nem alteram dados reais.

## Capturas e diagnóstico

Na página da execução, abaixo dos trabalhos, a área **Artifacts** oferece
`layout-capturas-<número da execução>` por sete dias. O ZIP contém:

- Catálogo e revisão de capas em 360, 390, 768 e 1280 px.
- Uma imagem da página inteira e outra da primeira tela em cada largura.
- `failure.png`, quando o navegador chega a abrir e um teste falha.
- `trace.zip`, com o diagnóstico do Playwright para inspeção local.

Um teste verde comprova as verificações automáticas, mas as capturas ainda
precisam ser conferidas visualmente. O ZIP pode ser baixado pelo celular e
anexado à conversa se o conector não conseguir disponibilizá-lo diretamente.
As mesmas imagens PNG também são exportadas em blocos identificados e codificados
no log da etapa **Disponibilizar capturas para revisão pelo conector**. Isso
permite que o assistente reconstrua as imagens pelos logs quando o conector só
oferece um link para o ZIP. Somente capturas do cenário sintético são exportadas;
o trace permanece exclusivamente no artefato.

## Rodar novamente

Uma atualização no pull request inicia os testes automaticamente. Para repetir
o mesmo código, abra a execução e use **Re-run all jobs**; para uma falha isolada,
use **Re-run failed jobs**. Não é necessário fazer merge para testar a branch.

## Executar os mesmos comandos em outro ambiente

```sh
npm ci
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run build
npx playwright test
npx playwright install --with-deps chromium
npm run test:layout
```

Para validar as permissões reais do Postgres, `test:integration` requer
`DATABASE_TEST_URL` apontando exclusivamente para um banco de testes.
As capturas ficam em `test-results/layout/`, ignorada pelo Git. É possível
alterar esse destino com `LAYOUT_ARTIFACT_DIR` e escolher um navegador instalado
com `CHROMIUM_PATH`; sem essa variável, o teste prefere o Chromium instalado
pelo Playwright e aceita `/usr/bin/chromium` como alternativa.
