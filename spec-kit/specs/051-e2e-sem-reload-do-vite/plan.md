# Plan: E2E sem Recarregamento do Vite

Feature: `051-e2e-sem-reload-do-vite`
Status: READY
Spec: `./spec.md`
Clarify: `./clarify.md` (C-5101 a C-5103)

## 1. Summary

```text
antes:  Playwright → apps/web/e2e-results/artifacts/.../resources/<sha1>.html ─┐
                                                                               ├─ watcher do Vite → full-reload
        Vite observa apps/web (ignora só .git, node_modules, test-results) ────┘

depois: Playwright → apps/web/test-results/e2e/...      (ignorado: padrão do Vite + server.watch.ignored)
        Vite server.watch.ignored: test-results, e2e-results, playwright-report
```

1. `apps/web/playwright.config.ts`: `outputDir: 'test-results/e2e'`; JSON em `test-results/e2e-results.json`.
2. `apps/web/vite.config.ts`: `server.watch.ignored` com as três pastas (o Vite soma aos padrões dele).
3. `apps/web/.gitignore`: `test-results/`.
4. `scripts/smoke-report.js`: caminho do JSON.
5. `apps/web/e2e/infra.e2e.ts` (novo): `I1`, regressão do não recarregamento.

## 2. Technical Context

| Item | Decisão | Ref |
|---|---|---|
| Pasta de saída | `test-results/e2e` (padrão ignorado pelo Vite) | C-5101 |
| Defesa explícita | `server.watch.ignored` com `test-results`, `e2e-results`, `playwright-report` | C-5101 |
| Regressão | `I1` em `infra.e2e.ts`, `.html` em `testInfo.outputDir` e em `e2e-results/` | C-5102 |
| Smoke | `smoke-report.js` lê `apps/web/test-results/e2e-results.json` | RF-5103 |
| Versão | nenhuma | C-5103 |

## 3. Risks / Failure Modes

| Risco | Impacto | Mitigação |
|---|---|---|
| `server.watch.ignored` substituir os padrões do Vite | `node_modules` observado | o Vite concatena os padrões com os do usuário; conferido no teste `I1` e no HMR manual |
| `I1` passar por não capturar frames | falso verde | o teste exige o frame `connected` do HMR antes de gravar |
| Relatório do smoke apontar para o caminho velho | `npm run smoke` sem e2e | RF-5103 e `npm run smoke -- --no-run` na verificação |

## Scope Lock

### IN

- configuração do Playwright e do servidor de desenvolvimento do web, `.gitignore` do web, caminho do relatório no
  smoke e o teste `I1`.

### OUT

- `apps/web/src/**`, backend, desktop, `packages/`, cenários A0–A20.

### Allowed Paths

- `apps/web/playwright.config.ts`, `apps/web/vite.config.ts`, `apps/web/.gitignore`, `apps/web/e2e/infra.e2e.ts`
- `scripts/smoke-report.js`
- `spec-kit/specs/051-e2e-sem-reload-do-vite/**`

### Prohibited Paths

- `apps/web/src/**`, `apps/web/e2e/aluno.e2e.ts`, `apps/web/e2e/fixtures.ts`, `apps/desktop/**`, `apps/backend/**`,
  `packages/**`, `package.json`, `package-lock.json`
- `spec-kit/docs/adrs/**`, `.github/**`, `docs/**`

### Dependencies

- Nenhuma nova.

### Non-Goals

- investigar o fechamento lento do trace com `--trace=on`;
- mudar os timeouts ou retries do e2e.

## 4. Constitution Check

- [x] Princípio I: spec READY, clarify CLOSED.
- [x] Princípio II: nenhuma regra de autorização muda.
- [x] Princípio III: SFU intocada.
- [x] Princípio IV: nenhuma meta de desempenho declarada.
- [x] Princípio V: nenhum contrato muda.
- [x] Princípio VI: Scope Lock e paths por task.
- [x] Princípio VII: mudança restrita a configuração de teste e desenvolvimento.
- [ ] Princípio VIII: converge ao final (T5103).

## 5. Decision Log

| Data | Decisão | Ref |
|---|---|---|
| 2026-11-18 | Saída em `test-results` e pastas ignoradas no Vite | C-5101 |
| 2026-11-18 | Teste `I1` de regressão em `infra.e2e.ts` | C-5102 |
| 2026-11-18 | Uma feature, um PR, IDs `510x`, sem incremento de versão | C-5103 |
