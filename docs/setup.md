# Setup da base funcional

## O que já existe

Next.js App Router, TypeScript, tela de entrada em português, login Google via Supabase Auth com PKCE, callback e logout, validação de proprietário no servidor, cookies HttpOnly/SameSite e POSTs com verificação de origem. Sem autenticação configurada, o desenvolvimento no loopback pode exibir somente a prévia privada local se `.private/source-preview.json` existir; fora desse caso o acesso fica fechado. Não há cadastro público no código; é necessário desligá-lo também no Supabase.

Parser XLSX, serviço de publicação transacional, endpoint POST protegido e consulta do ranking estão implementados. O botão só é habilitado com OAuth, banco de leitura/escrita e Drive configurados. As migrações 0001 e 0002 foram aplicadas no projeto Supabase configurado, e login, Drive e primeira publicação foram exercitados localmente. Backup/restauração isolada conferiu; validação com outra conta ainda pende. Não há provisionamento automático.

## Executar localmente

1. Usar Node.js 24.15.0 (`.nvmrc`) e executar `npm ci` no mesmo ambiente que será usado para iniciar a aplicação. No PowerShell, usar `npm.cmd ci`; no WSL, `npm ci`.
2. Copiar `.env.example` para `.env.local`, se for configurar serviços. Não preencher segredos em arquivos versionáveis ou na conversa. A URL administrativa do banco fica em `.env.migration.local`, separada da aplicação.
3. No PowerShell, executar `npm.cmd run dev`; no WSL, `npm run dev`. Abrir http://localhost:3000, igual ao `APP_ORIGIN`. A política padrão do PowerShell pode bloquear `npm.ps1` quando se digita `npm`; no Prompt de Comando, `npm run dev` funciona normalmente.

Neste computador, o checkout de trabalho fica no filesystem Linux do WSL, em `~/projects/oraculo-musical`. Não execute a aplicação a partir do checkout em `/mnt/c`: binários nativos do `node_modules` dependem do sistema operacional. Abra o projeto pelo VS Code com `code .` executado dentro da pasta WSL ou navegue pelo caminho `\\wsl.localhost\Ubuntu\home\mauricio\projects\oraculo-musical`.

Para usar o checkout existente em outro WSL, instale Git for Windows e configure o Git Linux para reutilizar o Git Credential Manager do Windows: `git config --global credential.helper "/mnt/c/Program\ Files/Git/mingw64/bin/git-credential-manager.exe"`. Depois, faça `git push` no terminal WSL e conclua a autenticação do GitHub no navegador, se solicitado. Isso mantém o token no Windows Credential Manager, sem gravá-lo no repositório.

Não compartilhe `node_modules` entre Windows e WSL: dependências nativas como Lightning CSS são específicas do sistema operacional. Se alternar o ambiente neste checkout, execute `npm ci` nele antes de iniciar a aplicação.

Sem credenciais a aplicação inicia e mostra somente a preparação de acesso. Nenhuma chave de serviço é necessária para build. `APP_ORIGIN` deve ser a origem exata usada no navegador; em produção usar HTTPS. Não usar Host/Forwarded recebidos para decidir a origem confiável.

## Configuração: Google + Supabase

Este roteiro registra a configuração manual usada no ensaio local. Não enviar senhas ou chaves na conversa. Nenhum desses serviços foi configurado automaticamente.

