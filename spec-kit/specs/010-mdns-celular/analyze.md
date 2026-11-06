# Analyze: Link `mlab.local` no Celular

Feature: `010-mdns-celular`
Mode: READ-ONLY
Status: PASS

## 1. Inconsistências

Nenhuma. Spec, clarify (C-101 a C-103) e plan concordam: correção só no responder mDNS do backend, pela troca para
`pion/mdns/v2`; links, contratos, web e desktop sem mudança; limites fora de escopo iguais nos três documentos. A
faixa de IDs 1xx não colide com outra feature (001 usa T0xx; 002 a 009 usam T2xx a T9xx).

## 2. Cobertura

| Requisito | Task |
|---|---|
| RF-101 | T101, T102, T104 |
| RF-102 | T102 (`TestMDNSServerLifecycleAndQuery`), T104 |
| RF-103 | T101, T102 |
| RNF-101 | T102 |
| RN-101 | T104 (link por IP e sala sem regressão) |

## 3. Contratos

Nenhum contrato muda. `mdns_link` (`001/contracts/room-api.md`) continua com o mesmo formato.

## 4. Tarefas fora do Scope Lock

Nenhuma. Todos os paths das tasks estão em `Allowed Paths` do plan; `handler.go`, `origin.go`, `network.go`,
`internal/webrtc/**`, `apps/web/**`, `apps/desktop/**` e `packages/**` estão proibidos.

## 5. Riscos

- Atualização transitiva de `golang.org/x/net`/`x/sys`: coberta pela suíte completa do backend na T102.
- A correção pode não bastar em alguma rede ou aparelho: T104 registra; plano B (ADR) na C-101.

## 6. Resultado

- [ ] FAIL
- [x] PASS: próxima execução, T101.
