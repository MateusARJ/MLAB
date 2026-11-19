# Clarify: Teste da Sondagem mDNS Isolado da Rede

Feature: `054-teste-mdns-rede-compartilhada`
Status: CLOSED

Decisões registradas em 2026-11-19, na correção da issue #164 pedida pelo responsável.

## C-5401 — Como isolar o teste

- **Opções:** (A) nomes únicos por execução; (B) aceitar qualquer IP que não seja o próprio como "ocupado".
- **Resposta:** **A**. Com (B), o teste passaria por causa de um MLab real e deixaria de provar que o prober registra o
  IP de quem anunciou. Com (A), só os responders simulados anunciam os nomes, e todas as asserções continuam valendo.
- **Impacto em spec:** RF-5401, RF-5402.

## C-5402 — Entrega, faixa de IDs e versão

- **Entrega:** uma feature e um PR, branch `fix/teste-mdns-rede-compartilhada`, a partir da `main` e para a `main`
  (fluxo atual do repositório, só com a `main`).
- **Faixa de IDs:** `US-540x`, `RF-540x`, `RNF-540x`, `C-540x` e `T540x` (busca sem resultado).
- **Impacto de versão:** **nenhum**. Só teste, nada do instalador muda (`docs/versionamento.md` §2).

## Resultado

CLOSED: C-5401 e C-5402 respondidas, sem ambiguidade em aberto.
