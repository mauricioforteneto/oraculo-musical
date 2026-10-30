# Modelo de dados proposto

Modelo lógico implementado pelas migrações 0001–0002, ainda sem aplicação validada em banco hospedado. Usar UUIDs internos, instantes `timestamptz`, notas em decimal exato e restrições SQL. Regras são versionadas por temporada; mudança em temporada futura não altera 2026.

## Entidades e responsabilidades

| Entidade | Conteúdo e invariantes |
| --- | --- |
| source | Pasta e temporada configuradas no backend; identificação privada |
| source_version | ID Drive, nome, versão numérica, modifiedTime, SHA-256 dos bytes, hash canônico dos registros e versão do parser; imutável |
| sync_run | Início/fim, solicitante, status, versão candidata/publicada, contagens, código de erro; tentativa sem arquivo também é registrada |
| source_record | Versão, bloco/aba, linha/células quando verificadas, hash de conteúdo e fatos originais necessários; acesso privado |
| album | Artista creditado, título e edição explícita quando conhecida; não fundir edições automaticamente |
| source_identity | Associação única da chave de origem ao album; independente do número da linha ou posição |
| season_entry | Álbum na temporada, datas informadas de escuta/avaliação/registro, ausência na última fonte; uma entrada por álbum/temporada |
| original_evaluation | Quatro pilares opcionais legados, total original obrigatório, proveniência e estado de completude; imutável |
| evaluation_revision | Avaliação anterior, novos valores, justificativa musical, data/proveniência; não substitui original |
| competitive_promotion | Tipo 80*, fase/origem e proveniência; não é nota /100 |
| phase_participation | Temporada, fase, etapa alcançada, resultado e evidência; não inferir inscrição pela faixa atual |
| phase_score | Participação, escala, total e notas de faixas quando presentes; total não inventa notas individuais |
| seed_snapshot | Temporada, estado provisório/congelado, seed, participante e evento de congelamento; congelado é imutável |
| match | Rodada, participantes, quatro pilares /5 por lado, total /20, vencedor e decisão de desempate |
| bracket_slot | Relações fixas entre partidas depois do reseeding; zebra herda posição |
| annual_ranking | Projeção por snapshot, nota original e posição/grupo de empate; distinta de rank informado |
| top50_projection | Elegibilidade, melhor fase, bônus, índice, posição e pendências; índice e posição distintos |
| import_issue | Execução, entidade/linha, código, severidade, valor informado e descrição; sem segredos em logs |
| publication | Ponteiro para snapshot válido; troca atômica na transação |

A migração 0002 adiciona snapshots imutáveis por versão, estado corrente de cada identidade (incluindo ausência explícita), ponteiro de publicação e lease por fonte. A sincronização troca o ponteiro e grava os fatos do lote na mesma transação; consultas usam apenas o ponteiro publicado.

Backlog e reescutas terão registros de origem próprios, sem interface de edição. Last.fm usará scrobble e checkpoint separados; não criar avaliação a partir de scrobbles.

## Identidade adotada para o MVP após auditoria do XLSX

Não foi observada coluna de ID estável nem coluna própria de edição. Chave de origem: temporada + artista creditado + título recebido + edição explícita somente se uma coluna verificável vier a existir. Normalizar Unicode NFC e remover apenas espaços externos para a chave. Preservar acentos, pontuação, caixa, espaços internos e nomes originais; não usar rank, seed ou número de linha como chave.

Detectar colisões exatas como erro, mesmo se as notas coincidirem. Semelhança por caixa/espaços internos gera alerta, nunca fusão. Se uma versão remove uma identidade e introduz outra, bloquear a publicação para esclarecer possível renomeação; ausência isolada preserva registro e gera alerta. Não inferir uma edição a partir de observações. Se um ID persistente surgir na fonte, adotá-lo exigirá mapeamento auditável das identidades já conhecidas; o app não escreverá no Excel.

## Notas e alterações

- Original total entre 0 e 100; cada pilar, quando presente, entre 0 e 25. Quatro pilares completos exigem soma exata. Sem conversão de vazio para zero.
- Incrementos permitidos dependem de P06; não arredondar valores para satisfazer regra não confirmada.
- Para legado, armazenar total original e pilares nulos com motivo. Texto livre fica como evidência; extrair pilares somente por regra determinística auditada que reconheça contexto original, quatro números e soma, sem escolher silenciosamente entre vários conjuntos.
- Mudança posterior de `Nota Original` abre conflito: não atualizar original. Só registrar revisão se houver justificativa inequívoca da fonte e contrato validado de revisão; até lá rejeitar lote com erro explicativo. Revisões não afetam rankings ou seed congelado sem P04.
- Nome/faixa/observação e fatos competitivos alterados produzem nova versão de registro. Correção de fato histórico mantém antes/depois e proveniência; alteração de resultado congelado exige manutenção explícita, não recálculo retroativo silencioso.
- Não presumir original igual a `Nota` quando `Nota Original` estiver vazia. Rejeitar avaliação obrigatória incompleta.

## Atomicidade e idempotência

Uma execução adquire lease por fonte, com expiração e token de posse. Download/validação ficam fora da transação. Na publicação, lock da fonte, verificar lease, versão anterior e unicidade da versão/hash, escrever histórico apenas para mudanças, calcular projeções e trocar publication em uma transação. Concorrência não pode publicar uma versão mais antiga sobre outra mais nova.

Arquivo já publicado sem mudança é `unchanged`; registrar tentativa, sem duplicar versões/avaliações. Falha de download ou validação é `failed`, com publication intacta. Versão mais alta inválida não autoriza fallback silencioso para outra: manter última versão publicada e informar erro. Versão inferior à publicada não causa rollback. Mesmo número de versão com bytes diferentes é conflito de fonte, não alteração silenciosa da versão.

Linhas ausentes ficam ativas no último estado conhecido e recebem indicador de ausência; não contam como exclusões. A publicação reflete esse fato e o ranking ainda as inclui até resolução explícita. Reaparecimento da mesma chave remove indicador de ausência sem criar nova avaliação.

Se houver crash após commit mas antes da resposta, a próxima leitura do sync_run/publication identifica o sucesso; reexecução é segura. Falha ao registrar tentativa por banco indisponível deve ser reportada sem fingir que o relatório foi salvo.

## Separação entre evidência e cálculo

O rank da fonte é preservado como `source_rank`; a posição anual é calculada por nota original. Promoção 80*, total do Play-in /25, total do Pré-playoff /25 e total de confronto /20 têm campos distintos. Faixa regular é classificação histórica, não estado atual da competição. Regras pendentes retornam motivo de indisponibilidade, não zero ou posição fictícia.

Não armazenar a mesma lista de avaliações como novos registros quando reaparece em indicadores, resumo ou chave. Relações dependem de identidade verificada; joins por aproximação ficam proibidos.

## Temporadas e regras

A configuração por ano, os adaptadores de campeonato, as rotas com `temporada`, a migração aditiva e o procedimento de ativação de 2027 estão em [temporadas.md](temporadas.md). A página privada de regras independe de uma fonte importada.
