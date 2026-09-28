# Oráculo Musical

Aplicação web pessoal, confortável no celular, para consultar avaliações de álbuns, ranking anual e, em etapas posteriores, Top 50, campeonato, backlog, reescutas e histórico do Last.fm.

**Estado: base funcional de acesso e segurança implementada.** Há Next.js, login Google via Supabase, migração inicial, leitor de versões do Drive, testes e CI. A sincronização completa e o ranking ainda não estão implementados. Nenhum banco hospedado foi provisionado e nenhum dado pessoal foi importado.

## Fluxo aprovado

Excel versionado em pasta privada do Google Drive → sincronização solicitada pelo usuário → validação e persistência em PostgreSQL → telas de consulta.

- A fonte é atualizada fora do aplicativo. O aplicativo não edita avaliações nem escreve no Drive.
- O botão Sincronizar solicita uma importação; não permite enviar notas ou resultados.
- Rankings seguem o regulamento confirmado. Divergências com a fonte aparecem no relatório.
- Notas originais, revisões, promoção 80*, scores e seeds são conceitos separados.
- Nenhuma chamada a LLM ou agente faz parte da operação.

## Documentação

| Documento | Conteúdo |
| --- | --- |
| [Especificação](docs/spec.md) | Experiência, requisitos e critérios do MVP |
| [Descoberta da fonte](docs/source-discovery.md) | Estrutura observada, limitações e divergências |
| [Arquitetura](docs/architecture.md) | Módulos, infraestrutura, segurança e recuperação |
| [Modelo de dados](docs/data-model.md) | Entidades, identidade, proveniência e histórico |
| [Integrações](docs/integrations.md) | Drive, Last.fm, AOTY e contratos internos |
| [Regulamento 2026](docs/campeonato/regras-2026.md) | Os 22 tópicos fornecidos, preservados |
| [Decisões](docs/decisions.md) | Confirmados, propostas e 14 pendências do regulamento |
| [Backlog](docs/backlog.md) | Ordem de implementação e testes de aceite |
| [Setup e operação](docs/setup.md) | Executar localmente, configurar acesso e aplicar migrações |
| [Identidade visual](docs/design-system.md) | Tema escuro, componentes e padrões visuais |

## Preparação local

Requer Node.js 24 (versão fixada em `.nvmrc`). Use `npm ci` e `npm run dev`; no PowerShell com scripts desabilitados, use `npm.cmd`. Abra http://localhost:3000. Sem credenciais, aparece o estado “Seu espaço está em preparação”, sem dados fictícios disfarçados de acervo.

Verificações: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:integration`, `npm run test:e2e` e `npm run build`. A integração local usa PostgreSQL WASM isolado (PGlite); CI está configurada para PostgreSQL 17 descartável. Os testes E2E atuais verificam HTTP, sem navegador nem credenciais de produção.

Próxima entrega: configurar e validar os serviços privados, concluir a auditoria do Excel e implementar fonte → banco → ranking anual. Regras competitivas pendentes não foram decididas. Não habilitar cobranças ou planos pagos.

Dados reais, exportações, dumps e credenciais ficam fora do Git. Evidências locais de descoberta, se presentes, ficam em `.private/`, ignorada pelo Git. Acesso pelo conector usado na descoberta não fornece credenciais para a aplicação hospedada.
