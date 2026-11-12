# Plan: Formatação do Backend com gofmt

Feature: `014-gofmt-backend`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-141 a C-143)

## 1. Summary

Rodar o `gofmt -w` nos 9 arquivos listados na spec, com conteúdo LF, num único commit `style(backend)`. Conferir que
o diff é só de espaço em branco e que `gofmt -l` sobre os blobs do commit fica vazio.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Ferramenta | `gofmt` da toolchain instalada | — |
| Verificação | `git show HEAD:<arquivo>` passado ao `gofmt -l`, em todos os `.go` de `apps/backend` | C-142 |
| Versão | sem incremento | C-143 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Mudança além de espaço em branco | comportamento alterado sem task | `git diff -w --stat` vazio antes do commit |
| CRLF mascarando o resultado | falso positivo ou negativo do `gofmt -l` | verificar sobre os blobs versionados (C-142) |

## Scope Lock

### IN

- formatação `gofmt` dos 9 arquivos `.go` listados na spec.

### OUT

- mudança de nome, comentário ou lógica; CI; `.gitattributes`; desktop, web e pacotes.

### Allowed Paths

- `apps/backend/internal/chat/profanity.go`
- `apps/backend/internal/room/files.go`
- `apps/backend/internal/room/model.go`
- `apps/backend/internal/room/network.go`
- `apps/backend/internal/room/store.go`
- `apps/backend/internal/signaling/hub.go`
- `apps/backend/internal/signaling/hub_test.go`
- `apps/backend/internal/signaling/message.go`
- `apps/backend/internal/webrtc/room.go`
- `spec-kit/specs/014-gofmt-backend/**`

### Prohibited Paths

- demais `.go` de `apps/backend`
- `apps/backend/go.mod`, `apps/backend/go.sum`
- `apps/desktop/**`, `apps/web/**`, `packages/**`
- `.github/**`, `.gitattributes`
- `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json` (sem incremento de versão)

### Dependencies

- Nenhuma nova. Só o `gofmt` da toolchain Go.

### Non-Goals

- checagem de `gofmt` no CI;
- forçar LF nos `.go` via `.gitattributes`;
- qualquer refatoração aproveitando o commit.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: autorização intocada.
- [x] Princípio III: SFU intocada (só espaço em branco em `webrtc/room.go`).
- [x] Princípio IV: sem impacto de desempenho.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: nenhuma abstração nova.
- [ ] Princípio VIII: converge ao final.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-10 | Formatar os 9 arquivos, não só o `store.go` | C-141 |
| 2026-11-10 | Verificar sobre os blobs versionados | C-142 |
| 2026-11-10 | Versão: sem incremento (`style`) | C-143, AGENTS §13 |
