# Analyze: Matriz de Smoke de Regressão

Feature: `004-smoke-regression`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. Spec, clarify, plan e tasks seguem o plano híbrido aprovado em 2026-11-01.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-401 | T402, T403 |
| RF-402 | T404, T405, T406 |
| RF-403 | T407 |
| RF-404 | T408, T409 |
| RNF-401 | T402 (build tag), T404 (comando próprio) |
| RNF-402 | T402 |
| RNF-403 | T401 |

| Item da matriz | Onde |
|---|---|
| A0, A19, A20 | T403 |
| A3, A9, A10, A13, A14, A15, A18 | T403 (servidor) + T406 (interface) |
| A1, A2, A4–A8, A11, A12, A16 | T407 |
| A17 | T407 (N/E sem conta ngrok — C-404) |

## 3. Contratos

Nenhum contrato novo ou alterado. Os testes seguem `001/contracts/{auth,room-api,signaling}.md` e
`003/contracts/{signaling-classroom,files}.md`. Divergência conhecida: A19 (4001) — C-403.

## 4. Tarefas fora do Scope Lock

Nenhuma. A única task que toca produção (T401) está em `apps/backend/cmd/server/**`, permitido no plan.

## 5. Riscos

- Extração de `newServer` (T401) é o único risco de regressão do produto — mitigado pela suíte existente.
- E2E com WebRTC pode oscilar em loopback — mitigado por esperas por estado e 1 retry.

## 6. Resultado

- [ ] FAIL
- [x] PASS — próxima execução: T401.
