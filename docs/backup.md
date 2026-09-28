# Backup privado e restauração de ensaio

Este procedimento cobre os esquemas `oraculo` e `oraculo_migrations` do PostgreSQL. Login do Supabase, configurações do projeto, papéis SQL, segredos e arquivos no Drive precisam de recuperação separada. A primeira cópia fica em `.private/backups/`, fora do Git; uma cópia no mesmo computador ainda não protege contra perda desse computador.

## Preparar

1. Usar `pg_dump` da versão 17 ou superior, compatível com o servidor atual. O script procura `pg_dump` no `PATH` ou em `.private/tools/pg17/`. Instalar também `gpg`.
2. No Supabase, abrir **Database → Settings → SSL Configuration → Download Certificate**. Salvar o certificado do projeto em `.private/supabase-ca.crt` (ou definir `BACKUP_CA_CERT` em `.env.migration.local`). O backup usa `verify-full` e não reduz a verificação TLS se o certificado estiver ausente.
3. Manter a URI administrativa apenas em `.env.migration.local`, na variável `DATABASE_MIGRATION_URL`.
4. Criar uma senha aleatória para criptografia, sem a imprimir nem enviar pela conversa:

   ```bash
   umask 077
   mkdir -p ~/.config/oraculo-musical
   if [ ! -e ~/.config/oraculo-musical/backup-passphrase ]; then
     openssl rand -hex 32 > ~/.config/oraculo-musical/backup-passphrase
   fi
   chmod 600 ~/.config/oraculo-musical/backup-passphrase
   ```

   Se esse arquivo já existe, preservá-lo. Guardar uma cópia da senha em um gerenciador seguro separado do backup; sem ela, a restauração é impossível.

## Criar a cópia

Executar `npm run db:backup`. O comando lê `.env.migration.local`, extrai os esquemas `oraculo` e `oraculo_migrations`, passa o dump diretamente ao GPG e grava um arquivo `.dump.gpg` em `.private/backups/`. Não mantém dump em texto aberto nem aceita uma conexão sem verificação do certificado. Se falhar, remove o arquivo parcial.

Após criar a cópia, guardar o arquivo criptografado em outro local privado quando um destino externo estiver disponível. A meta operacional é backup semanal com quatro cópias; essa rotação ainda não foi automatizada.

## Restaurar em isolamento

Usar uma instância PostgreSQL descartável, sem ligação com o projeto Supabase de produção. Criar um banco vazio, exportar `PGHOST`, `PGPORT`, `PGUSER` e `PGDATABASE` para **esse banco local**, e executar:

```bash
set -o pipefail
gpg --batch --pinentry-mode loopback \
  --passphrase-file ~/.config/oraculo-musical/backup-passphrase \
  --decrypt .private/backups/NOME_DO_ARQUIVO.dump.gpg |
  pg_restore --dbname="$PGDATABASE" --exit-on-error --single-transaction --no-owner --no-acl
```

Conferir contagens de fontes, versões, álbuns, avaliações originais, tentativas, apontamentos, backlog e migrações aplicadas. Comparar conteúdo das linhas com o banco de origem após normalizar horários para UTC e valores JSON; registrar o resultado sem copiar linhas pessoais para o Git. Encerrar e apagar a instância descartável depois da conferência.

Ensaio em 28/09/2026: um dump criptografado foi restaurado em PostgreSQL 17 local e isolado. As 12 tabelas dos dois esquemas tiveram contagens e conteúdo iguais aos da origem; incluíram 120 álbuns, 120 avaliações originais, 15 registros de backlog, o ponteiro de publicação e duas migrações aplicadas. A instância descartável foi encerrada e seus dados apagados. O arquivo criptografado permaneceu em `.private/backups/`.

Referências: [pg_dump](https://www.postgresql.org/docs/17/app-pgdump.html), [pg_restore](https://www.postgresql.org/docs/17/app-pgrestore.html), [conexões e TLS no Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).
