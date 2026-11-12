# Tasks: Bloqueio de Executáveis no Upload e Headers de Download

Feature: `022-bloqueio-executaveis-upload`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: READY

Regras:
- `go test ./internal/room/...` e `gofmt -l` vazio em `apps/backend`; `npm run test -w apps/desktop` e
  `npm run lint` verdes antes de marcar `[x]`;
- um commit atômico por task, com `Ref: T220x` e `Refs #64`.

### T2201 — Contrato de arquivos
[ ] T2201
Allowed Paths: `spec-kit/specs/003-classroom-interaction/contracts/files.md`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`
Checks:
- [ ] POST: erro `415` com a mensagem de C-2204; `content_type` definido pelo servidor (RF-2201, RF-2202, RF-2204).
- [ ] Download: `Content-Type` do servidor, `Content-Disposition` com `filename`/`filename*`, `nosniff`, CSP `sandbox`,
  `Cache-Control: no-store` (RF-2205).
- [ ] Nota "em vigor desde 022 (T2202)".

### T2202 — Backend: regra de tipos e headers
[ ] T2202
Depends On: T2201
Allowed Paths: `apps/backend/internal/room/filetypes.go`, `apps/backend/internal/room/filetypes_test.go`,
`apps/backend/internal/room/files.go`, `apps/backend/internal/room/files_test.go`
Prohibited Paths: `apps/backend/internal/room/handler.go`, `apps/backend/internal/signaling/**`,
`apps/backend/internal/auth/**`, `apps/backend/cmd/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`,
`package.json`
Checks:
- [ ] `isBlockedExtension`: lista de C-2202, maiúsculas, ponto/espaço final, extensão dupla; código-fonte aceito
  (RF-2201, RN-2202).
- [ ] `hasExecutableSignature`: `MZ`, ELF e os quatro Mach-O; PDF, PNG, ZIP, texto e vazio aceitos (RF-2202).
- [ ] `serverContentType`: mapa de C-2203 e `application/octet-stream` (RF-2204).
- [ ] `contentDisposition`: fallback ASCII por rune e `filename*` RFC 5987 (RF-2205).
- [ ] `uploadFile`: 415 por extensão e por assinatura, sem guardar nem fazer broadcast; `content_type` do servidor,
  ignorando o do cliente (RF-2201 a RF-2204).
- [ ] `downloadFile`: headers de RF-2205; `revisão-ação.pdf` testado.
- [ ] `go test ./internal/room/...` verde e `gofmt -l .` vazio.

### T2203 — Desktop: pré-validação e exibição do 415
[ ] T2203
Depends On: T2202
Allowed Paths: `apps/desktop/src/renderer/services/files.ts`, `apps/desktop/src/renderer/services/files.test.ts`,
`apps/desktop/src/renderer/hooks/useRoomFileUploads.ts`, `apps/desktop/src/renderer/hooks/useRoomFileUploads.test.ts`,
`apps/desktop/src/renderer/pages/RoomFileDrop.test.tsx`
Prohibited Paths: `apps/desktop/src/renderer/pages/Room.tsx`, `apps/desktop/src/main/**`, `apps/backend/**`,
`apps/web/**`, `packages/**`, `package.json`
Checks:
- [ ] `BLOCKED_EXTENSIONS`, `BLOCKED_TYPE_MSG` e `isBlockedFileName` iguais ao servidor (RN-2201).
- [ ] `enqueue`: extensão bloqueada vira item `erro` sem requisição, e a fila segue (RF-2206).
- [ ] 415 do servidor propagado e exibido no item (RF-2207).
- [ ] Suíte do desktop e `npm run lint` verdes.

### T2204 — Verificação manual
[ ] T2204
Depends On: T2203
Allowed Paths: `spec-kit/specs/022-bloqueio-executaveis-upload/**`
Prohibited Paths: `apps/**`, `packages/**`, `package.json`
Checks:
- [ ] Backend local: `curl` com `.exe`, `.bat` e `.exe` renomeado para `.pdf` → 415; `.py` → 201 (RF-2201, RF-2202,
  RN-2202).
- [ ] `curl -i` no download de `revisão-ação.pdf`: headers de RF-2205.

### T2205 — Converge e versão
[ ] T2205
Depends On: T2204
Allowed Paths: `spec-kit/specs/022-bloqueio-executaveis-upload/**`, `package.json`, `package-lock.json`,
`apps/*/package.json`, `packages/*/package.json`
Prohibited Paths: `apps/**/src/**`, `apps/backend/internal/**`, `packages/**/src/**`, `.github/**`
Checks:
- [ ] `converge.md` com evidências, desvios (#47 citada como relacionada) e impacto de versão (MINOR, C-2207).
- [ ] `npm run bump -- minor` e `npm run version:check`; commit `chore(release): versao X.Y.Z`.
- [ ] `npm run spec:check -- spec-kit/specs/022-bloqueio-executaveis-upload` com PASS.
