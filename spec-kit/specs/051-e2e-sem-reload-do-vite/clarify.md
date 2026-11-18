# Clarify: E2E sem Recarregamento do Vite

Feature: `051-e2e-sem-reload-do-vite`
Status: CLOSED

Decisões registradas em 2026-11-18 na correção da issue #153, pedida pelo responsável.

## C-5101 — Mudar a pasta, ignorar no Vite ou desligar o trace

- **Opções:** (A) desligar o trace (`trace: 'off'`); (B) mover a saída para `test-results`, que o Vite já ignora;
  (C) ignorar `e2e-results` no `server.watch` do Vite; (D) B e C juntos.
- **Resposta:** **D**. (A) perde a evidência das falhas. (B) sozinha depende de um padrão implícito do Vite; (C)
  sozinha deixa os artefatos onde o padrão do Playwright não está. Com as duas, a regra fica explícita e protegida se
  alguém mudar a pasta de novo.
- **Impacto em spec:** RF-5101, RF-5102, RF-5105.

## C-5102 — Como impedir a volta do problema

- **Opções:** (A) só a repetição manual do A3; (B) teste e2e que grava um `.html` nas pastas de saída e afirma que
  não há `full-reload`.
- **Resposta:** **B**, num arquivo novo `apps/web/e2e/infra.e2e.ts` (item `I1`), para não misturar com a matriz
  A0–A20. Ele usa a pasta de saída do próprio teste (`testInfo.outputDir`), então acompanha a configuração real, e
  também `e2e-results/`, a pasta antiga.
- **Impacto em spec:** RF-5104.

## C-5103 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR para a `development`, branch `fix/e2e-sem-reload-do-vite`.
- **Faixa de IDs:** `US-510x`, `RF-510x`, `RNF-510x`, `C-510x` e `T510x` (busca por `RF-51`, `C-51`, `T51` sem
  resultado).
- **Impacto de versão:** **nenhum**: muda só configuração de teste, `vite.config.ts` do servidor de desenvolvimento
  (sem efeito no build) e um script do smoke; o instalador não muda (`docs/versionamento.md` §2).

## Resultado

CLOSED: C-5101 a C-5103 respondidas, sem ambiguidade em aberto.
