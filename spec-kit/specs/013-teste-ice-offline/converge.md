# Converge: Teste do Join Independente da Rede

Feature: `013-teste-ice-offline`
Mode: READ-ONLY sobre o código (só este arquivo e o `tasks.md` são escritos)
Data: 2026-11-10
Commit avaliado: `5b8b81f`
Status: CONVERGED

## Entradas

- `spec.md`, `clarify.md` (C-131, C-132), `plan.md`, `tasks.md` (T131–T133)
- código: `apps/backend/internal/room/room_test.go` (`forceInternet`, `joinBySlug`, `TestJoinRoomBySlug`,
  `TestJoinIceServers`); produção lida, sem mudança: `handler.go` (join), `network.go` (`IsInternetAvailable`)
- suítes: `go vet ./...` e `go test -count=1 ./...` em `apps/backend` (6 pacotes verdes)
- máquina da verificação (Windows 11, 2026-11-10): `IsInternetAvailable()` falso (TCP para `1.1.1.1:53` e
  `8.8.8.8:53` sem resposta), o mesmo cenário da issue #35

## 1. Requisitos atendidos

| Requisito | Evidência (arquivo, teste ou commit) |
|---|---|
| RF-131 | Antes (`9dd785d`): `TestJoinRoomBySlug` falhava nesta máquina com "esperava IceServers configurados" (`room_test.go:406`). Depois (`d5f88d2`): passa na mesma máquina, com `STUN_URL` vazio e a conectividade fixada por `forceInternet`; o teste não abre conexão de rede |
| RF-132 | `TestJoinIceServers` (`5b8b81f`): três subtestes verdes, `STUN_URL` configurada sem internet, STUN padrão com internet, `[]` sem internet (inclusive `"ice_servers":[]` no JSON) |
| RNF-131 | `git diff` da feature só toca `room_test.go` e `spec-kit/specs/013-teste-ice-offline/**`; `go.mod` intocado; `TestJoinRoomBySlug` caiu de 1,04 s (timeout da checagem de internet) para 0,03 s |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta | Evidência |
|---|---|---|
| — | — | nenhum |

## 3. Divergências (código ≠ spec/plan/contrato)

| Item | Spec/contrato diz | Código faz | Encaminhamento |
|---|---|---|---|
| — | — | — | nenhuma |

## 4. Código sem requisito (implementado fora de spec/task)

| Comportamento | Onde | Encaminhamento |
|---|---|---|
| — | — | nenhum |

## 5. Testes faltantes

- Verificação em máquina **com** internet não foi feita nesta sessão; como o teste fixa o cache de conectividade, o
  resultado não depende do estado real da rede (o ramo "com internet" é coberto por `forceInternet(t, true)`).
- `internal/signaling` (`buildIceServers`) continua sem teste da lista de ICE: fora do escopo (C-132).

## 6. Novas tasks necessárias

- Nenhuma na 013.

## 7. Desvios registrados

| Issue | Labels | Bloqueante? | Situação |
|---|---|---|---|
| — | — | — | nenhum |

Observações do analisador do editor (gopls/staticcheck) em código fora do escopo, sem defeito funcional e sem issue:
`mdns.go` `Close` tem a checagem redundante `firstErr == nil` no primeiro erro; `handler.go` `resolveBaseURL` não tem
mais chamadores; `room_security_test.go:33` passa contexto `nil`.

## 8. Impacto de versão

Classificação pelo escopo de `docs/versionamento.md` §2 (ADR 0007).

| Nível | Versão resultante | Justificativa |
|---|---|---|
| nenhum | 1.10.0 (sem mudança) | Só `test` e `spec-kit`; o instalador não muda. |

## 9. Resultado

- [ ] OPEN
- [x] CONVERGED — testes e código convergem com spec/plan/tasks; o teste do join não depende mais da rede.
