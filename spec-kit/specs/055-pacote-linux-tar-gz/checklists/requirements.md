# Checklist de Requisitos: Remoção do Pacote Linux tar.gz

Feature: `055-pacote-linux-tar-gz`
Status: APPROVED

## Completude

- [x] Cada requisito (RF-5501 a RF-5503, RNF-5501, RNF-5502) tem task.
- [x] Ambiguidades fechadas (C-5501 e C-5502).
- [x] Evidência registrada: assets da `v2.3.0` e da `v2.3.1` sem `.tar.gz`; `build-linux-wsl.js` com `AppImage deb`.

## Coerência

- [x] ADR 0002 e spec 001 citam só `.AppImage`; nenhuma spec exige o `.tar.gz`.
- [x] PATCH coerente com `docs/versionamento.md` §2 (configuração do instalador corrigida, sem capacidade nova).
- [x] IDs da faixa `550x` não colidem.

## Viabilidade

- [x] O electron-builder aceita `build.linux.target` sem o `tar.gz`; o script já passa os alvos pela linha de comando.

## Resultado

APPROVED
