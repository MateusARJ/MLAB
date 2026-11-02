# Analyze: Correções da Matriz de Smoke e Remoção de Legado

Feature: `005-correcoes-smoke`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. A feature implementa a RN-04 e o §10b do plan da 001 sem alterar seus textos. A emenda de 2026-11-02
(RF-506, C-506, T507) foi propagada a spec, clarify, plan, checklist e tasks; não contradiz a 001 (o chat continua
pelo mesmo WebSocket e contrato) nem RF-504. A matrícula fica fora do
escopo (C-504), em linha com RF-11 da 001 e US-17 da 003.

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-501 | T501 |
| RF-502 | T501 |
| RF-503 | T502 |
| RF-504 | T503 |
| RF-505 | T504, T505 |
| RF-506 | T507 |
| RNF-501 | T501 |

| Item da matriz | Onde |
|---|---|
| A19 | T501 (smoke), T502 (E2E) |
| A20 | T503 (E2E), T507 (sem retry) |

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
- `isChatReady` preso em falso com troca de WS — mitigado por atualizar só pelo WS corrente e teste do hook.

## 6. Resultado

- [ ] FAIL
- [x] PASS — revalidado em 2026-11-02 após a emenda RF-506/T507; próxima execução: T502/T503 (E2E) e T507.
