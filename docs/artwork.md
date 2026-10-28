# Capas dos álbuns

O Oráculo consulta [MusicBrainz](https://musicbrainz.org/doc/MusicBrainz_API), [Cover Art Archive](https://musicbrainz.org/doc/Cover_Art_Archive/API) e, como alternativa, a [iTunes Search API](https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/index.html). Não exige chave de API, Last.fm ou alterações na planilha.

## Uso e recuperação

As capas aparecem no Início, catálogo e detalhe do álbum. Em **Sincronização → Retomar busca de capas**, o app completa os casos pendentes e consulta os negativos antigos no iTunes, sem refazer as associações encontradas. Após uma importação bem-sucedida ou sem alterações, a busca começa automaticamente.

Cada lote processa até cinco álbuns em vinte segundos. Uma falha do MusicBrainz/arquivo de capas permite tentar o iTunes no mesmo álbum e continuar pelos próximos. Os erros restantes guardam a data de nova tentativa; o navegador aguarda e retoma automaticamente, sem clique, durante uma sessão de até dez minutos. Ao atingir esse limite ou um Retry-After além dele, informa que o progresso foi salvo e permite retomar mais tarde. Sessão inválida, acesso negado e configuração de banco não são repetidos automaticamente.

**Mantenha a página aberta.** Não há worker ou cron. Fechar/navegar interrompe os próximos lotes; o lote recebido no servidor pode terminar. **Parar busca** termina o lote atual ou cancela imediatamente uma espera. Nada desfaz a publicação do XLSX, notas, seeds, resultados, ranking ou histórico.

## Correspondência e revisão

MusicBrainz busca pelo artista e título; uma correspondência exata única permite consultar a capa frontal aprovada do grupo. Ausência de lançamento/capa ou falha externa habilita a alternativa do iTunes, que pesquisa álbuns no catálogo brasileiro. Respostas truncadas nunca são escolhidas automaticamente. Artista e álbum precisam corresponder após normalizar Unicode NFC, caixa e espaços; colaborações, acentos e qualificadores Live/Deluxe/Remastered não são removidos. Resultados duvidosos ficam para revisão; os ambíguos anteriores não são substituídos automaticamente.

Em **Álbuns → Capas dos álbuns**, use **Para revisar**, **Sem capa encontrada** ou **Com falha**. Links diretos: `/albuns?capas=revisar`, `sem-capa`, `falhas`. Busca/nota/limite acompanham a navegação para o detalhe e o retorno. Só álbuns presentes entram nessas listas e na busca em lote; ausentes mantêm dados e edição individual.

No detalhe, **Buscar ou corrigir capa** permite escolher **Fonte da busca: MusicBrainz / Cover Art Archive ou iTunes** e ajustar artista/título apenas para a pesquisa. Visualize antes de confirmar. O servidor consulta novamente o identificador; o navegador não fornece URLs. Confirmar fixa a escolha nas sincronizações; uma correção malsucedida preserva a anterior. **Ocultar capa** também impede substituição. **Usar busca automática** devolve o álbum à fila. Essas ações removem a ambiguidade da lista após atualizar.

## Imagens e atribuição

São salvos identificadores, URLs, origem e datas, sem copiar imagens para o banco/servidor. MusicBrainz usa miniaturas fornecidas pelo arquivo (250/500 px). iTunes usa a miniatura fornecida pela API, sem inventar URLs de resolução maior. Imagens carregam sob demanda, sem otimização no servidor; falhas mostram um disco com espaço reservado.

Capas via iTunes mostram link para o álbum na Apple Music no Início, catálogo, detalhe e prévia. O uso é associado à divulgação do álbum, com atribuição/link; a gratuidade da API não transfere direitos sobre as imagens. Referência: condições de uso e conteúdo promocional na documentação da Search API. URLs de imagens são restritas a HTTPS nos hosts do arquivo e no CDN de imagens Apple (`isN-ssl.mzstatic.com/image/`); links de álbum são validados, normalizados para `music.apple.com` e não aceitam credenciais/portas.

## Persistência, limites e permissões

A `0006` mantém enriquecimento por `(source_id, album_id)`: pending/found/missing/ambiguous/error/hidden, seleção automática/manual e diagnósticos. A `0007` acrescenta provedor, ID de coleção Apple, link do álbum e data da tentativa alternativa. IDs MusicBrainz continuam UUID; IDs Apple são números separados. Não modifica associações, avaliações ou snapshots existentes.

Uma primeira consulta alternativa é liberada imediatamente para negativos antigos, mesmo que seu prazo original não tenha vencido. Depois de consultar a alternativa, ausências são mantidas por sete dias; falhas usam a espera do serviço, com mínimo de trinta segundos. Encontrados/manuais/ocultos não são reconsultados; ambíguos aguardam decisão.

O lease PostgreSQL existente de 25 segundos continua protegendo lotes de vinte segundos contra concorrência e gravações atrasadas. Relógios independentes persistidos em `artwork_provider_limits` espaçam MusicBrainz/arquivo em pelo menos 1,1 s cada e iTunes em 3,1 s (abaixo de vinte chamadas/minuto). Consultar um serviço em cooldown não prolonga sua espera e não impede usar os demais.

429/5xx têm no máximo duas tentativas dentro do orçamento e respeitam Retry-After. Falhas esgotadas/de transporte aumentam a espera do serviço em 30 s, 60 s, 120 s etc., até trinta minutos, sem encurtar Retry-After. Sucesso zera o contador. A espera persiste entre lotes, páginas e instâncias. JSON é limitado a 512 KB, timeout a oito segundos ou orçamento restante; até três redirecionamentos apenas dentro do serviço esperado. Nunca aumentar concorrência para contornar limites.

Endpoints POST privados de lote/pesquisa/seleção exigem mesma origem e proprietário antes de ler corpo/serviço. Fonte vem da configuração; IDs alheios não são acessíveis. Leitor segue apenas leitura; sincronizador só altera enriquecimento/coordenação. Nenhuma conexão administrativa é adicionada ao app. Visitar páginas não consulta os provedores.

## Diagnóstico

Códigos como `ARTWORK_PROVIDER_UNAVAILABLE:MUSICBRAINZ:HTTP_503` ou `...:ITUNES:TIMEOUT` distinguem serviço/status, DNS, TLS, rede, JSON inválido/excessivo e redirecionamentos. Não são salvos termos de consulta, respostas ou exceções brutas. Sincronização lista erros salvos em **Ver falhas das capas**; códigos antigos informam que o motivo detalhado não foi registrado. Durante recuperação, mostra o horário da próxima tentativa. Cooldown não prova uma nova resposta HTTP do serviço.

## Implantação

A `0006` já foi aplicada pelo usuário no Supabase. A `0007` ainda precisa ser aplicada em produção, pelo ambiente administrativo habitual (`npm run db:migrate`) ou pelo [SQL pronto para o editor Supabase](sql/0007_artwork_alternatives_supabase.sql). Esse SQL tem transação, lock e registro do checksum no controle de migrações; executar uma vez. Não habilitar RLS automaticamente nas novas tabelas privadas: o app mantém os papéis PostgreSQL e permissões existentes.

Antes da `0007`, as capas anteriores continuam legíveis; tentar buscar/corrigir informa a migração pendente, sem reclassificar ou apagar associações. Após aplicar e disponibilizar o código, usar **Retomar busca de capas**; não precisa reimportar a planilha. Verificar progresso, origem de uma capa Apple, revisão e retomada.

Saída HTTPS em produção: `musicbrainz.org`, `coverartarchive.org`, `archive.org`/subdomínios usados pelo arquivo, `itunes.apple.com`, CDN `isN-ssl.mzstatic.com`; links de álbum abrem `music.apple.com`. Não há conta/chave adicional.

## Validação e limites observados

Testes usam respostas sintéticas: matching conservador, validação de URLs/IDs e API privada, falha 503 seguida de capa Apple, persistência/isolamento/permissões, relógios separados, backoff, retomada/cancelamento/limite de sessão e preservação de escolhas. O SQL móvel é aplicado em PGlite a dados criados com a `0006`, conferindo preservação, leitura anterior ao upgrade e escrita com o papel sincronizador. Layout Chromium cobre quatro larguras, atribuição sem links aninhados, seleção Apple e recuperação sem clique; build/E2E verificam rotas privadas.

Este ambiente não tem credenciais administrativas de produção nem saída liberada para esses provedores. Não foi realizada consulta real ao iTunes nem aplicada a `0007` no Supabase. A cobertura dos álbuns restantes e a estabilidade externa devem ser conferidas após a implantação; não se promete encontrar todas as capas ou eliminar a indisponibilidade dos serviços.
