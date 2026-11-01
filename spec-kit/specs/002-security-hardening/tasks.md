# Tasks: Endurecimento de Segurança

Feature: `002-security-hardening`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: DONE (T201–T209; smoke manual pendente)

Regra de cada task: rodar `go test -count=1 ./...` (backend) e `npx turbo run test --force` antes do `[x]`.
Itens da matriz de smoke citados são validação manual do responsável (registrar em `docs/metrics/baseline-2026-11.md`).

### T201 — S1: segredo JWT aleatório por execução
[x] T201
Allowed Paths: `apps/backend/cmd/server/**`, `apps/backend/internal/auth/**`, `apps/desktop/src/main/main.ts`
Prohibited Paths: `apps/web/**`, `apps/backend/internal/webrtc/**`, `packages/**`
Checks:
- [x] Constante `dev-secret-key-12345` removida do backend e do desktop.
- [x] Sem `JWT_SECRET`, o backend gera 32 bytes aleatórios; duas inicializações geram segredos diferentes; o valor não é logado.
- [x] Desktop repassa `JWT_SECRET` ao backend só se vier do ambiente.
- [x] Suítes verdes: Go 6/6, web 25/25, desktop 82/82 (`main_test.go`: `TestEnsureJWTSecret_*`).
- [ ] Smoke A1, A2, A10, A16 — **pendente de execução manual** pelo responsável (o agente não executa GUI/LAN).

### T202 — S2: chave de host na sessão do professor
[x] T202
Depends On: T201
Allowed Paths: `apps/backend/internal/auth/**`, `apps/backend/cmd/server/**`, `apps/desktop/src/main/**`, `apps/desktop/src/renderer/services/**`, `apps/desktop/src/test/setup.ts`, `apps/desktop/src/env.d.ts`, `scripts/dev.js`, `turbo.json`
Prohibited Paths: `apps/web/**`, `apps/backend/internal/webrtc/**`, `packages/ui/**`
Checks:
- [x] Main do Electron gera `MLAB_HOST_KEY` (salvo se vier do ambiente), repassa ao backend embarcado e expõe `getHostKey()` via IPC `get-host-key`.
- [x] `scripts/dev.js` gera a chave para o turbo; `turbo.json` repassa `MLAB_HOST_KEY`.
- [x] `POST /auth/session` exige `X-MLab-Host-Key` (tempo constante); sem chave configurada → `403`; header permitido no CORS.
- [x] `services/auth.ts` envia o header.
- [x] Testes: sem header/errado/backend sem chave → `403`; correto → `200` com `role: professor`; serviço do desktop envia o header.
- [x] Suítes verdes: Go 6/6, web 25/25, desktop 88/88 (`auth_test.go`: `TestSessionEndpoint*`; `hostKey.test.ts`; `services/auth.test.ts`). `tsc` do desktop sem erro novo (14 pré-existentes).
- [ ] Smoke A1, A2, A3, A16 e `curl -X POST http://<ip>:8080/auth/session` de outra máquina → `403` — **pendente de execução manual**.

### T203 — S3: remoção completa do login do professor
[x] T203
Depends On: T202
Allowed Paths: `apps/backend/internal/auth/**`, `apps/backend/internal/room/**` (apenas testes), `apps/backend/internal/signaling/**` (apenas testes), `apps/backend/cmd/server/**`, `apps/backend/go.mod`, `apps/backend/go.sum`, `packages/types/src/index.ts`, `apps/desktop/src/renderer/services/auth.ts`, `README.md`
Prohibited Paths: `apps/web/**`, `apps/backend/internal/webrtc/**`, `apps/backend/internal/chat/**`
Checks:
- [x] Removidos: rota e handler `POST /auth/login`, `store_inmemory.go`, `Professor`, `PasswordHash`, `LoginRequest`, `Store`, bcrypt.
- [x] `LoginResponse` → `SessionResponse` (mesmo JSON) no Go e no TS; `SessionRequest { name }` no TS.
- [x] Claims do JWT inalteradas.
- [x] `go mod tidy`; teste `POST /auth/login` → `404`.
- [x] `grep -rniE "auth/login|bcrypt|professor123|LoginRequest|PasswordHash" apps packages` vazio fora de `dist/`.
- [x] Suítes verdes: Go 6/6, web 25/25, desktop 88/88 (`TestLoginEndpointRemoved`). `x/crypto` permanece só como indireta do Pion.
- [ ] Smoke A0, A1, A2, A3 — **pendente de execução manual**.

### T204 — S4: autenticação e limites dos arquivos
[x] T204
Depends On: T203
Allowed Paths: `apps/backend/internal/room/**`, `apps/backend/internal/signaling/**`, `apps/backend/cmd/server/**`, `apps/web/src/hooks/useWebRTCSubscriber.ts`, `apps/web/src/hooks/useWebRTCSubscriber.test.ts`, `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`, `apps/web/src/services/**`, `apps/desktop/src/renderer/pages/Room.tsx`
Prohibited Paths: `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`, `packages/ui/**`
Checks:
- [x] Listagem e download exigem token (`Authorization` ou `?token=`) da sala; slug resolvido para UUID.
- [x] `MaxBytesReader`, teto por sala (300 MB / 50 arquivos, ENV) → `413`; `X-Content-Type-Options: nosniff` no download.
- [x] Arquivos liberados da memória no encerramento da sala.
- [x] Web envia token na listagem e no `href`; desktop envia token na listagem.
- [x] Testes: sem token `401`; outra sala `403`; aluno `200`; dono `200`; acima do teto `413`; liberação no close.
- [x] Suítes verdes: Go 6/6 (`files_test.go`, `TestHub_OnClosedCallback_*`), web 30/30 (`api.test.ts`, teste de token no hook), desktop 88/88; `tsc` sem erro novo.
- [ ] Smoke A13 (upload, listagem e download no desktop e no celular) — **pendente de execução manual**.

