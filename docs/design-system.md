# Identidade visual

Direção aprovada: A, Revista musical, com tema claro e escuro escolhidos pelo
usuário. O sistema atual está registrado em [design.md](../design.md).

## Base

Tailwind CSS 4 via PostCSS; componentes locais personalizáveis no padrão shadcn/ui (Button/Card), variantes com class-variance-authority, composição Radix Slot e ícones Lucide. Configuração em components.json para evolução da biblioteca. Recharts será adicionado quando houver gráficos reais a implementar, evitando dependência sem uso agora.

## Paleta e tipografia

- Papel claro quente e tinta escura; modo escuro com superfícies quentes em três níveis.
- Vermelho para ações, seleção e foco, com contraste próprio em cada tema.
- Bricolage Grotesque condensada nos títulos e Source Serif 4 na leitura.
- Fontes variáveis auto-hospedadas no build por `next/font/google`.
- Tokens semânticos em `src/app/theme.tokens.css`, compartilhados entre telas.

Os tokens alimentam Tailwind e componentes. Cor nunca é o único indicador de
estado. Foco visível, controles com altura mínima de 44 px e respeito a
prefers-reduced-motion. O seletor Tema oferece Claro, Escuro e Seguir o sistema:
na lateral do desktop, em Mais no celular e na entrada. A escolha fica no
navegador, acompanha outras abas e é lida antes da primeira pintura. Se o
armazenamento estiver bloqueado, o tema funciona na página e informa o limite.

Entrada com identidade musical, arte de vinil em CSS e login Google. Acervo com estado vazio honesto, sem notas, capas ou rankings pessoais inventados. Ícones decorativos ocultos para leitores de tela. Layout empilha em telas estreitas; conteúdo e ações não dependem de hover.

Nas próximas telas: capas com origem real validada, notas legíveis, ranking adaptado ao celular, filtros, carregamento e erros usando os mesmos tokens. Preservar distinção entre dados importados, incompletos e cálculos pendentes.


## Estrutura das páginas

A navegação compartilhada usa lateral no desktop e barra inferior em telas até
1000 px. O catálogo tem linhas editoriais, título do álbum em destaque, capas
maiores e notas originais com números tabulares. A revisão de capas fica em
disclosure, aberto automaticamente quando há um filtro de capa na URL.
Responsabilidades, menu Mais e área segura estão em [navigation.md](navigation.md).
