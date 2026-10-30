# Hallmark no Oráculo Musical

Skill de design instalada localmente neste projeto, em `.agents/skills/hallmark/`.
Essa pasta é ignorada pelo Git; a skill não é uma dependência da aplicação nem
dos testes no GitHub Actions. O repositório mantém apenas o instalador com versão
fixada, estas instruções e os resultados da auditoria.
O `AGENTS.md` orienta a leitura explícita quando o usuário solicitar Hallmark;
a descoberta automática pelo catálogo desta sessão Cloud não foi confirmada.

## Instalar em um novo ambiente Cloud

Na raiz do projeto, quando precisar usar a skill:

```sh
bash scripts/install-hallmark.sh
```

O instalador busca o commit oficial indicado abaixo, mantém a licença e copia
somente a skill para a pasta local ignorada. Requer Git, tar e acesso ao GitHub.
Se a pasta já existir, seus arquivos são preservados. A instalação não roda
durante `npm ci`, o build ou o GitHub Actions.

## Origem e versão

- Repositório: https://github.com/Nutlope/hallmark
- Versão: `2.0.0`.
- Commit fixado: `4f6a46c6dc325d40ab268c93e25c7b96676ebccd`.
- Origem: `skills/hallmark/` desse commit.
- Licença MIT preservada em `.agents/skills/hallmark/LICENSE`.
- Na restauração do pacote, os arquivos copiados foram conferidos pelo SHA-1 Git
  de cada blob. Essa cópia local contém instruções, metadados, referências,
  os 50 temas em texto e scripts; as fixtures de desenvolvimento foram omitidas.
- A cópia restaurada não contém as 50 imagens JPG de prévia dos temas, cujo
  download não concluiu no ambiente anterior. O instalador de um ambiente novo
  obtém o conteúdo oficial das referências no commit fixado.

Atualizações devem usar um commit explícito, revisar suas alterações e atualizar
esta referência. A instalação não usa atualização automática.

## Uso

Exemplos de pedidos nesta conversa:

- "Use Hallmark para auditar a página de álbuns, sem editar."
- "Use Hallmark para redesenhar a página de estatísticas."

Leia `SKILL.md` e as referências indicadas para cada tarefa. Redesign é uma ação
separada da instalação. As regras de negócio e a integração com a planilha
continuam sob as instruções do projeto.

## Verificação

Na raiz do repositório:

```sh
node .agents/skills/hallmark/scripts/refcheck.mjs --errors
node .agents/skills/hallmark/scripts/theme.mjs validate .agents/skills/hallmark/references/themes/*.md
node .agents/skills/hallmark/scripts/sloplint.mjs --help
```

Na instalação, a validação dos 50 temas passou. O `refcheck` encontrou um erro
no seu teste de subprocessos: neste sandbox, `spawnSync` de Node.js retorna
`EPERM` ao capturar a saída por pipe, inclusive ao executar o próprio Node.
Uma reprodução com saída em arquivo funcionou. O validador completo de
referências não foi aprovado; os arquivos originais da skill foram preservados.

As verificações estáticas usam Node.js 18 ou superior, já atendido pelo Node.js 24
do projeto. Auditorias de páginas usam `sloplint.mjs <arquivos> --scope app`.

Auditorias visuais com `--render` precisam de `puppeteer-core` e Chrome/Chromium.
Chromium está disponível neste ambiente; `puppeteer-core` ainda não está instalado.
Uma verificação estática não comprova a renderização no navegador.

Tanto a skill local `.agents/skills/hallmark/` quanto os artefatos `.hallmark/`
ficam fora do Git. Os scripts de terceiros são
excluídos do ESLint da aplicação e mantêm a implementação original do autor.
