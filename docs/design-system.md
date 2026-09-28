# Identidade visual

Direção aprovada: interface escura, com estética editorial musical. Aplicada às telas existentes de entrada e preparação do acervo; não representa funcionalidades futuras prontas.

## Base

Tailwind CSS 4 via PostCSS; componentes locais personalizáveis no padrão shadcn/ui (Button/Card), variantes com class-variance-authority, composição Radix Slot e ícones Lucide. Configuração em components.json para evolução da biblioteca. Recharts será adicionado quando houver gráficos reais a implementar, evitando dependência sem uso agora.

## Paleta e tipografia

- Fundo carvão #101412; cartões verde profundo #181e1a.
- Texto principal marfim #f0eee5; secundário #a8b3a9.
- Ação principal em cobre claro #dfa775, com texto escuro #21190f.
- Bordas #354038; avisos com contraste explícito e erros salmão #f4a599.
- Títulos editoriais serifados, controles e conteúdo em sans-serif. Fontes do sistema, sem requisição externa.

Tokens semânticos em globals.css alimentam Tailwind e componentes. Cor nunca é o único indicador de estado. Foco visível, controles com altura mínima de 44 px e respeito a prefers-reduced-motion. Tema escuro fixo nesta etapa.

Entrada com identidade musical, arte de vinil em CSS e login Google. Acervo com estado vazio honesto, sem notas, capas ou rankings pessoais inventados. Ícones decorativos ocultos para leitores de tela. Layout empilha em telas estreitas; conteúdo e ações não dependem de hover.

Nas próximas telas: capas com origem real validada, notas legíveis, ranking adaptado ao celular, filtros, carregamento e erros usando os mesmos tokens. Preservar distinção entre dados importados, incompletos e cálculos pendentes.
