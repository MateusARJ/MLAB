# Plan: Teste do Join Independente da Rede

Feature: `013-teste-ice-offline`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-131, C-132)

## 1. Summary

Só testes, em `apps/backend/internal/room/room_test.go`:

1. **`forceInternet(t, online)` (RF-131):** grava `cachedIsOnline = online` e `lastConnectivityCheck = time.Now()`
   sob `connectivityMu` e restaura os valores anteriores no `t.Cleanup`. Com o cache válido por 5 s,
   `IsInternetAvailable()` devolve o valor forçado sem abrir conexão; o join no teste leva milissegundos.
2. **`joinBySlug(t)`:** extrai de `TestJoinRoomBySlug` a montagem do store, da sala e do `POST
   /rooms/uniform-lima-4770/prof-1/join`; devolve a `JoinResponse` e o corpo bruto (para conferir o JSON `[]`).
3. **`TestJoinRoomBySlug`:** mantém as asserções de token, `RoomID` e `WsURL`; fixa `STUN_URL` vazio e a internet
   disponível e confere o STUN padrão.
4. **`TestJoinIceServers` (RF-132):** tabela com os três ramos (STUN configurado sem internet; sem STUN com internet;
   sem STUN sem internet → `[]`).

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Isolamento da rede | cache de conectividade fixado no teste + `t.Setenv("STUN_URL", …)` | C-131 |
| Produção | sem mudança | C-131, RNF-131 |
| Paralelismo | nenhum teste de `internal/room` usa `t.Parallel()`; `t.Setenv` também impede | — |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| O teste depende de detalhe interno do cache (5 s) | se o cache mudar, o teste volta a usar a rede | helper único e comentado; mesmo pacote; teste offline falha de forma visível |
| Valor forçado vaza para outro teste | `TestIsInternetAvailable` loga valor falso | `t.Cleanup` restaura `cachedIsOnline` e `lastConnectivityCheck` |

## Scope Lock

### IN

- testes do join em `internal/room` e o helper de conectividade dos testes.

### OUT

- código de produção do backend; `internal/signaling`; desktop, web e pacotes.

### Allowed Paths

- `apps/backend/internal/room/room_test.go`
- `spec-kit/specs/013-teste-ice-offline/**`

### Prohibited Paths

- `apps/backend/internal/room/handler.go`, `apps/backend/internal/room/network.go` e demais `.go` não-teste de
  `apps/backend/internal/room/`
- `apps/backend/internal/signaling/**`, `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`
- `apps/backend/go.mod`, `apps/backend/go.sum`
- `apps/desktop/**`, `apps/web/**`, `packages/**`
- `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` (sem incremento de versão)

### Dependencies

- Nenhuma nova. Só a biblioteca padrão do Go (`testing`, `net/http/httptest`, `encoding/json`).

### Non-Goals

- tornar a verificação de internet injetável em produção;
- mudar a regra de `ice_servers` ou a de `signaling`;
- mudar `TestIsInternetAvailable`.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: autorização do join intocada.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: sem impacto de desempenho; o teste deixa de abrir conexão de rede.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: só dois helpers de teste, cada um com mais de um consumidor.
- [ ] Princípio VIII: converge ao final.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-10 | Correção só nos testes, fixando o cache de conectividade | C-131 |
| 2026-11-10 | `signaling` fora do escopo | C-132 |
| 2026-11-10 | Versão: sem incremento (só `test` e `spec-kit`) | AGENTS §13 |