1. No Supabase, criar projeto na organização Free, sem trial/upgrade pago. Guardar a senha do banco em gerenciador de senhas. Aguardar o projeto ficar disponível.
2. Em Authentication → Providers → Google, localizar a URL de callback do projeto; será semelhante a `https://<ref>.supabase.co/auth/v1/callback`. Copiar exatamente o valor do painel.
3. No Google Cloud/Google Auth Platform, criar ou selecionar projeto. Configurar nome do aplicativo, e-mail de suporte e Audience apropriada; se usar modo Testing, incluir somente seu e-mail como test user. Usar apenas escopos de identidade: openid, e-mail e perfil. Não adicionar Drive ao login.
4. Criar cliente OAuth do tipo Web application. Origem autorizada local: `http://localhost:3000`. URI de redirecionamento: callback do Supabase copiado no passo 2. Mesmo com app local, o callback Google é do Supabase hospedado, não localhost:3000.
5. Copiar Client ID e Client Secret para o provider Google no Supabase e ativá-lo. O secret fica no painel Supabase, não no código ou `.env.local` do Next.js.
6. Em Authentication → URL Configuration, definir Site URL como `http://localhost:3000` e adicionar `http://localhost:3000/auth/callback` aos redirects permitidos. Na hospedagem futura, adicionar a URL HTTPS exata equivalente, sem curingas amplos.
7. Em Authentication → Users, pré-criar um usuário com exatamente o e-mail da conta Google que usará o app, confirmando esse e-mail. Se o painel exigir senha administrativa para criar o usuário, gerar uma aleatória; ela não será usada pelo app. Copiar o UUID para OWNER_USER_ID. Não usar apenas o e-mail como autorização.
8. Desligar Allow new users to sign up e login anônimo. Desativar o provider de e-mail/senha para que o acesso de usuário seja pelo Google. Supabase documenta vinculação automática de identidades com mesmo e-mail verificado; conferir que o primeiro login Google reutiliza o UUID criado. Se houver erro de vinculação, corrigir identidade/e-mail no painel, sem liberar cadastro geral como contorno.
9. Em `.env.local`, preencher APP_ORIGIN, SUPABASE_URL (Project URL), SUPABASE_PUBLISHABLE_KEY (chave publicável) e OWNER_USER_ID. Não usar service_role no lugar da chave publicável. Reiniciar `npm run dev`.
10. Abrir o app, usar “Entrar com Google”, conferir que sua conta entra e sair. Após a sincronização, conferir o ranking. Cancelamento, callback expirado e bloqueio de outra conta ainda precisam de verificação controlada.

