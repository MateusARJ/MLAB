# Plan: Nome do Módulo Go do Backend

Feature: `016-modulo-go-mlab`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-161 a C-163)

## 1. Summary

1. Trocar a diretiva `module` do `apps/backend/go.mod` para `github.com/MateusARJ/MLAB/apps/backend`.
2. Substituir o prefixo `github.com/screenshare/classroom/` pelo novo nos imports dos 10 arquivos `.go` da spec.
3. Rodar `gofmt` nos arquivos tocados, porque a ordenação dos grupos de import pode mudar.
4. Incrementar a versão (PATCH) no último commit do PR.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Caminho do módulo | `github.com/MateusARJ/MLAB/apps/backend` | C-161 |
| Substituição | textual e exata do prefixo; só imports e `go.mod` | — |
| Histórico | `docs/metrics/**` intocado | C-162 |
| Versão | PATCH via `npm run bump -- patch` | C-163 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Import esquecido | build quebra | `go build ./...` e `git grep screenshare/classroom -- apps packages` vazio |
| `go.sum` alterado por efeito colateral | dependência mudada sem autorização | `go.sum` proibido; se mudar, parar |
| Build do backend embarcado quebrar | instalador sem backend | rodar `build:backend:win` |

## Scope Lock

### IN

- nome do módulo Go e imports internos do backend; incremento de versão.

### OUT

- lógica, nomes de pacote, diretórios, dependências externas, desktop, web e pacotes TypeScript.

### Allowed Paths

- `apps/backend/go.mod`
- `apps/backend/cmd/server/main.go`
- `apps/backend/internal/room/files.go`
- `apps/backend/internal/room/files_test.go`
- `apps/backend/internal/room/handler.go`
- `apps/backend/internal/room/room_security_test.go`
- `apps/backend/internal/room/room_test.go`
- `apps/backend/internal/signaling/handler.go`
- `apps/backend/internal/signaling/hub.go`
- `apps/backend/internal/signaling/signaling_security_test.go`
- `apps/backend/internal/webrtc/sfu.go`
- `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` (só pelo `npm run bump`)
- `spec-kit/specs/016-modulo-go-mlab/**`

### Prohibited Paths

- `apps/backend/go.sum`
- demais `.go` de `apps/backend`
- `docs/metrics/**`
- `apps/desktop/src/**`, `apps/web/src/**`, `packages/*/src/**`
- `scripts/**`

### Dependencies

- Nenhuma nova.

### Non-Goals

- reescrever registros históricos de teste;
- reorganizar pacotes ou diretórios do backend.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: autorização intocada.
- [x] Princípio III: SFU intocada (só a linha de import em `webrtc/sfu.go`).
- [x] Princípio IV: sem impacto de desempenho.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: nenhuma abstração nova.
- [ ] Princípio VIII: converge ao final.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-10 | Módulo `github.com/MateusARJ/MLAB/apps/backend` | C-161 |
| 2026-11-10 | `docs/metrics/**` intocado | C-162 |
| 2026-11-10 | Versão: PATCH | C-163, AGENTS §13 |
