# Analyze: E2E sem Recarregamento do Vite

Feature: `051-e2e-sem-reload-do-vite`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma entre os artefatos da feature.

- Spec, clarify (C-5101 a C-5103) e plan concordam: saída em `test-results`, pastas ignoradas no Vite, `I1` de
  regressão, smoke no novo caminho, sem incremento de versão.
- A matriz de smoke (004) e os cenários A0–A20 não mudam.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-5101, RF-5102, RF-5103, RF-5105 | T5101 |
| RF-5104 | T5102 |
| RNF-5101, RNF-5102 | T5102 |
| RNF-5103 | todas: nenhuma dependência nova |
| RNF-5104 | todas: nenhuma task de versão |

## 3. Contratos

- Nenhum contrato muda.

## 4. Tarefas fora do Scope Lock

Nenhuma. A T5101 toca só configuração do web e o `smoke-report.js`; a T5102 só o arquivo novo `infra.e2e.ts`; a T5103
só documentos da feature.

## 5. Riscos

- Padrões do Vite substituídos, falso verde do `I1` e smoke no caminho velho: mitigados no plan §3.

## 6. Resultado

- [ ] FAIL
- [x] PASS: a próxima execução é a T5101.
