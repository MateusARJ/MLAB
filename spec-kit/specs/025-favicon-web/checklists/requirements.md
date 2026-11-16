# Checklist de Requisitos: Favicon Próprio do Web App dos Alunos

Feature: `025-favicon-web`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-2501 a RF-2504, RNF-2501, RNF-2502) tem task.
- [x] Ambiguidades fechadas (C-2501 a C-2504): desenho, desktop, geração dos PNGs, ADR e versão.
- [x] Evidência registrada: `apps/web/index.html` e `apps/web/public/MLAB-logo.png` na `development` @ `1f93d5e`.
- [x] Edge cases cobertos: cache do favicon e transparência no iOS.

## Coerência

- [x] A logo das páginas não muda (RF-2504).
- [x] O desktop fica fora, com justificativa (C-2502).
- [x] Sem dependência nova nem script versionado (C-2503, RNF-2501).
- [x] Sem ADR; versão PATCH coerente com `docs/versionamento.md` §2 (C-2504).
- [x] IDs da faixa `250x` não colidem com outras features.

## Viabilidade

- [x] O Playwright do `apps/web` controla o Chrome instalado na máquina de desenvolvimento.
- [x] O Vite copia `public/` para `dist/` sem configuração extra.

## Resultado

APPROVED
