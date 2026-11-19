# ADR 0011 — Fluxo de entrega somente com a `main`

Status: APROVADA
Data: 2026-11-19
Feature impactada: todas (processo de entrega); altera o Princípio X da constitution e o fluxo de release da ADR 0007
Numeração: 0011 porque a 0008 está reservada pela edição HTTPS (`edicao/https-lan`).

## Contexto

Até aqui o MLab usava duas branches longas: toda entrega chegava à `development` por PR, e a `main` só recebia o PR
`development → main` de cada release. Na prática a `development` virou uma cópia atrasada da `main`: em 2026-11-19 ela
não tinha nenhum commit fora da `main` e estava 6 commits atrás. Cada release exigia um PR de sincronização sem conteúdo
próprio, e o build dos três sistemas só rodava nesse PR, longe da mudança que poderia quebrá-lo.

O repositório também vai ficar público. A proteção passa a ser feita na `main` pela ruleset `Rule-main`: PR
obrigatório com uma aprovação do responsável (que tem bypass para os próprios PRs), threads resolvidas, commits
assinados, merge commit e os três builds (`Build linux`, `Build windows`, `Build macos`) obrigatórios.

## Problema

Manter uma branch de integração que não acrescenta revisão nem isolamento, e que obriga um PR extra por release.

## Opções consideradas

### Opção A — Manter a `development`

Preserva o fluxo documentado, mas mantém o PR de sincronização e o build só na release.

### Opção B — Somente a `main`

Branches de entrega saem da `main` e voltam a ela por PR. Cada PR roda o build dos três sistemas. A release é só a tag.

## Decisão

Opção B, por decisão do responsável pelo produto em 2026-11-19:

- a `development` foi apagada (sem commits próprios) junto com a ruleset `Rule-development`;
- toda branch de entrega `<tipo>/<descricao>` sai da `main` atualizada e volta por PR para a `main`;
- o incremento de versão da ADR 0007 continua no PR da mudança, agora para a `main`;
- a release é a tag `vX.Y.Z` na `main` (ou o `workflow_dispatch` do `build-all.yml`), feita pelo responsável; não
  existe mais PR de release;
- commit direto na `main` continua proibido.

## Consequências

### Positivas

- Um PR a menos por release; a `main` é sempre o estado mais novo.
- O build de Windows, macOS e Linux valida cada PR, perto da mudança.

### Negativas

- Todo PR para a `main` consome os três builds do CI, inclusive os só de documentação.
- A `main` passa a conter versões intermediárias não publicadas; o que é release é marcado só pela tag.

## Impacto em specs/contracts/tasks

- `constitution.md`, Princípio X: entrega chega à `main`.
- `AGENTS.md` §13 e §15, `docs/versionamento.md`, README (releases e contribuição), `.gitmessage`,
  `.github/.gitmessage`, `.github/pull_request_template.md` e `spec-kit/.specify/commands/implement.md` trocam a
  `development` pela `main`.
- ADR 0007: o fluxo de release passa a ser o desta ADR; o versionamento não muda.
- Specs, converges e ADRs anteriores que citam a `development` são registros históricos e não mudam.
- Nenhum contrato de runtime muda.

## Aprovação humana

- Responsável: dono do produto (MateusARJ)
- Data: 2026-11-19
