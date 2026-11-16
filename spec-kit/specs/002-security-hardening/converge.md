# Converge: Endurecimento de Segurança

Feature: `002-security-hardening`
Mode: READ-ONLY sobre o código (só este arquivo é escrito)
Data: 2026-11-01
Commit avaliado: `d409da1` (branch `fix/security-hardening`; revisão após a emenda S9)
Status: OPEN

## Entradas

- `spec.md`, `clarify.md`, `plan.md`, `tasks.md` (T201–T209)
- Suítes: `go test -count=1 ./...` (6/6 pacotes), `turbo run test build --force` (8/8 tasks; web 30/30, desktop 95/95), `npm run spec:check` (3/3 PASS)

## 1. Requisitos atendidos

| Requisito | Evidência |
|---|---|
| RNF-SEC-01 segredo JWT aleatório | `cmd/server/main.go` (`ensureJWTSecret`); `main_test.go` (`TestEnsureJWTSecret_*`); constante removida do desktop |
| RNF-SEC-02 chave de host | `auth/handler.go` (`validHostKey`, `subtle.ConstantTimeCompare`); `desktop/src/main/hostKey.ts`; IPC `get-host-key`; `scripts/dev.js`, `turbo.json`; testes `TestSessionEndpoint*`, `hostKey.test.ts`, `services/auth.test.ts` |
| RNF-SEC-03 sem login | `store_inmemory.go` apagado; `POST /auth/login` → 404 (`TestLoginEndpointRemoved`); `LoginRequest` removido; `SessionResponse` |
| RNF-SEC-04 arquivos | `room/files.go` (`authorizeFileRead`, limites, nosniff, `ReleaseRoomFiles`); hub `onClosed`; `files_test.go`; `TestHub_OnClosedCallback_*`; web/desktop enviam token |
| RNF-SEC-05 sala ativa | `room/store.go` (`GetActiveRoom`, `activeRoomRank`); `TestGetActiveRoom_*`; status real vindo do hub e `reconnecting` entre `publishing` e `waiting`: `TestSyncStatusFromSession`, `hub_status_test.go` (035) |
| RNF-SEC-06 origem | `room/origin.go` (`IsAllowedOrigin`); `CheckOrigin` e `corsMiddleware`; `origin_test.go`, `TestCorsMiddleware_*`, `TestSignalingSecurity_CheckOriginAllowlist` |
| RNF-SEC-07 Electron | `navigationGuard.ts` (+ teste); IPC `write-clipboard-text`; `sandbox: true` nas duas janelas |
| RNF-SEC-08 caminho absoluto | removido de `main.ts` |
| RNF-SEC-09 keyframe de aluno | `signaling/keyframe_limit.go` (`keyframeLimiter`, `onRequestKeyFrame`); `keyframe_limit_test.go`; contrato `001/contracts/signaling.md` |

## 2. Requisitos parcialmente atendidos

| Requisito | O que falta |
|---|---|
| RN-S01 (fluxo legítimo intacto) | Matriz de smoke A0–A20 **não executada** — exige GUI, dois computadores e celular. Responsável deve executar antes do merge. |
| RNF-SEC-07 sandbox | Validado por build e testes; execução no app empacotado pendente (gate C-203). |
| RNF-SEC-09 | Smoke A4 e A10 pendentes: confirmar que o aluno ainda recupera o vídeo após troca de fonte e congelamento. |

## 3. Divergências

Nenhuma entre código e spec/contratos desta feature.

## 4. Código sem requisito

Nenhum.

## 5. Testes faltantes / limitações de verificação

- `go test -race` não executado: o ambiente não tem gcc/cgo (`-race requires cgo`). Recomendado rodar no CI.
- `@mlab/desktop#lint` (`tsc --noEmit`) falha com 14 erros **pré-existentes** (baseline); nenhuma task desta feature aumentou a contagem.
- Instalador (`npm run make:win`) não gerado pelo agente: o script `premake` incrementa a versão do pacote.

## 6. Novas tasks necessárias

- Nenhuma nesta feature. S9 foi aprovada e entregue como T209 (C-204: limite de frequência, não bloqueio por papel).
- O teste de carga real foi entregue na 001 (T034); o achado de desempenho A-1 está em `001/converge.md`.

## 7. Resultado

- [x] OPEN — implementação completa e testada; pendências de validação manual e decisões listadas acima.
- [ ] CONVERGED
