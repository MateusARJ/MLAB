# Analyze: Correções da Matriz de Smoke e Remoção de Legado

Feature: `005-correcoes-smoke`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. A feature implementa a RN-04 e o §10b do plan da 001 sem alterar seus textos. A matrícula fica fora do
escopo (C-504), em linha com RF-11 da 001 e US-17 da 003.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-501 | T501 |
| RF-502 | T501 |
| RF-503 | T502 |
| RF-504 | T503 |
| RF-505 | T504, T505 |
| RNF-501 | T501 |

| Item da matriz | Onde |
|---|---|
| A19 | T501 (smoke), T502 (E2E) |
| A20 | T503 (E2E) |

## 3. Contratos

Nenhum contrato alterado. `4001 Duplicate Session` já está na RN-04 da 001 e na ADR 0004 §2.1.C; a mensagem `error`
com `CHAT_RATE_LIMITED` já está em `001/contracts/media-session.md`. Os tipos removidos de `packages/types` não
correspondem a contrato vigente.

## 4. Tarefas fora do Scope Lock

Nenhuma. Os paths de cada task estão dentro de Allowed Paths do plan; `Join.tsx`, `auth/jwt.go` e `internal/webrtc`
estão proibidos.

## 5. Riscos

- Fechamento com código pode afetar outros fechamentos — mitigado por RNF-501 (código só quando definido).
- Remoção de exports — mitigada por build e typecheck do monorepo.

## 6. Resultado

- [ ] FAIL
- [x] PASS — próxima execução: T501.
