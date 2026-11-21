# Tasks: Correção dos Alertas do Code Scanning

Feature: `056-alertas-code-scanning`
Prerequisites: spec/clarify/plan/checklist/analyze aprovados
Status: IN PROGRESS

Regras:
- um commit atômico por task, com `Ref: T560x`, na ordem abaixo (uma de cada vez).

### T5601 — Montar o link de download do aluno no cliente
[ ] T5601
Allowed Paths: `apps/web/src/services/api.ts`, `apps/web/src/services/api.test.ts`, `apps/web/src/pages/Room.tsx`,
`apps/web/src/pages/Room.test.tsx`, `spec-kit/specs/056-alertas-code-scanning/tasks.md`
Prohibited Paths: `apps/web/src/hooks/**`, `apps/backend/**`, `apps/desktop/**`, `packages/**`, `scripts/**`
Checks:
- [ ] `fileDownloadPath` monta `/rooms/{roomId}/files/{fileId}/download` com `encodeURIComponent` (RF-5601).
- [ ] Os dois `href` de `Room.tsx` ignoram `file.url`; teste com `url: 'javascript:...'` (RF-5601, alertas #4 a #7).
- [ ] `npm test` e `npm run lint` do `apps/web` verdes (RNF-5601).

### T5602 — Conter o spaHandler na pasta web
[ ] T5602
Depends On: T5601
Allowed Paths: `apps/backend/cmd/server/main.go`, `apps/backend/cmd/server/main_test.go`,
`spec-kit/specs/056-alertas-code-scanning/tasks.md`
Prohibited Paths: `apps/backend/internal/**`, `apps/web/**`, `apps/desktop/**`, `packages/**`, `scripts/**`
Checks:
- [ ] `spaHandler` usa `os.Root` para a verificação de existência (RF-5602, alerta #1).
- [ ] Testes com arquivo físico, rota de SPA e caminhos com `..` e barra invertida fora da pasta (RF-5602).
- [ ] `go test ./...`, `go vet ./...` e `gofmt -l .` vazio no `apps/backend` (RNF-5601).

### T5603 — Escapar o payload type no SDP do desktop
[ ] T5603
Depends On: T5602
Allowed Paths: `apps/desktop/src/renderer/hooks/useWebRTCPublisher.ts`,
`apps/desktop/src/renderer/hooks/useScreenCapture.test.ts`, `spec-kit/specs/056-alertas-code-scanning/tasks.md`
Prohibited Paths: `apps/desktop/src/main/**`, `apps/web/**`, `apps/backend/**`, `packages/**`, `scripts/**`
Checks:
- [ ] `escapeRegExp` aplicado nos dois `new RegExp` (RF-5603, alertas #2 e #3).
- [ ] Teste compara a saída exata de um SDP com VP8 e opus, com e sem `a=fmtp` (RF-5603).
- [ ] `npm test` e `npm run lint` do `apps/desktop` verdes (RNF-5601).

### T5604 — Escapar a barra invertida no relatório de smoke
[ ] T5604
Depends On: T5603
Allowed Paths: `scripts/smoke-report.js`, `spec-kit/specs/056-alertas-code-scanning/tasks.md`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`
Checks:
- [ ] Barra invertida escapada antes da barra vertical no detalhe das falhas (RF-5604, alerta #8).
- [ ] `node --check scripts/smoke-report.js` e verificação do escape registrada.

### T5605 — Converge
[ ] T5605
Depends On: T5604
Allowed Paths: `spec-kit/specs/056-alertas-code-scanning/**`
Prohibited Paths: `apps/**`, `packages/**`, `.github/**`, `spec-kit/docs/adrs/**`
Checks:
- [ ] `converge.md` com evidências e impacto de versão (PATCH, C-5603).
- [ ] Alertas #1 a #8 conferidos na análise do CodeQL do PR (RNF-5603).
- [ ] `npm run spec:check -- spec-kit/specs/056-alertas-code-scanning` com PASS.
