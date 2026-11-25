# Temporadas e classificação mensal

Um aplicativo compartilha catálogo, capas, notas, estatísticas, autenticação e os temas editorial claro/escuro. O contexto explícito identifica ano, campeonato, formato e regras; a ligação com a pasta do Drive existe somente no servidor. Sem `temporada`, usa-se `SOURCE_SEASON` (2026 por padrão).

`/albuns?temporada=2027`, `/playoffs?temporada=2027` e as demais rotas mantêm a temporada nas consultas e operações. A troca pelo seletor limpa filtros, versão e referências; uma avaliação aberta retorna ao catálogo. Fontes sem configuração mostram estado vazio: não há fallback para outro ano. As regras privadas em `/regras?temporada=2026|2027` funcionam antes da primeira importação e independem da pasta e do banco.

## Separação do código

- `src/lib/seasons/definitions.ts`: definição pública e parâmetros compartilhados com os resumos.
- `src/lib/seasons/context.ts`: resolução privada, validação do mapa e contexto de páginas/APIs.
- `src/lib/competition/engine.ts`: adaptadores e união discriminada `CompetitionState`. O formato legado usa o serviço existente; o mensal tem estado próprio.
- `CompetitionView`: escolhe o painel conforme o formato. Os snapshots, participantes, cálculos e resultados de 2026 permanecem no motor legado.
- `monthly.ts`: elegibilidade, meses, vagas e desempates. `monthly-storage.ts`: extrações, hashes vinculados à fonte e publicação transacional auditada.

## Contrato da planilha 2027

O nome deve seguir `Oraculo_Musical_2027_v1.xlsx`, `v2.xlsx` etc., dentro da pasta exclusiva de 2027. O maior número válido governa a importação. As abas de catálogo continuam `Albuns 2027`, `Backlog` e `Resumo` (opcional). Veja o [modelo inteiramente fictício](templates/README.md).

`Data da avaliação` é a conclusão da avaliação original: data civil ISO `AAAA-MM-DD`, brasileira `DD/MM/AAAA` ou célula de data Excel. `Ano de lançamento` é inteiro. Metadados ausentes permanecem ausentes; uma data inválida ou de outra temporada bloqueia a publicação. Ano de lançamento ausente impede fechar o mês afetado; data ausente impede fechar todos os meses potencialmente afetados. Discos de outros anos continuam no catálogo sem disputar vagas. Notas originais e sua política de imutabilidade permanecem preservadas.

### Desempates mensais

Cabeçalhos: `Decisão`, `Temporada`, `Mês`, `Regra`, `Artista`, `Álbum`, `Nota original`, `Ordem no grupo`, `Status`, `Confirmado por`, `Confirmado em`, `Referência da confirmação`.

Cada grupo que altera quem se classifica exige reescuta, uma identificação comum e uma linha por álbum empatado, com ordem única 1…N, correspondência exata dos artistas/álbuns/notas, regra `2027-monthly-1` e confirmação identificada e consistente. Use `Confirmada` apenas depois da decisão explícita. O app não muda as notas nem usa a ordem alfabética para conceder uma vaga disputada. Uma decisão pendente, parcial, ambígua ou desatualizada não resolve o empate.

### Fechamentos mensais

Cabeçalhos: `Fechamento`, `Temporada`, `Mês`, `Regra`, `Versão base`, `Hash do contexto`, `Status`, `Confirmado por`, `Confirmado em`, `Referência da confirmação`, `Corrige fechamento`, `Justificativa`.

1. Importe uma versão com os fatos e desempates corretos. Em Playoffs/2027, escolha o mês e abra “Preparar fechamento na planilha”.
2. Após o mês completo no fuso `America/Sao_Paulo`, copie a orientação. Ela começa com `Pendente` e confirmação em branco. Revise candidatos, vagas e regra antes de decidir.
3. Registre identificação nova, versão-base/hash copiados, confirmação real do proprietário, data posterior ao encerramento e referência. Publique uma versão numericamente superior e sincronize.
4. O sincronizador valida novamente fonte, extração-base, contexto atual, calendário e metadados antes de inserir o snapshot imutável e atualizar a publicação do mês.

Mudanças posteriores geram pendências e preservam os classificados confirmados. Uma correção exige nova identificação, referência ao fechamento vigente, nova confirmação e justificativa com pelo menos dez caracteres. Preserve as linhas anteriores na planilha. Uma transferência entre meses que duplicaria um classificado é recusada; confirme as correções dos meses envolvidos na mesma versão. Reimportar a mesma confirmação não duplica snapshots. Não edite uma linha já confirmada para substituir um fechamento.

São duas vagas por mês, 24 no total e até 24 classificados, sem redistribuição de vagas vazias. Janeiro a novembro usam meses completos. Dezembro permanece sem corte e não pode ser fechado. Prazo do AOTY Year-End, data da final e implementação do mata-mata estão em aberto; não se presume 10/12, 31/12 ou final em janeiro.

## Ativação privada, sem interromper 2026

Esta entrega prepara o código; não altera a configuração nem migra o banco de produção automaticamente.

1. Faça um [backup restaurável](backup.md) antes da migração. Confirme os acessos de leitura/sincronização/migração separados.
2. Execute `npm run db:migrate` com `DATABASE_MIGRATION_URL` fora do runtime web, conforme [setup](setup.md). A migração aditiva `0009_monthly_competition.sql` cria somente estruturas mensais e permissões. Não reescreve registros de 2026. Para o editor SQL do Supabase, use o [arquivo transacional](sql/0009_monthly_supabase.sql).
3. Crie a pasta privada exclusiva de 2027 e compartilhe apenas leitura com a conta de serviço existente. Registre a fonte usando uma conexão administrativa e parâmetros privados:

```sql
INSERT INTO oraculo.sources (season, folder_id)
VALUES (2027, 'SUBSTITUIR_PELO_ID_PRIVADO_2027')
ON CONFLICT (season, folder_id) DO NOTHING;
```

4. Configure no servidor `SEASON_SOURCES_JSON` com **ambas** as pastas: `{"2026":"ID_PRIVADO_2026","2027":"ID_PRIVADO_2027"}`. Mantenha `SOURCE_SEASON=2026` enquanto esse for o padrão desejado. Nunca coloque IDs reais no Git ou no cliente. Não vincule a mesma pasta a dois anos.
5. Sem mapa, a configuração antiga `GOOGLE_DRIVE_FOLDER_ID` atende apenas ao ano de `SOURCE_SEASON`. Com mapa, nenhuma entrada ausente recupera a pasta antiga. JSON inválido falha de forma fechada nas consultas; as regras continuam consultáveis.
6. Após disponibilizar a planilha real versionada na pasta correta, faça login, selecione 2027 e sincronize. Confira metadados e pendências antes de fechar meses. Volte a 2026 e confira publicação, chave e snapshots.

Somente `oraculo_sync` pode inserir extrações/contextos/snapshots e trocar o apontador do mês. Não pode alterar ou excluir snapshots. `oraculo_reader` só consulta. IDs e números de versão são sempre vinculados à fonte; versões v1 de anos diferentes coexistem.

## Validação

Testes unitários cobrem configuração, datas, elegibilidade, vagas, empates e regras sem fonte. Integração com SQL real verifica permissões, isolamento de fontes com versões iguais, idempotência, contexto inválido, correções e prevenção de duplicidade entre meses. GitHub Actions executa lint, tipos, testes, build, proteção das rotas e layout Chromium em 360, 390, 768 e 1280 px, nos dois temas, com dados fictícios. Capturas não demonstram ativação de uma fonte real.
