# Analyze: Lint de Tipos do App Desktop sem Erros

Feature: `020-lint-tipos-desktop`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. Spec, clarify (C-2001 a C-2006) e plan concordam: remover o código morto, corrigir o tipo do canvas,
completar os mocks, deixar o selo de privacidade fora da UI, manter o canal IPC, rodar o lint no CI e subir PATCH.
A faixa `200x` não colide com outras features (busca em `spec-kit/` e `docs/`).

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-2001 | T2001 (main), T2002 (worker), T2003 (sala), T2004 (mocks e lint da raiz) |
| RF-2002 | T2003 (estado removido e asserção negativa) |
| RF-2003 | T2005 |
| RNF-2001 | T2002 (caminho sem cópia e lupa), T2003 (troca de janela), smoke na T2006 |
| RNF-2002 | todas: nenhuma dependência nova nem contrato alterado |

## 3. Contratos

Nenhum muda. `active-window-unauthorized` continua no contrato da 003, no preload e no main (C-2002).

## 4. Tarefas fora do Scope Lock

Nenhuma. Cada task toca só os Allowed Paths do plan; a T2006 só mexe em `package.json` via `npm run bump`.

## 5. Riscos

- Remoção no worker pegar algo vivo: limitada ao que o `tsc` aponta e ao que só isso usa; smoke manual com lupa e
  traços.
- Conflito com a 007 (`fix/mascara-cursor-janela`): já existente e independente desta feature.

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T2001.
