# Plan: Bloqueio de Executáveis no Upload e Headers de Download

Feature: `022-bloqueio-executaveis-upload`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-2201 a C-2207)

## 1. Summary

```text
desktop enqueue ──(extensão bloqueada? RF-2206)──► item "erro", sem requisição
        │ permitido
        ▼
POST /rooms/{id}/files ─ uploadFile
  papel/dono → parse multipart → nome (filepath.Base)
  → isBlockedExtension(nome)?      ─► 415 (RF-2201)
  → lê conteúdo / 413
  → hasExecutableSignature(dados)? ─► 415 (RF-2202)
  → ContentType = serverContentType(nome) (RF-2204) → Add → broadcast → 201

GET .../download ─ downloadFile
  Content-Type do servidor + contentDisposition(nome) + nosniff + CSP sandbox + no-store (RF-2205)
```

1. Contrato `003/contracts/files.md`: 415, `content_type` do servidor e headers do download.
2. Novo `apps/backend/internal/room/filetypes.go` com funções puras:
   - `isBlockedExtension(name string) bool`;
   - `hasExecutableSignature(data []byte) bool`;
   - `serverContentType(name string) string`;
   - `contentDisposition(name string) string`.
3. `files.go`: usar as funções no `uploadFile` e no `downloadFile`. O nome é calculado antes da leitura do conteúdo
   para recusar a extensão cedo.
4. Desktop: `services/files.ts` com `BLOCKED_EXTENSIONS`, `isBlockedFileName()` e `BLOCKED_TYPE_MSG`, e o `enqueue`
   do `useRoomFileUploads.ts` usando essas funções.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Normalização do nome | `strings.TrimRight(name, ". ")`, depois `strings.ToLower(filepath.Ext(...))` | RF-2201 |
| Assinaturas | prefixos de bytes fixos (PE `MZ`, ELF, quatro Mach-O); `bytes.HasPrefix` | RF-2202, RNF-2204 |
| Ordem no upload | 415 de extensão antes da leitura; 413 de tamanho antes do 415 de assinatura | RF-2201, RF-2202 |
| `Content-Type` | mapa fixo de C-2203; fora dele, `application/octet-stream` | RF-2204 |
| `filename*` | percent-encoding RFC 5987 por byte UTF-8, preservando só `attr-char` (`A-Z a-z 0-9 ! # $ & + - . ^ _ \` \| ~`) | RF-2205 |
| `filename` ASCII | por rune: fora de `0x20..0x7E`, `"` ou `\` → `_` | RF-2205 |
| Erro | `writeError(w, http.StatusUnsupportedMediaType, msg)` com a mensagem de C-2204 | RF-2201 |
| Desktop | mesma lista e mensagem; checagem só de extensão | RF-2206, RN-2201, C-2206 |
| Testes | `filetypes_test.go` (table-driven), `files_test.go` (fixture existente + helper `uploadRaw` com `CreatePart`), vitest de `files.ts`, `useRoomFileUploads` e `RoomFileDrop` | §11 da spec |
| Versão | MINOR via `npm run bump -- minor` | C-2207 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| Texto que começa com `MZ` recusado | falso positivo raro | aceito na spec (§9); o professor pode compactar |
| Lista do desktop divergir da do servidor | mensagem aparece só depois do envio | o servidor é a autoridade; teste de cada lado com a mesma lista; nota cruzada nos dois arquivos |
| `Cache-Control: no-store` ou CSP atrapalhar o download no celular | aluno sem arquivo | `attachment` não depende de cache nem de CSP; smoke no celular |
| Teste antigo `pagina.html` depender do `Content-Type` do cliente | quebra de teste | o teste só verifica `nosniff` e `attachment`; ganha as asserções novas |
| Conflito de versão com o PR da 021 (também MINOR) | `version:check` falha no merge | o segundo PR faz rebase e roda o bump de novo |

## Scope Lock

### IN

- regra de bloqueio e headers no backend;
- contrato de arquivos da 003;
- pré-validação de extensão e testes do 415 no desktop;
- incremento MINOR de versão.

### OUT

- `apps/web`; eventos WebSocket; `packages/types`; inspeção de compactados; antivírus; aviso de HTTP (#47); limites
  de tamanho e quantidade.

### Allowed Paths

- `apps/backend/internal/room/filetypes.go`, `apps/backend/internal/room/filetypes_test.go`
- `apps/backend/internal/room/files.go`, `apps/backend/internal/room/files_test.go`
- `apps/desktop/src/renderer/services/files.ts`, `apps/desktop/src/renderer/services/files.test.ts`
- `apps/desktop/src/renderer/hooks/useRoomFileUploads.ts`, `apps/desktop/src/renderer/hooks/useRoomFileUploads.test.ts`
- `apps/desktop/src/renderer/pages/RoomFileDrop.test.tsx`
- `spec-kit/specs/003-classroom-interaction/contracts/files.md`
- `spec-kit/specs/022-bloqueio-executaveis-upload/**`
- só na T2205, via `npm run bump`: `package.json`, `package-lock.json`, `apps/*/package.json`, `packages/*/package.json`

### Prohibited Paths

- `apps/web/**`, `packages/**` (fora da T2205)
- `apps/backend/internal/signaling/**`, `apps/backend/internal/webrtc/**`, `apps/backend/internal/auth/**`,
  `apps/backend/cmd/**`
- `apps/backend/internal/room/handler.go` (rotas e helpers de erro não mudam)
- `apps/desktop/src/main/**`, `apps/desktop/src/renderer/pages/Room.tsx`
- `.github/**`, `scripts/**`, `tasks.md` de outras features

### Dependencies

- Nenhuma nova. Go stdlib (`bytes`, `path/filepath`, `strings`, `unicode/utf8`); Vitest e Testing Library já
  instalados no desktop.

### Non-Goals

- bloquear código-fonte ou compactados;
- detectar executáveis dentro de `.zip`;
- mudar a web ou o formato do payload;
- tratar o aviso de download por HTTP.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: a regra de bloqueio é aplicada e testada no servidor; autorização existente intocada.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada; checagem O(1) sobre bytes já em memória.
- [x] Princípio V: contrato `files.md` atualizado na primeira task, antes do código.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: funções novas usadas por `uploadFile`/`downloadFile` e pela fila do desktop.
- [ ] Princípio VIII: converge ao final.

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-12 | Lista de bloqueio + assinatura | C-2201 |
| 2026-11-12 | Código-fonte liberado; lista de executáveis e instaladores | C-2202 |
| 2026-11-12 | Mapa fixo de `Content-Type` | C-2203 |
| 2026-11-12 | 415 com mensagem única | C-2204 |
| 2026-11-12 | RFC 6266 + nosniff + CSP sandbox + no-store | C-2205 |
| 2026-11-12 | Pré-validação só de extensão no desktop | C-2206 |
| 2026-11-12 | IDs `220x`; sem ADR; versão MINOR | C-2207 |