### T205 — S5: `/rooms/active` determinístico
[x] T205
Depends On: T204
Allowed Paths: `apps/backend/internal/room/**`
Prohibited Paths: `apps/desktop/**`, `apps/web/**`, `apps/backend/internal/webrtc/**`
Checks:
- [x] Prioridade `publishing` > `waiting`; desempate por `CreatedAt` mais recente.
- [x] Teste com duas salas ativas.
- [x] Suítes verdes: Go 6/6 (`TestGetActiveRoom_*`, 50 iterações contra a ordem aleatória do map).
- [ ] Smoke A9 — **pendente de execução manual**.

### T206 — S6: allowlist de origem no WebSocket e no CORS
[x] T206
Depends On: T205
Allowed Paths: `apps/backend/cmd/server/**`, `apps/backend/internal/signaling/**`, `apps/backend/internal/room/**`
Prohibited Paths: `apps/desktop/**`, `apps/web/**`, `apps/backend/internal/webrtc/**`
Checks:
- [x] `isAllowedOrigin` aceita: Origin vazio, `null`, `file://`, mesmo host, `localhost`/`127.0.0.1`/`[::1]` em qualquer porta, `mlab.local`/`mlab-*.local`, hosts de `NGROK_URL`/`PUBLIC_URL`, IP de rede detectado.
- [x] `CheckOrigin` e `corsMiddleware` usam a função; CORS reflete a origem permitida com `Vary: Origin`.
- [x] Matriz de origens em teste.
- [x] Suítes verdes: Go 6/6 (`origin_test.go` com 19 origens, `TestCorsMiddleware_*`, `TestSignalingSecurity_CheckOriginAllowlist`). Implementada como `room.IsAllowedOrigin` (também aceita `BASE_URL`).
- [ ] Smoke A2, A9, A15, A16, A17 (LAN, `mlab.local`, ngrok, celular) — **pendente de execução manual**. Se algum cenário legítimo falhar, acrescentar a origem à allowlist; nunca voltar a aceitar qualquer origem.

### T207 — S7: endurecimento do Electron
[x] T207
Depends On: T206
Allowed Paths: `apps/desktop/src/main/**`, `apps/desktop/src/test/setup.ts`
Prohibited Paths: `apps/backend/**`, `apps/web/**`, `apps/desktop/src/renderer/media/**`
Checks:
- [x] `setWindowOpenHandler` nega janelas; http/https abertos com `shell.openExternal`; `will-navigate` bloqueado para fora da origem do app (janela principal e overlay).
- [x] `copyToClipboard` passa a usar IPC `write-clipboard-text` (API exposta inalterada).
- [x] `sandbox: true` na janela principal e no overlay, sujeito ao gate C-203.
- [x] Suítes verdes: desktop 95/95 (`navigationGuard.test.ts`); `tsc` sem erro novo; `electron-vite build` OK; preload compilado só faz `require("electron")`.
- [ ] Smoke A4–A8, A11, A12 no app empacotado (Windows e Linux) — **pendente de execução manual**. Gate C-203: se algum item falhar por causa do sandbox, reverter só o commit do sandbox e registrar exceção no `converge.md`.

### T208 — S8: remover caminho absoluto local
[x] T208
Depends On: T207
Allowed Paths: `apps/desktop/src/main/main.ts`
Prohibited Paths: `apps/backend/**`, `apps/web/**`, `packages/**`
Checks:
- [x] Removido `c:\Users\User\Documents\mlab\...` da busca do backend.
- [x] Suítes verdes: desktop 95/95; nenhum caminho absoluto de máquina no código (`grep`).
- [ ] Smoke A1 em dev e empacotado — **pendente de execução manual**.

### T209 — S9: limite de frequência de `request-keyframe` por aluno
[x] T209
Depends On: T208
Allowed Paths: `apps/backend/internal/signaling/**`, `spec-kit/specs/001-screen-share-core/contracts/signaling.md` (nota de vigência)
Prohibited Paths: `apps/backend/internal/webrtc/**`, `apps/desktop/**`, `apps/web/**`, `packages/**`
Checks:
- [x] Pedido do professor sempre repassado à SFU.
- [x] Aluno: rajada de 3 pedidos repassados; o 4º imediato é descartado sem erro; após 1 s, um novo pedido passa.
- [x] Limite independente por aluno (um aluno no limite não afeta outro).
- [x] Contrato `signaling.md` registra que alunos também enviam `request-keyframe` e o limite.
- [x] Suítes verdes: Go 6/6 (`keyframe_limit_test.go`: limiter, cadência do watchdog, professor sem limite, limite por aluno, roteamento pelo hub), web 30/30, desktop 95/95.
- [ ] Smoke A3 e A20 (aluno entra e recupera vídeo após troca de fonte) — **pendente de execução manual**.