Fontes: [Google no Supabase](https://supabase.com/docs/guides/auth/social-login/auth-google), [vinculação de identidade](https://supabase.com/docs/guides/auth/auth-identity-linking). Nomes de menus podem mudar. O login do proprietário foi exercitado na conta real; os cenários alternativos acima ainda não.

Páginas verificam `getUser()` e UUID permitido, independentemente do proxy. Conta diferente é desconectada no callback. Proteção em duas etapas da conta Google pode permanecer habilitada; isso não equivale a implementar MFA/AAL2 próprio do Supabase. Rate limiting do provedor deve permanecer ativo.

## Banco e migrações

Na mesma etapa de configuração do Supabase:

1. Abrir Connect no painel. Para migração, usar conexão direta ou Session pooler caso a rede local não suporte IPv6; não usar Transaction pooler para o runner, que mantém lock de sessão.
2. Criar `.env.migration.local` apenas no ambiente local de manutenção, com uma linha `DATABASE_MIGRATION_URL=<URI_ADMINISTRATIVA>`. Substituir a senha e codificar caracteres especiais na URI. Não colocar essa variável em `.env.local`: o Next carrega esse arquivo no servidor web. Manter verificação TLS; nunca usar `rejectUnauthorized=false`. Se necessário, configurar o certificado CA conforme as instruções de conexão do painel.
3. Em banco novo e dedicado ao projeto, executar `npm run db:migrate`. Em banco com dados, fazer backup/restauração de ensaio antes. Executar novamente deve indicar “Já aplicada”, sem recriar tabelas.
4. No SQL Editor administrativo, criar dois usuários LOGIN com senhas distintas e apenas os grupos já criados pela migração. Exemplo abaixo contém placeholders; substituir em ambiente privado, nunca salvar senhas no Git:

   ```sql
   create role oraculo_web login inherit password '<SENHA_FORTE_LEITURA>';
   create role oraculo_importer login inherit password '<SENHA_FORTE_SYNC>';
   grant oraculo_reader to oraculo_web;
   grant oraculo_sync to oraculo_importer;
   grant connect on database postgres to oraculo_web, oraculo_importer;
   ```

5. Preparar DATABASE_READ_URL com oraculo_web e DATABASE_SYNC_URL com oraculo_importer. No pooler compartilhado, preservar host/porta do painel e usar o usuário customizado com sufixo do projeto conforme configuração do pooler. Não copiar a credencial postgres para essas variáveis. As consultas usam a primeira URL; a sincronização e a migração de publicação usam a segunda. Mantenha a credencial administrativa fora do runtime.
6. Não expor o schema `oraculo` na Data API nem conceder privilégios a anon/authenticated. Essas tabelas são acessadas apenas pelo backend com roles SQL próprias. Não ativar a Data API para contornar erro de permissão SQL.
7. Conferir no banco: role de leitura consegue SELECT, mas UPDATE/DELETE de originais são negados; role de sincronização também não altera originais. A migração deve continuar sendo operada somente por administrador.
8. Guardar a URL administrativa apenas no ambiente de manutenção. Preparar o backup criptografado e ensaiar a restauração conforme [backup.md](backup.md). O destino inicial é local e privado; ainda será necessária uma cópia fora deste computador. Não criar bucket, assinatura paga ou cobrança automática para concluir este setup.

Referência: [conexões PostgreSQL no Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres). Login Google, senha de banco e credencial Drive são três configurações independentes.

`DATABASE_MIGRATION_URL` é credencial administrativa, usada somente pelo comando de manutenção que lê `.env.migration.local`. Configurar TLS verificado para banco remoto. Executar `npm run db:migrate`: runner usa lock, transação por arquivo e checksum para impedir edição de migração já aplicada. Reiniciar o servidor web após retirar uma credencial administrativa antiga de `.env.local`.

A migração cria esquema privado `oraculo`, fora do esquema público; não adicioná-lo aos schemas expostos na Data API. Cria papéis de grupo `oraculo_reader` e `oraculo_sync` sem login. O administrador deve criar identidades LOGIN com senhas aleatórias fora do Git, conceder a cada uma apenas seu grupo correspondente e configurar as URLs distintas. Não usar superusuário, proprietário das tabelas ou service_role no runtime. A credencial administrativa não deve estar na hospedagem web.

O leitor recebe SELECT. O sincronizador recebe INSERT limitado e UPDATE apenas do estado de execuções, publicação, lease e estado derivado; não pode alterar/excluir originais, versões ou identidades. Cadastro da pasta fonte é manutenção administrativa, nunca enviado pelo navegador. Não há credenciais LOGIN criadas automaticamente.

Depois de aplicar as migrações, cadastre a pasta autorizada como administrador do banco, substituindo o ID pelo valor privado do Drive:

```sql
INSERT INTO oraculo.sources(season, folder_id) VALUES (2026, '<ID_DA_PASTA_PRIVADA>');
```

Não coloque o ID real no Git nem o envie na conversa. A aplicação só sincroniza a temporada e a pasta configuradas no servidor, e exige que esse cadastro coincida.

Antes de qualquer migração de produção, fazer backup e restauração isolada conforme [arquitetura](architecture.md). O runner não cria backup e esta etapa não realizou um ensaio de restauração hospedada.

## Verificações

| Comando | Cobertura |
| --- | --- |
| `npm run lint` | ESLint/Next/TypeScript |
| `npm run typecheck` | Tipos sem emitir código |
| `npm test` | Autorização do dono e validação de origem |
| `npm run test:integration` | Migração, SELECT permitido, escrita negada, originais protegidas, limites e soma |
| `npm run test:e2e` | HTTP real contra Next local sem segredos: redirecionamento, no-store, preparação, origem e métodos |
| `npm run build` | Build de produção sem credenciais |

Sem `DATABASE_TEST_URL`, testes de banco usam PGlite (PostgreSQL WASM) em memória. Com essa variável, usam PostgreSQL dedicado; o banco deve ser descartável e não conter esquema/papéis do projeto. Os testes executam em transação e fazem rollback. Nunca fornecer URL de produção. A CI configura PostgreSQL 17 com credenciais explicitamente fictícias e sem acesso ao Drive.

E2E atual faz build e inicia o servidor de produção isolado na porta 3100; usa cliente HTTP do Playwright, não automação visual. Isso verifica os cabeçalhos efetivos de produção, que diferem dos cabeçalhos do servidor de desenvolvimento do Next. Sem credenciais não comprova login real. CI foi criada no repositório; só será executada remotamente após envio ao GitHub.

## Próximo passo

O usuário dispensou por ora os ensaios com segunda conta e pasta privada de teste; não registrar esses cenários como validados. A sincronização com serviços reais publicou a fonte pessoal e confirmou idempotência, e a restauração isolada conferiu. A interface pode mostrar campos competitivos transcritos da planilha, mas resultados oficiais dependem das decisões em [decisions.md](decisions.md). Se uma credencial administrativa for retirada de `.env.local`, reiniciar o servidor web para que deixe o processo.


## Ativação das capas

Aplicar a migração `0006_album_artwork.sql` pelo procedimento administrativo acima, com backup verificado, antes de ativar a busca em produção. O aplicativo continua consultável antes dessa migração, com os discos de fallback e busca de capas desabilitada. Nenhuma API key é necessária. Após disponibilizar o código e aplicar a migração, abrir Sincronização e usar Buscar capas para o catálogo já importado. Requisitos de rede, comportamento e validação real pendente estão em [artwork.md](artwork.md).
