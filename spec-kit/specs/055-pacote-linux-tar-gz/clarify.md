# Clarify: Remoção do Pacote Linux tar.gz

Feature: `055-pacote-linux-tar-gz`
Status: CLOSED

Decisões registradas em 2026-11-20, na correção da issue #169 pedida pelo responsável.

## C-5501 — Remover ou passar a gerar o tar.gz

- **Opções:** (A) remover o `.tar.gz` da configuração e da documentação; (B) acrescentar `tar.gz` aos alvos do
  `build-linux-wsl.js` e passar a publicá-lo.
- **Resposta:** **A**, escolhida pelo responsável. O AppImage já roda em qualquer distribuição, que é o uso que o README
  dava ao `.tar.gz`; o formato nunca foi publicado nem testado, e (B) seria um formato novo (MINOR), com mais ~120 MB
  por release.
- **Impacto em spec:** RF-5501, RF-5502, RF-5503.

## C-5502 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR, branch `fix/pacote-linux-tar-gz`, a partir da `main` e para a `main` (ADR 0011).
- **Faixa de IDs:** `US-550x`, `RF-550x`, `RNF-550x`, `C-550x` e `T550x` (busca sem resultado).
- **Impacto de versão:** **PATCH** (2.3.2). Muda `apps/desktop/package.json`, que vai no instalador, para corrigir a
  configuração ao que já é entregue, sem capacidade nova nem perda (o `.tar.gz` nunca foi publicado)
  (`docs/versionamento.md` §2).

## Resultado

CLOSED: C-5501 e C-5502 respondidas, sem ambiguidade em aberto.
