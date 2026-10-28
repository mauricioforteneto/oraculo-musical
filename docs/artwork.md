# Capas dos álbuns

O Oráculo consulta gratuitamente o [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API) e o [Cover Art Archive](https://musicbrainz.org/doc/Cover_Art_Archive/API), sem chave de API, conta Last.fm, alteração do XLSX ou serviço pago. A gratuidade das APIs não altera os direitos sobre as imagens.

## Uso

As capas aparecem nos três destaques do Início, na lista de álbuns e na avaliação individual. Top 50, estatísticas, histórico e Playoffs permanecem sem capas nesta versão. Imagens ausentes ou quebradas mostram um disco; carregamento sob demanda, espaço reservado e proporção preservada evitam mudanças bruscas de layout.

Em **Sincronização**, use **Buscar capas** para completar o acervo existente. Após uma importação bem-sucedida ou sem alterações, o app inicia a busca automaticamente. Mantenha a página aberta: o navegador solicita lotes sequenciais de até cinco álbuns, com orçamento de vinte segundos por lote. **Parar busca** termina o lote atual; **Retomar busca de capas** continua pelo estado salvo. Fechar a página interrompe os próximos lotes; o lote já recebido pelo servidor pode terminar. Não há worker, cron ou processamento independente do navegador.

A publicação do XLSX termina antes da busca das capas. Uma falha nas APIs não desfaz a importação nem muda notas, seeds, resultados ou rankings. Visitar uma página nunca inicia uma busca remota de metadados.

## Identificação e revisão

O MusicBrainz é consultado pelo artista creditado e título, retornando grupos de lançamento. O app aplica uma correspondência automática apenas quando existe um único grupo com artista e título exatamente correspondentes após normalizar Unicode NFC, caixa e espaços. Créditos de colaboração, acentos e qualificadores como Live, Deluxe e Remastered não são removidos. Pesquisa truncada nunca é escolhida automaticamente.

O Cover Art Archive fornece a capa frontal aprovada do grupo. Esta versão não oferece um catálogo de todas as edições ou imagens de um mesmo grupo. Miniaturas de 250 e 500 px são usadas quando disponíveis; somente URLs HTTPS dos hosts do Cover Art Archive e Internet Archive são aceitas. O app guarda URLs e identificadores, sem copiar os binários ou otimizar as imagens em seu servidor.

No detalhe, abra **Buscar ou corrigir capa**. Ajuste artista/título exclusivamente para a pesquisa, escolha um dos cinco candidatos, visualize e confirme. Isso não renomeia o álbum. Uma falha durante a correção preserva a associação anterior. Escolhas manuais ficam fixas nas sincronizações seguintes; **Ocultar capa** também é uma escolha manual. **Usar busca automática** remove essa escolha e devolve o álbum à fila da próxima busca.

## Persistência e limites

A migração `0006_album_artwork.sql` cria enriquecimento separado por `(source_id, album_id)`. Os estados são `pending`, `found`, `missing`, `ambiguous`, `error` e `hidden`; seleção automática/manual, grupo, URLs, datas e ator da escolha são preservados. Notas, resultados e snapshots não são enviados aos provedores; somente artista/título necessários à consulta são enviados pelo backend.

- Capas encontradas são reutilizadas sem nova busca; escolhas manuais e ocultações não são substituídas automaticamente.
- Resultado ausente pode ser consultado novamente após sete dias. Erro temporário, após trinta minutos. Casos ambíguos aguardam revisão manual.
- Álbuns ausentes na versão atual preservam suas capas e permitem revisão individual, mas ficam fora do preenchimento automático.
- Um gate no PostgreSQL coordena todas as instâncias e fontes, espaçando as chamadas em pelo menos 1,1 segundo. Lease de 25 segundos protege a operação de até vinte segundos; gravações exigem token ainda válido.
- Respostas 429/5xx respeitam Retry-After e têm no máximo duas tentativas dentro do orçamento. Esperas longas pausam a busca; falhas não geram repetição contínua. JSON limitado a 512 KB e até três redirecionamentos, restritos aos provedores.

Os endpoints POST privados `/api/artwork/batch`, `/api/artwork/[id]/search` e `/api/artwork/[id]/selection` exigem origem válida e proprietário. A fonte vem exclusivamente da configuração do servidor; IDs de outro catálogo não são acessíveis. O cliente envia termos de busca ou identificadores, nunca URLs de imagens ou pasta do Drive. O papel leitor consulta as capas; o sincronizador grava somente o enriquecimento e coordena o gate, sem novos privilégios sobre notas ou snapshots.

## Implantação e validação

1. Fazer backup atualizado e seguir o procedimento administrativo existente de restauração/verificação.
2. Aplicar `npm run db:migrate` no ambiente administrativo com a conexão habitual. Não colocar `DATABASE_MIGRATION_URL` no Railway web nem executar SQL com o papel leitor/sincronizador.
3. Disponibilizar o commit e abrir Sincronização autenticado. Antes da migração, o catálogo continua funcionando com discos e aviso de configuração pendente.
4. Usar Buscar capas e verificar progresso, uma capa encontrada, revisão manual, ausência de imagem e retomada. As chamadas requerem saída HTTPS para `musicbrainz.org`, `coverartarchive.org`, `archive.org` e os subdomínios do Internet Archive utilizados pelas respostas.

A migração foi testada em banco isolado. O usuário aplicou a `0006` pelo SQL Editor do Supabase e confirmou os três indicadores de registro/tabelas em `true`. A busca em produção obteve associações de capas e também falhas externas. Os testes locais continuam usando respostas sintéticas; este ambiente não tem conexão administrativa nem saída liberada para consultar os provedores. A validação dos novos diagnósticos em produção permanece pendente.

Verificações: lint, typecheck, testes unitários (matching, provedores e endpoints), integração com PostgreSQL WASM (persistência, permissões, concorrência, isolamento e retomada), layout Chromium em quatro larguras e build/E2E HTTP. Nenhuma imagem ou planilha pessoal é incluída no Git.


## Diagnóstico das falhas

Novas falhas registram o provedor e um motivo controlado no campo de texto `error_code` já existente, por exemplo `ARTWORK_PROVIDER_UNAVAILABLE:MUSICBRAINZ:HTTP_503` ou `ARTWORK_PROVIDER_UNAVAILABLE:COVER_ART_ARCHIVE:TIMEOUT`. Também distinguem DNS, TLS, conexão e resposta inválida, inclusive no download do corpo JSON. Não são persistidos URLs de consulta, corpo da resposta ou mensagens brutas de exceção. Não requer nova migração.

Sincronização mostra a mensagem específica ao pausar e permite abrir **Ver falhas das capas** para consultar os motivos salvos. Códigos antigos sem detalhe permanecem compatíveis; o aplicativo informa que não foi possível registrar a causa da tentativa antiga. A próxima tentativa elegível registra os detalhes novos, mantendo o intervalo de trinta minutos para falhas. Os limites de chamadas, timeouts, pausas e escolhas manuais permanecem iguais.
