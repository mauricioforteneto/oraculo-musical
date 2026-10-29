# Central de pendências

Página privada `/pendencias`, disponível no menu desktop, em **Mais → Pendências** no celular e por atalhos no Início, Top 50 e Sincronização. Não requer novas credenciais. A leitura de decisões manuais exige a migração 0008.

## Conteúdo

- **Fatos do Top 50:** conflitos já identificados pelo cálculo (participação/etapa sem evidência, exclusão contraditória da Repescagem, fase posterior ao corte, duplicidade e ausência) e o grupo completo empatado na última vaga. O cálculo expõe as identidades desse grupo sem mudar ranking ou desempates.
- **Resultados:** duplicidades, vencedor ausente/inválido, incompatibilidade entre resultado e participantes, registro sem confronto reconhecido e resultado publicado antes de seus participantes poderem ser definidos. Jogos futuros sem resultado publicado não geram pendência.
- **Conferência da planilha:** diferenças entre valores derivados e a regra `2026-top50-2`, incluindo comparação com a nota congelada. Não bloqueiam uma posição que o cálculo já conseguiu comprovar.
- **Importação:** avisos do último relatório bem-sucedido da publicação ativa e erros/avisos da última tentativa recusada. Avisos não bloqueantes de backlog continuam ocultos; erros que impedem a importação permanecem visíveis. Falha sem apontamentos de linha é mostrada com o código registrado e orientação para conferir Sincronização.

Cada item apresenta álbuns identificáveis, motivo, efeito, orientação e origem disponível. “Impede posição, avanço ou importação” não significa bloquear todo o acervo: o efeito específico está descrito no cartão. Sem confirmação do corte ou sem relatório salvo, a página informa a limitação; erro ao carregar fonte/competição mostra falha segura em vez de lista vazia.

## Proveniência e versões

A publicação permanece separada da última tentativa: o leitor busca o último relatório `succeeded`/`unchanged` associado ao `source_version_id` ativo, mesmo que esteja fora das oito tentativas recentes. Erros de uma candidata recusada não substituem os avisos da publicação e não são associados ao álbum que ocupa a mesma linha no arquivo ativo.

Álbuns carregados do banco recebem `provenance` após o JSON da fonte: versão e arquivo de `last_seen_source_version_id`, além do localizador imutável em `source_album_records`. Assim um ausente conserva a versão de sua última ocorrência. Sem registro suficiente, não se inventa versão/linha; a ausência de metadados é indicada. Para participantes congelados, quando aplicável, aparece também o arquivo/linha do corte. Resultados usam a versão publicada, a aba e a linha que vieram da extração ativa.

Os campos são somente leitura. Nenhuma pendência nova é persistida: ao consultar após sincronização, a central recalcula e deixa de mostrar condições corrigidas. Tentativas anteriores continuam preservadas no histórico de importação. Não há botão de “resolver” que esconda um conflito sem correção da origem.

## Busca, cópia e correção

Filtros de tipo, origem e impacto combinam com busca por álbum/artista/motivo/linha. A URL mantém `q`, `tipo`, `origem`, `impacto` e `limite`; parâmetros inválidos são ignorados. O botão Voltar do navegador preserva o contexto ao consultar uma avaliação. A listagem começa com vinte cartões, com expansão; as contagens usam todos os itens e a cópia global inclui todos os resultados dos filtros.

**Copiar orientação desta pendência** ou **Copiar pendências filtradas** prepara texto para colar no chat que gera o XLSX, com evidências, efeito, orientação e pedido de nova versão sem sobrescrever a anterior. A cópia é local e só ocorre por clique. Se o navegador não permitir clipboard, o texto está disponível em um campo selecionável, inclusive por teclado/celular. O aplicativo não envia mensagens ao chat e não escreve no Drive.

Corrigir dados contraditórios pode remover a pendência na importação seguinte. Empate irredutível precisa de decisão explícita compatível com o regulamento; simplesmente preencher uma posição derivada no XLSX não cria critério de desempate nem muda a regra do app. A central não presume participação, vencedor ou decisão e não altera notas, seeds, ranking ou resultados.

O aplicativo consome decisões manuais somente da aba estruturada `Desempates Top 50`, com o grupo completo, contexto do empate e confirmação explícita. A orientação do empate e a de cada aviso de posição do grupo incluem o contrato mesmo quando copiadas isoladamente. Enquanto não houver decisão confirmada e válida, todo o grupo mantém `Rank Top 50 provisório` em `Albuns 2026` e `Pos.` em `Top 50` vazios; nota, fase, bônus e índice permanecem. Retirar posições atribuídas manualmente remove os avisos derivados, mas conserva a pendência do empate. Texto histórico não é aplicado como decisão.

O texto copiado separa correções de dados, confirmações do proprietário e mudanças necessárias no aplicativo. Ele exige evidências, coerência entre as duas abas e relato do que foi corrigido e do que continua pendente. Uma nova versão é solicitada quando há correção aplicável; inventar campos, regras ou aprovações para declarar resolução é vedado. O contrato está em [Desempates manuais do Top 50](top50-manual-decisions.md). Decisões inválidas, pendentes, desatualizadas ou conflitantes geram apontamentos com a origem publicada; uma decisão válida remove o empate do corte e aparece no Top 50 com sua confirmação. A migração 0008 é necessária; antes dela, a central informa que a leitura está indisponível.

## Validação

Testes unitários: composição dos grupos, severidade/efeitos, separação da tentativa recusada, correspondência por aba/linha, todas as identidades do empate no corte, duplicidades/orfandade, resultados futuros, proveniência de ausentes, recálculo após correção, filtros e texto copiável. Autorização precede leituras e falhas não expõem exceções.

Integração PGlite: metadados não podem ser substituídos pelo JSON da planilha; relatórios da publicação e de candidata recusada ficam separados; relatório bem-sucedido mais recente substitui o anterior; fonte alheia não vaza apontamentos. Chromium cobre quatro larguras, menu, busca/filtros/retorno, clipboard e cópia manual, ausência de links incorretos e remoção após correção fictícia. Build e E2E HTTP verificam a rota privada.

A consulta autenticada em produção deve ser conferida após o deploy. Não houve leitura do banco pessoal nesta entrega; evidências de testes são exclusivamente fictícias.
