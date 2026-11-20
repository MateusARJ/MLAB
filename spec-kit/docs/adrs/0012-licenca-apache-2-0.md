# ADR 0012 — Licença Apache 2.0

Status: APROVADA
Data: 2026-11-20
Feature impactada: nenhuma funcionalidade; muda a licença do repositório, os metadados do instalador e o README

## Contexto

O MLab adotou a Licença MIT em 2026-11-13 (commit `a8de913`). A MIT é curta, mas não diz nada sobre patentes,
contribuições de terceiros, uso da marca nem sobre o aviso de arquivos alterados. Com o repositório público, o
responsável quer termos explícitos para esses pontos.

Situação das versões publicadas em 2026-11-20:

| Versão | Licença no `LICENSE` | Release no GitHub |
| :--- | :--- | :--- |
| `v1.4.8`, `v1.5.4`, `v1.5.5` | nenhuma (arquivo não existia) | não |
| `v1.15.10`, `v2.1.5`, `v2.2.1`, `https-v2.2.1`, `v2.3.0` | MIT | sim |

Praticamente todo o histórico tem um único autor (MateusARJ). Os demais commits são automáticos (Dependabot,
github-actions) ou feitos por agente a pedido do responsável, então a troca não depende do consentimento de terceiros.

## Problema

Escolher a licença das próximas versões e decidir o que acontece com as versões já publicadas.

## Opções consideradas

### Opção A — Manter a MIT

É simples e bem conhecida, mas continua sem concessão de patente, sem regra para contribuições e sem cláusula de marca.

### Opção B — Apache 2.0

Permissiva como a MIT e explícita em patente (§3), contribuições (§5), marca (§6), aviso de alterações (§4b) e
`NOTICE` (§4d). É compatível com todas as dependências citadas no README (MIT, BSD-2, BSD-3, ISC, Apache-2.0, OFL 1.1).
Em troca, o texto é bem mais longo e a licença é incompatível com a GPLv2.

### Opção C — MPL 2.0

Exige que alterações nos arquivos do MLab sejam publicadas (copyleft por arquivo). Isso é mais restritivo do que o
responsável deseja.

### Versões antigas

- **Refazer as releases com o mesmo número**: exige outro commit na tag, e o mesmo número passaria a ter outro
  código e outro instalador, o que viola a ADR 0007. Também não revoga a MIT de quem já recebeu. Descartada.
- **Licença dupla declarada**: acrescenta a Apache às versões MIT sem tirar nada. O ganho é pequeno e exige
  declarações extras. Descartada.
- **Apagar as releases antigas do GitHub**: as versões antigas deixam de ser oferecidas, e o único download passa a ser
  a versão sob a Apache 2.0. Quem já baixou mantém a MIT da sua cópia. Escolhida.

## Decisão

Opção B, a partir da versão seguinte à 2.3.0:

1. `LICENSE` passa a conter o texto oficial e inalterado da Apache 2.0, e um `NOTICE` novo registra
   `MLab` / `Copyright 2026 Mateus de Araujo`.
2. `"license": "Apache-2.0"` em `package.json` (raiz) e `apps/desktop/package.json`. O instalador passa a embarcar
   `LICENSE` e `NOTICE`.
3. A primeira versão sob a Apache 2.0 é a 2.3.1 (PATCH), publicada pela tag `v2.3.1` feita pelo responsável.
4. Depois que a release `v2.3.1` estiver publicada e com os instaladores dos três sistemas, as releases
   `v1.15.10`, `v2.1.5`, `v2.2.1`, `https-v2.2.1` e `v2.3.0` são apagadas do GitHub, com seus instaladores. As tags git
   ficam, para preservar o histórico. Quem já baixou essas versões mantém a MIT da sua cópia.
5. As tags `v1.4.8`, `v1.5.4` e `v1.5.5`, publicadas sem licença e sem release, ficam como estão.
6. A edição HTTPS (`edicao/https-lan`) recebe a troca de licença pelo rebase habitual sobre a `main`; uma nova
   release HTTPS sob a Apache 2.0 é decisão do responsável, fora desta ADR.
7. Cabeçalhos SPDX por arquivo ficam fora desta decisão.

## Consequências

### Positivas

- Concessão explícita de patente e retaliação contra quem processar por patente.
- Contribuições externas entram automaticamente sob a Apache 2.0.
- O nome e o logo do MLab ficam fora da licença.
- O GitHub passa a oferecer só a versão sob a Apache 2.0.

### Negativas

- Texto de licença longo, e redistribuidores precisam repassar o `NOTICE` e marcar os arquivos alterados.
- Incompatível com projetos GPLv2.
- Apagar as releases é irreversível: os instaladores antigos somem e links para elas passam a dar 404.
- Cópias MIT já baixadas, forks e espelhos continuam sob a MIT.
- Até sair uma nova release HTTPS, a edição HTTPS fica sem instalador publicado.

## Impacto em specs/contracts/tasks

Nenhum requisito, contrato ou tarefa muda. A mudança toca `apps/desktop/package.json` (metadados do instalador) e
leva incremento PATCH (ADR 0007): não muda capacidade nem contrato.

## Aprovação humana

- Responsável: MateusARJ
- Data: 2026-11-20
