# ADR 0007 — Versionamento semântico do MLab

Status: APROVADA
Data: 2026-11-02
Feature impactada: todas (processo de entrega); referência operacional em `docs/versionamento.md`

## Contexto

Até a versão 1.5.7, a versão do MLab era incrementada automaticamente pelo `premake` a cada `npm run make`, sem
commit nem release, e o script `npm run bump` seguia uma regra decimal (cada dígito de 0 a 9, com virada). Os pacotes
do monorepo estavam em versões diferentes (app e raiz em 1.5.7; web, backend, types e ui em 1.5.0), e a última release
publicada é a `v1.5.5`. A versão não dizia nada sobre o tipo de mudança, e agentes de IA não tinham regra para decidir
quando e quanto incrementar.

## Problema

Definir um esquema de versão que comunique o impacto de cada entrega (correção, funcionalidade, quebra de
compatibilidade) e que um agente de IA consiga aplicar sozinho, de forma verificável, a cada PR.

## Opções consideradas

### Opção A — Manter a regra decimal com incremento por release

Simples, mas o número só indica ordem; não diferencia correção de quebra de compatibilidade.

### Opção B — Versionamento semântico com incremento no PR da mudança

`MAJOR.MINOR.PATCH` com escopo explícito por nível; cada PR que muda o app declara e aplica o nível. A release
publica a versão acumulada.

### Opção C — Versionamento semântico calculado só na release

O nível sai do maior impacto acumulado desde a última release. Menos commits de versão, mas a classificação fica longe
da mudança e depende de reconstruir o histórico.

## Decisão

Opção B, por decisão do responsável pelo produto em 2026-11-02:

- versão única do monorepo, iniciando em **1.7.1**;
- versionamento semântico 2.0.0, com o escopo de MAJOR, MINOR, PATCH e "sem incremento" definido em
  `docs/versionamento.md` §2;
- cada PR para a `development` que altera o que é entregue inclui um incremento (`npm run bump -- <nível>`, commit
  `chore(release): versao X.Y.Z`); o nível é registrado no `converge.md` e no PR;
- builds nunca alteram a versão; a publicação é a tag `vX.Y.Z` na `main`, feita pelo responsável;
- mudanças incompatíveis são marcadas com `!` no tipo do commit.

## Consequências

### Positivas

- O número da versão informa o impacto da entrega para professores e alunos.
- Agentes de IA têm regra objetiva e verificável (`npm run version:check`) para versionar.
- Pacotes e `package-lock.json` deixam de divergir.

### Negativas

- PRs paralelos podem conflitar nos `package.json`; a resolução é refazer o `bump` a partir da `development`
  (`docs/versionamento.md` §3, passo 5).
- Versões intermediárias não publicadas aparecem entre releases.

## Impacto em specs/contracts/tasks

- `AGENTS.md` ganha a seção de versionamento e a marcação `!` para quebra de compatibilidade.
- Templates do Spec Kit: `converge-template.md` registra o "Impacto de versão"; `plan-template.md` registra o
  impacto previsto; `context-loading.md` carrega `docs/versionamento.md` no converge.
- Template de PR ganha o campo "Impacto de versão".
- Nenhum contrato de runtime muda.

## Aprovação humana

- Responsável: dono do produto (MateusARJ)
- Data: 2026-11-02
