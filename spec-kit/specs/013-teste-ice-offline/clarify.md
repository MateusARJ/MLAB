# Clarify: Teste do Join Independente da Rede

Feature: `013-teste-ice-offline`
Status: CLOSED

Decisão aprovada pelo responsável em 2026-11-10, com o plano de correção da issue #35.

## C-131 — Como isolar o teste da rede

- **Contexto:** `IsInternetAvailable()` (`network.go`) guarda o resultado em cache por 5 s nas variáveis de pacote
  `cachedIsOnline` e `lastConnectivityCheck`, protegidas por `connectivityMu`. Os testes de `internal/room` estão no
  mesmo pacote (`package room`).
- **Alternativas:** (A) só nos testes: fixar o cache de conectividade e `STUN_URL` (`t.Setenv`) em cada caso, sem
  tocar produção; (B) tornar a verificação de internet injetável no handler (variável de função), o que muda código
  de produção (refactor, versão PATCH) sem ganho de comportamento.
- **Resposta aprovada:** **A**. Commits `test(backend)`, sem incremento de versão (`docs/versionamento.md` §2).

## C-132 — Lógica igual em `internal/signaling`

- **Contexto:** `signaling/handler.go` (`buildIceServers`) repete a regra, mas nenhum teste de `signaling` verifica a
  lista de ICE, então não há falha dependente de rede.
- **Resposta aprovada:** fora do escopo da 013; registrado no converge.

## Resultado

CLOSED — C-131 e C-132 respondidas; nenhuma ambiguidade em aberto.
