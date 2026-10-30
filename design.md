# Oráculo Musical — sistema editorial

Direção A, Revista musical, escolhida pelo usuário. Vale para os componentes
reais; o modo escuro mantém a mesma composição, fontes e vermelho.

## Fonte de verdade

- Tokens: `src/app/theme.tokens.css`; aliases do catálogo: `catalog.tokens.css`.
- CSS de cada tela consome os nomes semânticos, inclusive Tailwind.
- Temas: claro, escuro e seguir o sistema. Sem preferência salva, segue o SO.
- `data-mode` representa o modo resolvido, `data-theme-preference` a escolha.
- Preferência local ao navegador, chave `oraculo-theme`; sincroniza abas.
- Inicialização antes do corpo; CSS segue o SO mesmo sem JavaScript.

## Material

- Papel claro quente, tinta quase preta, um vermelho de ação.
- Escuro: papel 15%, cartões 18%, terceiro nível 21% em OKLCH.
- Matizes mantidos entre modos; vermelho escuro 64% / .14 / 29 para contraste.
- Títulos Bricolage Grotesque, peso 800, largura 75; texto Source Serif 4.
- Controles, navegação e legendas em Bricolage, sem capitais espaçadas.
- Fontes variáveis auto-hospedadas por `next/font`, sem consulta ao Google
  pelo navegador em produção. O harness de teste carrega as mesmas famílias.
- Peso de leitura 400 no claro e 350 no escuro. Sem filtros nas capas.

## Composição e uso

- Contêiner máximo de 1440 px, masthead e lateral de 232 px no desktop.
- Celular: navegação inferior existente, tema no menu Mais; desktop: lateral.
- Títulos dos álbuns, capas e notas originais conduzem o ranking em linhas.
- Busca e notas precedem o ranking; revisão de capas em disclosure nativo.
- Filtros de capa vindos da URL abrem a revisão automaticamente.
- Cantos retos no catálogo e na navegação; sem animação decorativa.
- Espaçamento em múltiplos de 4 px, controles de pelo menos 44 px.
- Foco imediato; rótulos visíveis e nomes longos podem quebrar linha.

## Limites

- Ranking, empates, notas, autenticação, rotas e fonte permanecem nas regras
  existentes. Não substituir registros ou capas pessoais por demonstrações.
- As oito entradas e fotografias em `tests/browser/design-preview` são apenas
  demonstração. Capturas dos componentes reais usam fixtures sintéticas.
- Outras telas recebem compatibilidade de tokens e tipografia compartilhada;
  sua organização e suas regras não são redesenhadas nesta etapa.
