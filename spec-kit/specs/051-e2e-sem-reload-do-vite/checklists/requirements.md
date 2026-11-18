# Checklist de Requisitos: E2E sem Recarregamento do Vite

Feature: `051-e2e-sem-reload-do-vite`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-5101 a RF-5105, RNF-5101 a RNF-5104) tem task.
- [x] Ambiguidades fechadas (C-5101 a C-5103): pasta, defesa no Vite, regressão e versão.
- [x] Evidência registrada: `playwright.config.ts`, `vite.config.ts`, teste direto do `full-reload`, observador do
  `.html` do trace e frames das falhas do A3 (comentário na #153).
- [x] Edge cases cobertos: cópia antiga de `e2e-results/`, `--output` fora de `apps/web`.

## Coerência

- [x] Matriz de smoke (004) continua lendo o e2e, pelo novo caminho (RF-5103).
- [x] Nenhum cenário A0–A20 muda.
- [x] Sem incremento de versão, coerente com `docs/versionamento.md` §2.
- [x] IDs da faixa `510x` não colidem.

## Viabilidade

- [x] `server.watch.ignored` aceita globs e o Vite soma aos padrões dele.
- [x] `testInfo.outputDir` dá a pasta de saída real do teste.

## Resultado

APPROVED
