# Plan: Correção dos Alertas do Code Scanning

Feature: `056-alertas-code-scanning`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-5601 a C-5603)

## 1. Summary

1. **Web (RF-5601, alertas #4 a #7):** novo `fileDownloadPath(roomId, fileId)` em `apps/web/src/services/api.ts`;
   os dois `href` de `Room.tsx` passam a `fileDownloadUrl(fileDownloadPath(roomId, file.id), token)`.
2. **Backend (RF-5602, alerta #1):** o `spaHandler` abre `os.OpenRoot(webDir)` na criação e usa `root.Stat` com o
   caminho relativo limpo (`path.Clean("/"+r.URL.Path)` sem a barra inicial) no lugar de `os.Stat(filepath.Join(...))`.
3. **Desktop (RF-5603, alertas #2 e #3):** helper `escapeRegExp` aplicado ao payload type nos dois `new RegExp` de
   `enforceHighBitrateSDP`.
4. **Script (RF-5604, alerta #8):** escape da barra invertida antes do escape da barra vertical em
   `scripts/smoke-report.js`.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| URL de download | montada no cliente, formato do contrato 003 | C-5601 |
| Contenção de caminho | `os.Root`; fallback `filepath.IsLocal` | C-5602 |
| Escape de regex | helper local, sem dependência | RNF-5602 |
| Versão | PATCH, 2.3.3 | C-5603 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| `roomId` da rota diferente do da URL do servidor | download 404 | ambos vêm da mesma sala; teste de `Room.tsx` confere o `href` |
| `os.Root` tratar diferente um caminho válido | asset da web não servido | testes do `spaHandler` com arquivo físico e rota de SPA |
| Escape mudar o SDP | qualidade da transmissão | payload type só tem dígitos; teste compara a saída exata |
| CodeQL não reconhecer o sanitizador | alerta continua aberto | conferir a análise do PR e aplicar o fallback na mesma task |

## Scope Lock

### IN

- Link de download do aluno, existência de arquivo no `spaHandler`, escape do payload type no SDP do desktop e escape
  da barra invertida no relatório de smoke, com seus testes.

### OUT

- Backend de arquivos, contratos, `packages/**`, configuração do CodeQL, ADRs.

### Allowed Paths

- `apps/web/src/services/api.ts`, `apps/web/src/services/api.test.ts`
- `apps/web/src/pages/Room.tsx`, `apps/web/src/pages/Room.test.tsx`
- `apps/backend/cmd/server/main.go`, `apps/backend/cmd/server/main_test.go`
- `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`, `apps/desktop/src/renderer/hooks/useScreenCapture.test.ts`
- `scripts/smoke-report.js`
- `spec-kit/specs/056-alertas-code-scanning/**`
- arquivos de versão alterados por `npm run bump` (`package.json`, `package-lock.json`, `apps/*/package.json`,
  `packages/*/package.json`)

### Prohibited Paths

- `apps/backend/internal/**`, `packages/*/src/**`, `spec-kit/specs/*/contracts/**`, `spec-kit/docs/adrs/**`,
  `.github/**`

### Dependencies

- Nenhuma nova.

### Non-Goals

- Validar outros campos do payload de arquivos (`name`, `size`).
- Suprimir alertas pelo GitHub sem corrigir o código.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda; reforça a não confiança em dados externos.
- [x] Princípio III: SFU intocada; o SDP do desktop sai igual.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudanças mínimas e locais.
- [ ] Princípio VIII: converge ao final (T5605).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-20 | URL de download montada no cliente | C-5601 |
| 2026-11-20 | `os.Root` no `spaHandler` | C-5602 |
| 2026-11-20 | Branch e PR da/para a `main`; IDs `560x`; PATCH | C-5603 |
