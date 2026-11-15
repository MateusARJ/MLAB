# Analyze: Aviso de Mão Levantada Clicável e Sincronizado com a Fila

Feature: `031-aviso-mao-levantada`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-3101 a C-3104) e plan concordam: aviso em `zIndex: 20`; aviso some quando a mão dele é abaixada por
  qualquer caminho, mesmo com outras mãos na fila; abrir o painel só oculta; versão PATCH.
- A US-11 da 003 já exige o aviso que leva à turma; o código deixou de cumprir o critério. Nada upstream muda além de
  uma nota.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-3101 | T3101 |
| RF-3102 | T3101 |
| RF-3103 | T3102, T3103 |
| RF-3104 | T3102, T3103 |
| RF-3105 | T3102, T3103 |
| RF-3106 | T3102 |
| RNF-3101 | T3101 (teste de camada), T3102 (função pura) |
| RNF-3102 | todas: nenhuma dependência nova |

## 3. Contratos

- Nenhuma mudança. `hand-updated`, `participants-update` e `lower-hand` seguem como em `003/contracts/`.

## 4. Tarefas fora do Scope Lock

Nenhuma. T3101 a T3103 tocam só os cinco arquivos do renderer listados; a T3104 só documentos e `package.json` via
`npm run bump`.

## 5. Riscos

- Clique real não coberto por teste automatizado (sem Playwright no desktop): mitigado pelo teste de camada e pela
  verificação manual da T3104.

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T3101.
