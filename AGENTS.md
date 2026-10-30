<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Hallmark

Hallmark está instalado neste repositório em `.agents/skills/hallmark/`.
Quando o usuário solicitar Hallmark, leia primeiro
`.agents/skills/hallmark/SKILL.md` e as referências exigidas para a tarefa.
Essa leitura explícita também funciona quando o Cloud não lista skills locais.

- Para auditoria, siga o modo `audit`; auditoria produz um relatório.
- Redesign de telas existentes exige um pedido explícito do usuário.
- Preserve as regras de negócio, a autenticação, as rotas e a integração com a fonte.
- A identidade visual existente está documentada em `docs/design-system.md`.
- Origem, versão e comandos de verificação estão em `docs/hallmark.md`.
