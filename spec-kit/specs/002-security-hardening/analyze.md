# Analyze: Endurecimento de Segurança

Feature: `002-security-hardening`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. A spec, o plan e as tasks seguem o plano de remediação aprovado (F5) e as ADRs 0005 e 0006.

## 2. Requisitos sem cobertura

| RNF | Task |
|---|---|
| RNF-SEC-01 | T201 |
| RNF-SEC-02 | T202 |
| RNF-SEC-03 | T203 |
| RNF-SEC-04 | T204 |
| RNF-SEC-05 | T205 |
| RNF-SEC-06 | T206 |
| RNF-SEC-07 | T207 |
| RNF-SEC-08 | T208 |

## 3. Contratos sem consumidor/produtor

Nenhum. `get-host-key` (produtor: main; consumidor: `services/auth.ts`); `X-MLab-Host-Key` (produtor: desktop; consumidor: backend).

## 4. Tarefas fora do Scope Lock

Nenhuma. Paths de cada task estão contidos nos Allowed Paths do plan.

## 5. Riscos de segurança/performance

- Allowlist de origem (T206) é a mudança com mais risco de regressão de rede — mitigado por teste de matriz e smoke completo de rede.
- Sandbox (T207) tem gate explícito (C-203).
- `request-keyframe` sem checagem de papel permanece aberto por decisão (C-204).

## 6. Resultado

- [ ] FAIL
- [x] PASS — próxima execução: T201.
