# Checklist de Requisitos: Pacote Linux Gerado pelo WSL Leva o Binário Linux do koffi

Feature: `048-koffi-linux-no-pacote-wsl`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-4801 a RF-4803, RNF-4801 a RNF-4803) tem task.
- [x] Ambiguidades fechadas (C-4801 a C-4803): mecanismo, versão e integridade, entrega e versão do monorepo.
- [x] Evidência registrada: `scripts/build-linux-wsl.js` (WSL sobre os `node_modules` do Windows), `package-lock.json`
  (`@koromix/koffi-linux-x64` 3.3.4 com `integrity`), comentário de 2026-11-18 na #138 (pacote do CI correto).
- [x] Edge cases de entrada ausente no lockfile e de falha no meio do build cobertos (spec §8 e §9).

## Coerência

- [x] O caminho Linux nativo (CI) fica fora do escopo e intocado (RNF-4801).
- [x] Nenhum arquivo de `apps/` ou `packages/` muda; "sem incremento" coerente com `AGENTS.md` §13.
- [x] IDs da faixa `480x` não colidem (busca por `RF-48`, `C-48`, `T48` sem resultado).

## Viabilidade

- [x] `tar.exe` e `npm pack` disponíveis no Windows desta máquina; WSL com `dpkg-deb` e WSLg para conferir o pacote.

## Resultado

APPROVED
